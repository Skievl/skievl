import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { notify, alertAdmins } from "@/lib/notify";
import { formatMoney } from "@/lib/format";
import { syncConnectedAccount } from "@/lib/connect";
import type { Order } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook endpoint. Configure TWO endpoints in the Stripe dashboard that
 * both point here:
 *   1. "Your account" events  -> STRIPE_WEBHOOK_SECRET
 *      checkout.session.completed, checkout.session.expired,
 *      checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
 *      charge.refunded, charge.dispute.created, charge.dispute.updated, charge.dispute.closed
 *   2. "Connected accounts" events -> STRIPE_CONNECT_WEBHOOK_SECRET
 *      account.updated, payout.created, payout.updated, payout.paid, payout.failed
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event | null = null;
  for (const secret of serverEnv.stripeWebhookSecrets) {
    try {
      event = stripe.webhooks.constructEvent(payload, signature, secret);
      break;
    } catch {
      /* try next secret */
    }
  }
  if (!event) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  const admin = createAdminClient();

  // Idempotency: skip events we've already processed successfully
  const { data: seen } = await admin.from("stripe_events").select("processed_at").eq("id", event.id).maybeSingle();
  if (seen?.processed_at) return NextResponse.json({ received: true, duplicate: true });
  if (!seen) await admin.from("stripe_events").insert({ id: event.id, type: event.type, account: event.account ?? null });

  try {
    await handleEvent(event);
    await admin.from("stripe_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", event.id);
    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[stripe-webhook] ${event.type} ${event.id}`, err);
    await admin.from("stripe_events").update({ error: message.slice(0, 1000) }).eq("id", event.id);
    // 500 => Stripe retries with backoff
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") await handlePaid(session);
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        await createAdminClient().rpc("release_reservation", {
          p_order_id: orderId,
          p_reason: event.type === "checkout.session.expired" ? "Checkout expired" : "Payment failed",
        });
      }
      break;
    }
    case "charge.refunded":
      await handleRefunded(event.data.object as Stripe.Charge);
      break;
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
      await handleDispute(event.data.object as Stripe.Dispute, event.type);
      break;
    case "account.updated":
      await syncConnectedAccount(event.data.object as Stripe.Account);
      break;
    case "payout.created":
    case "payout.updated":
    case "payout.paid":
    case "payout.failed":
      if (event.account) await handlePayout(event.data.object as Stripe.Payout, event.account);
      break;
    default:
      break;
  }
}

async function handlePaid(session: Stripe.Checkout.Session) {
  const admin = createAdminClient();
  const stripe = getStripe();
  const orderId = session.metadata?.order_id;
  if (!orderId) throw new Error(`Session ${session.id} has no order_id`);

  const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!piId) throw new Error(`Session ${session.id} has no payment_intent`);
  const pi = await stripe.paymentIntents.retrieve(piId);
  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id ?? null;

  const { data: existing } = await admin.from("orders").select("stripe_checkout_session_id, paid_at").eq("id", orderId).single();

  const { data: result, error } = await admin.rpc("mark_order_paid", {
    p_order_id: orderId,
    p_session_id: session.id,
    p_payment_intent_id: piId,
    p_charge_id: chargeId,
    p_amount_cents: session.amount_total ?? pi.amount,
  });
  if (error) throw error;

  // A different session paid for an already-paid order (should be impossible) -> refund it.
  if (result === "already_paid" && existing?.stripe_checkout_session_id && existing.stripe_checkout_session_id !== session.id) {
    await stripe.refunds.create(
      { payment_intent: piId, reverse_transfer: true, refund_application_fee: true, metadata: { order_id: orderId, reason: "duplicate_payment" } },
      { idempotencyKey: `dup_${piId}` },
    );
    await alertAdmins("Duplicate payment auto-refunded", [`Order ${orderId}, payment ${piId}`], `/admin/orders`);
    return;
  }
  if (result === "already_paid") return;

  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single<Order>();
  if (!order) return;

  if (result === "conflict") {
    // Item sold to someone else in a race: refund in full immediately.
    await stripe.refunds.create(
      { payment_intent: piId, reverse_transfer: true, refund_application_fee: true, metadata: { order_id: orderId, reason: "item_unavailable" } },
      { idempotencyKey: `conflict_${piId}` },
    );
    await notify({
      userId: order.buyer_id,
      type: "order_cancelled",
      title: "Sorry — that item just sold",
      body: `Someone else completed checkout for “${order.listing_snapshot.title}” first. Your payment of ${formatMoney(order.total_cents)} has been refunded in full.`,
      link: "/search",
      email: { ctaLabel: "Find similar gear" },
    });
    return;
  }

  // Success notifications
  const isPickup = order.fulfillment_method === "pickup";
  await notify({
    userId: order.buyer_id,
    type: "order_paid",
    title: `Order confirmed: ${order.listing_snapshot.title}`,
    body: isPickup
      ? "Payment received. The seller's pickup address is on your order page — message them to set a pickup time."
      : "Payment received. The seller will contact you to schedule your drop-off.",
    link: `/account/orders/${order.id}`,
    email: {
      subject: `Your SKIEVL order ${order.order_number}`,
      paragraphs: [
        `Thanks for buying local! You paid ${formatMoney(order.total_cents)} for “${order.listing_snapshot.title}”.`,
        isPickup
          ? "Your pickup address and the seller's instructions are on your order page."
          : `The seller will drop it off at the address you provided (drop-off fee ${formatMoney(order.dropoff_fee_cents)}).`,
        "When you have the item, tap “I received the item” to complete the order and review the seller.",
      ],
      ctaLabel: "View order",
    },
  });
  await notify({
    userId: order.seller_id,
    type: "order_sold",
    title: `You sold ${order.listing_snapshot.title}!`,
    body: `${isPickup ? "The buyer will pick up" : "The buyer chose drop-off"}. You'll receive ${formatMoney(order.seller_proceeds_cents)} after fees.`,
    link: `/sell/orders/${order.id}`,
    email: {
      subject: `Sold! ${order.listing_snapshot.title} (${order.order_number})`,
      paragraphs: [
        `Great news — your “${order.listing_snapshot.title}” sold for ${formatMoney(order.item_price_cents)}${order.dropoff_fee_cents ? ` plus a ${formatMoney(order.dropoff_fee_cents)} drop-off fee` : ""}.`,
        `Your proceeds after the marketplace fee: ${formatMoney(order.seller_proceeds_cents)}. Stripe pays out to your bank on your payout schedule.`,
        isPickup
          ? "Mark the order “Ready for pickup” and message the buyer to agree a time."
          : "Message the buyer to schedule the drop-off, then mark it delivered.",
      ],
      ctaLabel: "Manage order",
    },
  });
}

