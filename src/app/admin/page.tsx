import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatMoney } from "@/lib/format";
import { PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAID_STATUSES = ["awaiting_fulfillment", "ready_for_pickup", "pickup_scheduled", "delivery_scheduled", "picked_up", "delivered", "completed", "disputed"];

export default async function AdminOverview() {
  await requireAdmin();
  const db = createAdminClient();
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [users, sellers, live, pending, openReports, openDisputes, orders30, recentAudit] = await Promise.all([
    count(db.from("profiles").select("id", { count: "exact", head: true })),
    count(db.from("seller_profiles").select("user_id", { count: "exact", head: true }).eq("charges_enabled", true)),
    count(db.from("listings").select("id", { count: "exact", head: true }).eq("status", "active")),
    count(db.from("listings").select("id", { count: "exact", head: true }).eq("status", "pending_review")),
    count(db.from("reports").select("id", { count: "exact", head: true }).in("status", ["open", "reviewing"])),
    count(db.from("disputes").select("id", { count: "exact", head: true }).in("status", ["needs_response", "warning_needs_response", "under_review", "warning_under_review"])),
    db.from("orders").select("total_cents, platform_fee_cents, refunded_cents, dropoff_fee_cents, status, paid_at").gte("paid_at", since30).in("status", [...PAID_STATUSES, "refunded"]),
    db.from("admin_audit_log").select("action, target_type, target_id, created_at, admin:profiles(display_name)").order("created_at", { ascending: false }).limit(10),
  ]);
  const o = orders30.data ?? [];
  const gmv = o.reduce((s, x) => s + x.total_cents - x.refunded_cents, 0);
  const commission = o
    .filter((x) => x.status !== "refunded")
    .reduce((s, x) => s + Math.round(x.platform_fee_cents * (1 - x.refunded_cents / Math.max(1, x.total_cents))), 0);

  return (
    <>
      <PageHeader title="Marketplace overview" subtitle="Last 30 days unless noted" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Orders (30d)" value={o.filter((x) => x.status !== "refunded").length} />
        <Stat label="Gross sales (30d)" value={formatMoney(gmv)} hint="Net of refunds" />
        <Stat label="Commission (30d)" value={formatMoney(commission)} hint="Before Stripe processing fees" />
        <Stat label="Drop-off fees (30d)" value={formatMoney(o.reduce((s, x) => s + x.dropoff_fee_cents, 0))} />
        <Stat label="Users" value={users} />
        <Stat label="Payout-ready sellers" value={sellers} />
        <Stat label="Live listings" value={live} />
        <Stat label="Awaiting approval" value={<Link href="/admin/listings" className="text-sky">{pending}</Link>} />
        <Stat label="Open reports" value={<Link href="/admin/reports" className="text-sky">{openReports}</Link>} />
        <Stat label="Open disputes" value={<Link href="/admin/orders?status=disputed" className={openDisputes ? "text-danger" : "text-sky"}>{openDisputes}</Link>} />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-bold">Recent admin activity</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th></tr></thead>
            <tbody>
              {(recentAudit.data ?? []).map((a, i) => (
                <tr key={i}>
                  <td className="text-muted">{formatDate(a.created_at, true)}</td>
                  <td>{(a.admin as unknown as { display_name: string } | null)?.display_name ?? "—"}</td>
                  <td className="font-mono text-xs">{a.action}</td>
                  <td className="font-mono text-xs">{a.target_type}:{String(a.target_id).slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
