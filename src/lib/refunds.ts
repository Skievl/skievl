import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import type { ActionResult, Order } from "@/lib/types";

// NOTE: deliberately NOT a server action. Callers must authorize first.
/**
 * Shared refund helper (seller cancel + admin). Full refund when amountCents is
 * omitted. Always reverses the transfer and refunds the application fee
 * proportionally, so the platform keeps no commission on refunded amounts.
 */
export async function refundOrder(
  order: Order,
  opts: { reason: string; initiatedBy: string; amountCents?: number; relist?: boolean },
): Promise<ActionResult> {
  const remaining = order.total_cents - order.refunded_cents;
  const amount = opts.amountCents ?? remaining;
  if (amount <= 0 || amount > remaining) return { ok: false, error: "Invalid refund amount" };

  const admin = createAdminClient();
  try {
    const refund = await getStripe().refunds.create(
      {
        payment_intent: order.stripe_payment_intent_id!,
        amount,
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: { order_id: order.id, reason: opts.reason.slice(0, 450) },
      },
      { idempotencyKey: `refund_${order.id}_${order.refunded_cents}_${amount}` },
    );
    await admin.from("refunds").upsert(
      {
        order_id: order.id,
        stripe_refund_id: refund.id,
        amount_cents: amount,
        reason: opts.reason,
        status: refund.status ?? "pending",
        initiated_by: opts.initiatedBy,
      },
      { onConflict: "stripe_refund_id" },
    );
  } catch (err) {
    console.error("[refund]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Refund failed" };
  }

  const full = amount === remaining;
  await admin
    .from("orders")
    .update({
      refunded_cents: order.refunded_cents + amount,
      ...(full ? { status: "refunded", cancelled_at: new Date().toISOString(), cancel_reason: opts.reason } : {}),
    })
    .eq("id", order.id);

  if (full && opts.relist !== false) {
    await admin
      .from("listings")
      .update({ status: "unavailable", sold_at: null, reserved_order_id: null, reserved_until: null })
      .eq("id", order.listing_id)
      .eq("status", "sold");
  }
  return { ok: true };
}
