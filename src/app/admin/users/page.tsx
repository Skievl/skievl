import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { setUserRole, setUserSuspended } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireAdmin();
  const { q } = await searchParams;
  const db = createAdminClient();
  let query = db
    .from("profiles")
    .select("id, display_name, role, is_suspended, created_at, seller:seller_profiles(shop_name, charges_enabled, rating_avg, rating_count, sales_count)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) query = query.ilike("display_name", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  let rows = (data ?? []) as unknown as {
    id: string; display_name: string; role: string; is_suspended: boolean; created_at: string;
    seller: { shop_name: string; charges_enabled: boolean; rating_avg: number; rating_count: number; sales_count: number } | null;
  }[];

  // Also match on shop name
  if (q) {
    const { data: shops } = await db.from("seller_profiles").select("user_id").ilike("shop_name", `%${q.replace(/[%_]/g, "")}%`).limit(50);
    const extra = (shops ?? []).map((s) => s.user_id).filter((id) => !rows.some((r) => r.id === id));
    if (extra.length) {
      const { data: more } = await db.from("profiles").select("id, display_name, role, is_suspended, created_at, seller:seller_profiles(shop_name, charges_enabled, rating_avg, rating_count, sales_count)").in("id", extra);
      rows = rows.concat((more ?? []) as unknown as typeof rows);
    }
  }

  // Emails come from Supabase Auth (service role only)
  const emails = new Map<string, string>();
  await Promise.all(
    rows.map(async (r) => {
      const { data: u } = await db.auth.admin.getUserById(r.id);
      if (u.user?.email) emails.set(r.id, u.user.email);
    }),
  );

  return (
    <>
      <PageHeader title="Users & sellers" />
      <form className="mb-4"><input name="q" defaultValue={q} placeholder="Search name or shop" className="input max-w-sm" /></form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>User</th><th>Seller</th><th>Joined</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <p className="font-semibold">{u.display_name} {u.role === "admin" && <span className="badge bg-ember text-white">admin</span>}</p>
                  <p className="text-xs text-muted">{emails.get(u.id) ?? "—"}</p>
                </td>
                <td className="text-xs">
                  {u.seller ? (
                    <>
                      <Link href={`/sellers/${u.id}`} className="font-semibold text-sky">{u.seller.shop_name}</Link>
                      <p className="text-muted">
                        {u.seller.charges_enabled ? "Payouts ✓" : "Payouts pending"} · {u.seller.sales_count} sales · ★ {Number(u.seller.rating_avg).toFixed(1)} ({u.seller.rating_count})
                      </p>
                    </>
                  ) : "—"}
                </td>
                <td className="text-muted">{formatDate(u.created_at)}</td>
                <td>{u.is_suspended ? <span className="badge bg-danger text-white">Suspended</span> : <span className="badge bg-pine-light text-pine">Active</span>}</td>
                <td className="space-x-2 text-right whitespace-nowrap">
                  {u.id !== session.user.id && (
                    <>
                      <form action={setUserSuspended.bind(null, u.id, !u.is_suspended)} className="inline">
                        <button className={u.is_suspended ? "btn-secondary btn-sm" : "btn-danger btn-sm"}>{u.is_suspended ? "Unsuspend" : "Suspend"}</button>
                      </form>
                      <form action={setUserRole.bind(null, u.id, u.role === "admin" ? "user" : "admin")} className="inline">
                        <button className="btn-ghost btn-sm">{u.role === "admin" ? "Revoke admin" : "Make admin"}</button>
                      </form>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
