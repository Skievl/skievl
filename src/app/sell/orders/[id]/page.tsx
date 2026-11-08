import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { AddressBlock, MoneyBreakdown, OrderHeader, OrderTimeline } from "@/components/OrderSummary";
import { Notice } from "@/components/ui";
import Link from "next/link";
import { FulfillmentControls, CancelOrderForm } from "./FulfillmentControls";
import type { Order } from "@/lib/types";

export const metadata = { title: "Manage order" };

export default async function SellerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { seller } = await requireSeller();
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, buyer:profiles!orders_buyer_id_fkey(display_name)")
    .eq("id", id)
    .eq("seller_id", seller.user_id)
    .maybeSingle();
  if (!data) notFound();
  const order = data as Order & { buyer: { display_name: string } | null };
  const { data: convo } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", order.listing_id)
    .eq("buyer_id", order.buyer_id)
    .maybeSingle();
  const cancellable = ["awaiting_fulfillment", "ready_for_pickup", "pickup_scheduled", "delivery_scheduled"].includes(order.status);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <OrderHeader order={order} />
        <OrderTimeline order={order} />
        {order.status === "disputed" && (
          <Notice tone="error">The buyer opened a payment dispute. Our team will contact you — please keep any messages and photos.</Notice>
        )}

        <section className="card space-y-4 p-5">
          <h2 className="font-bold">Buyer: {order.buyer?.display_name ?? "—"}</h2>
          {order.buyer_note && <p className="rounded-lg bg-ice p-3 text-sm"><span className="font-semibold">Buyer note:</span> {order.buyer_note}</p>}
          {order.fulfillment_method === "dropoff" ? (
            <AddressBlock title="Drop off at" address={order.dropoff_address} />
          ) : (
            <p className="text-sm text-ink-soft">The buyer can see your pickup address on their order page. Agree a time by message.</p>
          )}
          {order.scheduled_for && <p className="text-sm"><span className="font-semibold">Scheduled:</span> {formatDate(order.scheduled_for, true)}</p>}
          <Link href={convo ? `/account/messages/${convo.id}` : "/account/messages"} className="btn-secondary">
            {convo ? "Message buyer" : "Open messages"}
          </Link>
        </section>

        <FulfillmentControls orderId={order.id} method={order.fulfillment_method} status={order.status} />

        {cancellable && (
          <section className="card p-5">
            <h2 className="font-bold text-danger">Can&apos;t complete this sale?</h2>
            <p className="mt-1 mb-3 text-sm text-muted">Cancelling refunds the buyer in full. Frequent cancellations may affect your account.</p>
            <CancelOrderForm orderId={order.id} />
          </section>
        )}
      </div>

      <aside className="card h-fit p-5">
        <h2 className="mb-3 font-bold">Payout breakdown</h2>
        <MoneyBreakdown order={order} perspective="seller" />
        <p className="mt-3 text-xs text-muted">Proceeds are transferred to your Stripe account at payment and paid out to your bank on your Stripe payout schedule.</p>
      </aside>
    </div>
  );
}
