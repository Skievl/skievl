import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/** Buyer clicked "back" in Stripe Checkout: expire the session and release the hold immediately. */
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("order") ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: order } = await supabase
    .from("orders")
    .select("id, listing_id, buyer_id, status, stripe_checkout_session_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!user || !order || order.buyer_id !== user.id) return NextResponse.redirect(new URL("/", request.url));

  if (order.status === "pending_payment") {
    try {
      if (order.stripe_checkout_session_id) await getStripe().checkout.sessions.expire(order.stripe_checkout_session_id);
    } catch {
      // Session may already be complete/expired; the webhook is the source of truth.
    }
    // Only release if expiring succeeded or the session wasn't paid (mark_order_paid handles races)
    const session = order.stripe_checkout_session_id
      ? await getStripe().checkout.sessions.retrieve(order.stripe_checkout_session_id).catch(() => null)
      : null;
    if (!session || session.status === "expired") {
      await createAdminClient().rpc("release_reservation", { p_order_id: order.id, p_reason: "Buyer cancelled checkout" });
    }
  }
  return NextResponse.redirect(new URL(`/listings/${order.listing_id}?checkout=cancelled`, request.url));
}
