import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { AddressBlock, MoneyBreakdown, OrderHeader, OrderTimeline } from "@/components/OrderSummary";
import { Notice } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { confirmReceived } from "@/app/actions/orders";
import { startConversation } from "@/app/actions/messages";
import { ReviewForm } from "./ReviewForm";
import type { Order } from "@/lib/types";

export const metadata = { title: "Order details" };

export default async function BuyerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser(`/account/orders/${id}`);
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, seller:seller_profiles(shop_name, user_id)")
    .eq("id", id)
    .eq("buyer_id", user.id)
    .maybeSingle();
  if (!data) notFound();
  const order = data as Order & { seller: { shop_name: string; user_id: string } };
  const { data: review } = await supabase.from("reviews").select("id, rating_overall, body").eq("order_id", id).maybeSingle();

  const canConfirm = ["awaiting_fulfillment", "ready_for_pickup", "pickup_scheduled", "delivery_scheduled", "picked_up", "delivered"].includes(order.status);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <OrderHeader order={order} />
        <OrderTimeline order={order} />

        {order.status === "pending_payment" && <Notice tone="warn">We’re confirming your payment. This page will update shortly.</Notice>}
        {order.status === "cancelled" && <Notice tone="info">This order was cancelled. {order.cancel_reason}</Notice>}
        {order.status === "refunded" && <Notice tone="info">This order was refunded to your original payment method.</Notice>}

        <section className="card space-y-4 p-5">
          <h2 className="font-bold">{order.fulfillment_method === "pickup" ? "Pickup" : "Drop-off"}</h2>
          {order.fulfillment_method === "pickup" ? (
            order.pickup_address ? (
              <AddressBlock title={`Pick up from ${order.seller.shop_name}`} address={order.pickup_address} />
            ) : (
              <p className="text-sm text-muted">The pickup address appears here once payment is confirmed.</p>
            )
          ) : (
            <AddressBlock title="Seller will drop off at" address={order.dropoff_address} />
          )}
          {order.scheduled_for && (
            <p className="text-sm"><span className="font-semibold">Scheduled:</span> {formatDate(order.scheduled_for, true)}</p>
          )}
          {order.seller_note && (
            <p className="rounded-lg bg-ice p-3 text-sm"><span className="font-semibold">Note from seller:</span> {order.seller_note}</p>
          )}
          <form action={startConversation.bind(null, order.listing_id)}>
            <button className="btn-secondary">Message {order.seller.shop_name}</button>
          </form>
          <p className="text-xs text-muted">Use messages to agree on a time. Please be on time and inspect the gear at handoff.</p>
        </section>

        {canConfirm && (
          <section className="card p-5">
            <h2 className="font-bold">Got your gear?</h2>
            <p className="mt-1 text-sm text-muted">
              Confirm once you have the item. This completes the order and lets you review the seller.
              If there’s a problem, message the seller or contact support@skievl.com before confirming.
            </p>
            <form action={confirmReceived.bind(null, order.id)} className="mt-3">
              <SubmitButton className="btn-dark">I received the item</SubmitButton>
            </form>
          </section>
        )}

        {order.status === "completed" && (
          <section className="card p-5">
            <h2 className="font-bold">Review {order.seller.shop_name}</h2>
            {review ? (
              <p className="mt-2 text-sm text-muted">Thanks — you reviewed this seller. <Link className="text-sky" href={`/sellers/${order.seller_id}#reviews`}>See reviews</Link></p>
            ) : (
              <ReviewForm orderId={order.id} />
            )}
          </section>
        )}
      </div>

      <aside className="space-y-4">
        <div className="card p-5">
          <h2 className="mb-3 font-bold">Payment</h2>
          <MoneyBreakdown order={order} perspective="buyer" />
          <p className="mt-3 text-xs text-muted">Paid securely via Stripe on {formatDate(order.paid_at, true)}.</p>
        </div>
        <Link href={`/listings/${order.listing_id}`} className="btn-secondary w-full">View original listing</Link>
      </aside>
    </div>
  );
}