async function handleRefunded(charge: Stripe.Charge) {
  const admin = createAdminClient();
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  const { data: order } = await admin
    .from("orders")
    .select("*")
    .or(`stripe_charge_id.eq.${charge.id}${piId ? `,stripe_payment_intent_id.eq.${piId}` : ""}`)
    .maybeSingle<Order>();
  if (!order) return;

  // Sync individual refunds (covers refunds issued from the Stripe dashboard too)
  const refunds = await getStripe().refunds.list({ charge: charge.id, limit: 100 });
  for (const r of refunds.data) {
    await admin.from("refunds").upsert(
      { order_id: order.id, stripe_refund_id: r.id, amount_cents: r.amount, reason: r.metadata?.reason ?? r.reason ?? null, status: r.status ?? "succeeded" },
      { onConflict: "stripe_refund_id", ignoreDuplicates: false },
    );
  }

  const full = charge.amount_refunded >= charge.amount;
  const update: Partial<Order> = { refunded_cents: charge.amount_refunded };
  if (full && !["cancelled", "refunded"].includes(order.status)) {
    update.status = "refunded";
    update.cancelled_at = new Date().toISOString();
  }
  await admin.from("orders").update(update).eq("id", order.id);

  if (full && !["cancelled", "refunded"].includes(order.status)) {
    await notify({
      userId: order.buyer_id,
      type: "refund",
      title: `Refund issued for ${order.order_number}`,
      body: `${formatMoney(charge.amount_refunded)} is on its way back to your card (typically 5–10 business days).`,
      link: `/account/orders/${order.id}`,
    });
  }
}

async function handleDispute(dispute: Stripe.Dispute, type: string) {
  const admin = createAdminClient();
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
  const { data: order } = await admin.from("orders").select("id, status, order_number").eq("stripe_charge_id", chargeId).maybeSingle();

  await admin.from("disputes").upsert(
    {
      order_id: order?.id ?? null,
      stripe_dispute_id: dispute.id,
      stripe_charge_id: chargeId,
      amount_cents: dispute.amount,
      reason: dispute.reason,
      status: dispute.status,
      evidence_due_by: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null,
    },
    { onConflict: "stripe_dispute_id" },
  );

  if (!order) return;
  if (type === "charge.dispute.created") {
    await admin.from("orders").update({ status: "disputed" }).eq("id", order.id);
    await alertAdmins(
      `Chargeback opened on ${order.order_number}`,
      [`Reason: ${dispute.reason}. Amount: ${formatMoney(dispute.amount)}.`, "Respond in the Stripe dashboard before the evidence deadline."],
      `/admin/orders?status=disputed`,
    );
  } else if (type === "charge.dispute.closed") {
    await admin
      .from("orders")
      .update({ status: dispute.status === "won" ? "completed" : "refunded" })
      .eq("id", order.id);
  }
}

async function handlePayout(payout: Stripe.Payout, accountId: string) {
  const admin = createAdminClient();
  const { data: seller } = await admin.from("seller_profiles").select("user_id").eq("stripe_account_id", accountId).maybeSingle();
  await admin.from("payouts").upsert(
    {
      seller_id: seller?.user_id ?? null,
      stripe_account_id: accountId,
      stripe_payout_id: payout.id,
      amount_cents: payout.amount,
      currency: payout.currency,
      status: payout.status,
      arrival_date: payout.arrival_date ? new Date(payout.arrival_date * 1000).toISOString() : null,
    },
    { onConflict: "stripe_payout_id" },
  );
  if (seller && payout.status === "failed") {
    await notify({
      userId: seller.user_id,
      type: "payout_failed",
      title: "A payout to your bank failed",
      body: "Please check your bank details in your Stripe payout dashboard.",
      link: "/sell",
    });
  }
}
