import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { publicEnv } from "@/lib/env";
import { listingImageUrl } from "@/lib/images";
import type { Order } from "@/lib/types";

export const runtime = "nodejs";

const bodySchema = z.object({
  listingId: z.string().uuid(),
  method: z.enum(["pickup", "dropoff"]),
  dropoff: z
    .object({
      line1: z.string().trim().min(3).max(120),
      line2: z.string().trim().max(120).optional().or(z.literal("")),
      city: z.string().trim().max(80).optional().or(z.literal("")),
      state: z.literal("NY").default("NY"),
      postal_code: z.string().regex(/^\d{5}$/),
    })
    .optional(),
  note: z.string().trim().max(500).optional(),
});

/**
 * 1. Atomically reserve the listing + create a pending order (reserve_listing RPC).
 * 2. Create a Stripe Checkout Session as a destination charge:
 *    buyer pays SKIEVL, seller's connected account receives (total − application fee).
 * 3. If anything fails, release the reservation.
 */
export async function POST(request: NextRequest) {
  // Same-origin check (defence in depth against CSRF on a JSON endpoint)
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.nextUrl.host) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid checkout details" }, { status: 400 });
  const { listingId, method, dropoff, note } = parsed.data;
  if (method === "dropoff" && !dropoff) return NextResponse.json({ error: "Drop-off address required" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const { data: orderData, error: reserveError } = await supabase.rpc("reserve_listing", {
    p_listing_id: listingId,
    p_method: method,
    p_dropoff_address: method === "dropoff" ? dropoff : null,
    p_buyer_note: note ?? null,
  });
  if (reserveError || !orderData) {
    return NextResponse.json({ error: reserveError?.message ?? "Item unavailable" }, { status: 409 });
  }
  const order = orderData as Order;
  const stripe = getStripe();
  const admin = createAdminClient();

  try {
    // Re-use an open session for a re-used pending order
    if (order.stripe_checkout_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
      if (existing.status === "open" && existing.url) return NextResponse.json({ url: existing.url });
    }

    const { data: seller } = await admin
      .from("seller_profiles")
      .select("stripe_account_id, charges_enabled, shop_name")
      .eq("user_id", order.seller_id)
      .single();
    if (!seller?.stripe_account_id || !seller.charges_enabled) throw new Error("Seller cannot accept payments right now");

    const cover = listingImageUrl(order.listing_snapshot.cover_image);
    const lineItems = [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: order.item_price_cents,
          product_data: {
            name: order.listing_snapshot.title,
            description: `Sold by ${seller.shop_name} · ${method === "pickup" ? "Local pickup" : "Seller drop-off"}`,
            ...(cover && cover.startsWith("https://") ? { images: [cover] } : {}),
          },
        },
      },
      ...(order.dropoff_fee_cents > 0
        ? [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: order.dropoff_fee_cents,
                product_data: { name: "Seller drop-off fee" },
              },
            },
          ]
        : []),
    ];

    // Stripe requires expires_at >= 30 min from now. Derive it from the order so a retried
    // request sends identical params (idempotency). The DB hold (>= 33 min) outlasts it.
    const expiresAt = Math.floor(new Date(order.created_at).getTime() / 1000) + 31 * 60;

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: lineItems,
        payment_method_types: ["card"], // cards + Apple Pay / Google Pay; no delayed methods
        customer_email: user.email,
        client_reference_id: order.id,
        metadata: { order_id: order.id, listing_id: order.listing_id },
        payment_intent_data: {
          application_fee_amount: order.platform_fee_cents,
          transfer_data: { destination: seller.stripe_account_id },
          description: `SKIEVL ${order.order_number}: ${order.listing_snapshot.title}`.slice(0, 250),
          statement_descriptor_suffix: "SKIEVL",
          metadata: { order_id: order.id, order_number: order.order_number },
        },
        expires_at: expiresAt,
        success_url: `${publicEnv.siteUrl}/checkout/success?order=${order.id}`,
        cancel_url: `${publicEnv.siteUrl}/api/checkout/cancel?order=${order.id}`,
      },
      { idempotencyKey: `checkout_${order.id}` },
    );

    await admin.from("orders").update({ stripe_checkout_session_id: session.id }).eq("id", order.id);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout]", err);
    await admin.rpc("release_reservation", { p_order_id: order.id, p_reason: "Checkout could not start" });
    return NextResponse.json({ error: "We couldn't start checkout. Please try again." }, { status: 500 });
  }
}
