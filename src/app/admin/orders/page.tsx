import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatMoney, ORDER_STATUS_LABELS } from "@/lib/format";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { MoneyBreakdown } from "@/components/OrderSummary";
import { PageHeader } from "@/components/ui";
import { AdminOrderActions } from "./AdminOrderActions";
import type { Order, OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type AdminOrder = Order & { buyer: { display_name: string } | null; seller: { shop_name: string } | null };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string; id?: string; q?: string }> }) {
  await requireAdmin();
  const { status, id, q } = await searchParams;
  const db = createAdminClient();

  let query = db
    .from("orders")
    .select("*, buyer:profiles!orders_buyer_id_fkey(display_name), seller:seller_profiles(shop_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status && status in ORDER_STATUS_LABELS) query = query.eq("status", status);
  else query = query.not("status", "in", "(pending_payment,expired)");
  if (q) query = query.ilike("order_number", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  const orders = (data ?? []) as AdminOrder[];

  let selected: AdminOrder | null = null;
  let refunds: { amount_cents: number; reason: string | null; created_at: string; status: string }[] = [];
  let disputes: { stripe_dispute_id: string; status: string; reason: string | null; amount_cents: number; evidence_due_by: string | null }[] = [];
  if (id) {
    const { data: o } = await db.from("orders").select("*, buyer:profiles!orders_buyer_id_fkey(display_name), seller:seller_profiles(shop_name)").eq("id", id).maybeSingle();
    selected = (o as AdminOrder | null) ?? null;
    const [r, d] = await Promise.all([
      db.from("refunds").select("amount_cents, reason, created_at, status").eq("order_id", id).order("created_at"),
      db.from("disputes").select("stripe_dispute_id, status, reason, amount_cents, evidence_due_by").eq("order_id", id),
    ]);
    refunds = r.data ?? [];
    disputes = d.data ?? [];
  }

  const filters: (OrderStatus | "")[] = ["", "awaiting_fulfillment", "picked_up", "delivered", "completed", "disputed", "refunded", "cancelled", "pending_payment"];

  return (
    <>
      <PageHeader title="Orders" subtitle="Transactions, refunds and disputes." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <Link key={f || "all"} href={f ? `/admin/orders?status=${f}` : "/admin/orders"} className={`chip ${(status ?? "") === f ? "border-ink bg-ink text-white" : ""}`}>
            {f ? ORDER_STATUS_LABELS[f] : "All paid"}
          </Link>
        ))}
        <form className="ml-auto"><input name="q" defaultValue={q} placeholder="Order # (EVL-…)" className="input w-48" /></form>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Order</th><th>Item</th><th>Buyer → Seller</th><th>Status</th><th className="text-right">Total</th><th className="text-right">Fee</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className={o.id === id ? "bg-ice" : ""}>
                  <td><Link href={`/admin/orders?${new URLSearchParams({ ...(status ? { status } : {}), id: o.id })}`} className="font-semibold text-sky">{o.order_number}</Link><div className="text-xs text-muted">{formatDate(o.paid_at ?? o.created_at)}</div></td>
                  <td className="max-w-[200px] truncate">{o.listing_snapshot.title}</td>
                  <td className="text-xs">{o.buyer?.display_name} → {o.seller?.shop_name}</td>
                  <td><OrderStatusBadge status={o.status} /></td>
                  <td className="text-right">{formatMoney(o.total_cents)}</td>
                  <td className="text-right text-muted">{formatMoney(o.platform_fee_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <aside className="card h-fit space-y-4 p-5">
            <div>
              <p className="text-xs text-muted">{selected.order_number}</p>
              <h2 className="font-bold">{selected.listing_snapshot.title}</h2>
              <OrderStatusBadge status={selected.status} />
            </div>
            <MoneyBreakdown order={selected} perspective="admin" />
            <dl className="space-y-1 text-xs text-muted">
              <div>Method: {selected.fulfillment_method}</div>
              <div>Paid: {formatDate(selected.paid_at, true)}</div>
              <div>Stripe PI: <span className="font-mono">{selected.stripe_payment_intent_id ?? "—"}</span></div>
              {selected.cancel_reason && <div>Reason: {selected.cancel_reason}</div>}
            </dl>
            {refunds.length > 0 && (
              <div>
                <p className="text-sm font-semibold">Refunds</p>
                <ul className="text-xs">{refunds.map((r, i) => <li key={i}>{formatMoney(r.amount_cents)} · {r.status} · {r.reason}</li>)}</ul>
              </div>
            )}
            {disputes.length > 0 && (
              <div className="rounded-lg bg-danger-light p-3 text-xs text-danger">
                {disputes.map((d) => (
                  <p key={d.stripe_dispute_id}>Dispute {d.status} · {d.reason} · {formatMoney(d.amount_cents)}{d.evidence_due_by ? ` · evidence due ${formatDate(d.evidence_due_by)}` : ""}</p>
                ))}
                <p className="mt-1">Respond in the Stripe Dashboard → Payments → Disputes.</p>
              </div>
            )}
            <AdminOrderActions orderId={selected.id} canRefund={Boolean(selected.stripe_payment_intent_id) && selected.refunded_cents < selected.total_cents} />
          </aside>
        )}
      </div>
    </>
  );
}
