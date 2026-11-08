import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { StarRating } from "@/components/StarRating";
import { PageHeader } from "@/components/ui";
import { moderateReview, setResponseHidden } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminReviews({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = "published" } = await searchParams;
  const db = createAdminClient();
  const { data } = await db
    .from("reviews")
    .select("id, rating_overall, body, status, moderation_note, created_at, order_id, buyer:profiles!reviews_buyer_id_fkey(display_name), seller:seller_profiles(shop_name, user_id), seller_responses(body, is_hidden)")
    .eq("status", ["published", "hidden", "removed"].includes(status) ? status : "published")
    .order("created_at", { ascending: false })
    .limit(100);
  const { data: reported } = await db.from("reports").select("target_id").eq("target_type", "review").in("status", ["open", "reviewing"]);
  const reportedIds = new Set((reported ?? []).map((r) => r.target_id));
  const rows = (data ?? []) as unknown as {
    id: string; rating_overall: number; body: string; status: string; moderation_note: string | null; created_at: string; order_id: string;
    buyer: { display_name: string } | null; seller: { shop_name: string; user_id: string } | null;
    seller_responses: { body: string; is_hidden: boolean }[] | { body: string; is_hidden: boolean } | null;
  }[];

  return (
    <>
      <PageHeader title="Review moderation" subtitle="Hide or remove abusive or fraudulent reviews. Reported reviews are flagged." />
      <div className="mb-4 flex gap-2">
        {["published", "hidden", "removed"].map((s) => (
          <Link key={s} href={`/admin/reviews?status=${s}`} className={`chip capitalize ${s === status ? "border-ink bg-ink text-white" : ""}`}>{s}</Link>
        ))}
      </div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const resp = Array.isArray(r.seller_responses) ? r.seller_responses[0] : r.seller_responses;
          return (
            <li key={r.id} className={`card p-4 ${reportedIds.has(r.id) ? "border-danger" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <StarRating value={r.rating_overall} size="xs" />
                <span>{r.buyer?.display_name} → <Link href={`/sellers/${r.seller?.user_id}`} className="text-sky">{r.seller?.shop_name}</Link></span>
                <span className="text-xs text-muted">{formatDate(r.created_at)}</span>
                <Link href={`/admin/orders?id=${r.order_id}`} className="text-xs text-sky">order</Link>
                {reportedIds.has(r.id) && <span className="badge bg-danger text-white">Reported</span>}
              </div>
              <p className="mt-2 text-sm whitespace-pre-line">{r.body}</p>
              {resp && (
                <p className="mt-2 rounded bg-ice p-2 text-xs">
                  <strong>Seller response{resp.is_hidden ? " (hidden)" : ""}:</strong> {resp.body}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {r.status !== "published" && <form action={moderateReview.bind(null, r.id, "published", undefined)}><button className="btn-secondary btn-sm">Restore</button></form>}
                {r.status !== "hidden" && <form action={moderateReview.bind(null, r.id, "hidden", "Hidden pending review")}><button className="btn-secondary btn-sm">Hide</button></form>}
                {r.status !== "removed" && <form action={moderateReview.bind(null, r.id, "removed", "Violates review policy")}><button className="btn-danger btn-sm">Remove</button></form>}
                {resp && <form action={setResponseHidden.bind(null, r.id, !resp.is_hidden)}><button className="btn-ghost btn-sm">{resp.is_hidden ? "Show response" : "Hide response"}</button></form>}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
