import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Order } from "@/lib/types";

export const metadata = { title: "Seller orders" };

export default async function SellerOrdersPage() {
  const { seller } = await requireSeller();
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, buyer:profiles!orders_buyer_id_fkey(display_name)")
    .eq("seller_id", seller.user_id)
    .not("status", "in", "(pending_payment,expired)")
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as (Order & { buyer: { display_name: string } | null })[];
  const open = orders.filter((o) => ["awaiting_fulfillment", "ready_for_pickup", "pickup_scheduled", "delivery_scheduled", "picked_up", "delivered", "disputed"].includes(o.status));
  const closed = orders.filter((o) => !open.includes(o));

  const Table = ({ rows }: { rows: typeof orders }) => (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr><th>Order</th><th>Item</th><th>Buyer</th><th>Method</th><th>Status</th><th className="text-right">You receive</th></tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td><Link href={`/sell/orders/${o.id}`} className="font-semibold text-sky">{o.order_number}</Link><div className="text-xs text-muted">{formatDate(o.paid_at)}</div></td>
              <td className="max-w-[220px] truncate">{o.listing_snapshot.title}</td>
              <td>{o.buyer?.display_name ?? "—"}</td>
              <td>{o.fulfillment_method === "pickup" ? "Pickup" : "Drop-off"}</td>
              <td><OrderStatusBadge status={o.status} /></td>
              <td className="text-right font-semibold">{formatMoney(o.seller_proceeds_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <PageHeader title="Orders" subtitle="Manage pickups and drop-offs." />
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" body="When something sells you'll get an email and it will appear here." />
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-3 font-bold">Needs attention ({open.length})</h2>
            {open.length ? <Table rows={open} /> : <p className="text-sm text-muted">You&apos;re all caught up.</p>}
          </section>
          {closed.length > 0 && (
            <section>
              <h2 className="mb-3 font-bold">Sales history</h2>
              <Table rows={closed} />
            </section>
          )}
        </div>
      )}
    </>
  );
}
