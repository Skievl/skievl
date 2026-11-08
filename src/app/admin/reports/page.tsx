import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { ResolveReportForm } from "./ResolveReportForm";

export const dynamic = "force-dynamic";

const TARGET_LINK: Record<string, (id: string) => string> = {
  listing: (id) => `/admin/listings?status=active&q=&id=${id}`,
  user: (id) => `/sellers/${id}`,
  review: () => `/admin/reviews`,
  message: () => `#`,
};

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = "open" } = await searchParams;
  const db = createAdminClient();
  const statuses = status === "closed" ? ["resolved", "dismissed"] : ["open", "reviewing"];
  const { data } = await db
    .from("reports")
    .select("*, reporter:profiles!reports_reporter_id_fkey(display_name)")
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .limit(100);

  // Resolve message bodies for message reports
  const msgIds = (data ?? []).filter((r) => r.target_type === "message").map((r) => r.target_id);
  const { data: msgs } = msgIds.length ? await db.from("messages").select("id, body").in("id", msgIds) : { data: [] };
  const msgBody = new Map((msgs ?? []).map((m) => [m.id, m.body]));

  return (
    <>
      <PageHeader title="Reports" subtitle="Listings, users, reviews and messages flagged by the community." />
      <div className="mb-4 flex gap-2">
        <Link href="/admin/reports" className={`chip ${status !== "closed" ? "border-ink bg-ink text-white" : ""}`}>Open</Link>
        <Link href="/admin/reports?status=closed" className={`chip ${status === "closed" ? "border-ink bg-ink text-white" : ""}`}>Closed</Link>
      </div>
      {(data ?? []).length === 0 ? (
        <EmptyState title="No reports" />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((r) => (
            <li key={r.id} className="card grid gap-4 p-4 md:grid-cols-[1fr_300px]">
              <div className="text-sm">
                <p>
                  <span className="badge bg-danger-light text-danger">{r.reason.replace(/_/g, " ")}</span>{" "}
                  <span className="font-semibold capitalize">{r.target_type}</span>{" "}
                  {r.target_type === "listing" ? (
                    <Link href={`/listings/${r.target_id}`} target="_blank" className="text-sky">view listing</Link>
                  ) : r.target_type === "user" ? (
                    <Link href={TARGET_LINK.user(r.target_id)} target="_blank" className="text-sky">view profile</Link>
                  ) : r.target_type === "review" ? (
                    <Link href="/admin/reviews" className="text-sky">review moderation</Link>
                  ) : null}
                </p>
                {r.target_type === "message" && <p className="mt-2 rounded bg-ice p-2 text-xs">“{msgBody.get(r.target_id) ?? "(deleted)"}”</p>}
                {r.details && <p className="mt-2 text-ink-soft">{r.details}</p>}
                <p className="mt-2 text-xs text-muted">
                  by {(r.reporter as { display_name: string } | null)?.display_name} · {formatDate(r.created_at, true)} · {r.status}
                </p>
                {r.resolution_note && <p className="mt-1 text-xs">Resolution: {r.resolution_note}</p>}
              </div>
              {status !== "closed" && <ResolveReportForm reportId={r.id} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
