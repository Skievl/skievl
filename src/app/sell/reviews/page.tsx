import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { StarRating } from "@/components/StarRating";
import { EmptyState, PageHeader } from "@/components/ui";
import { ReportButton } from "@/components/ReportButton";
import { ResponseForm } from "./ResponseForm";

export const metadata = { title: "My reviews" };

export default async function SellerReviewsPage() {
  const { seller } = await requireSeller();
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id, rating_overall, rating_communication, rating_accuracy, rating_transaction, body, status, created_at, buyer:profiles!reviews_buyer_id_fkey(display_name), seller_responses(body)")
    .eq("seller_id", seller.user_id)
    .order("created_at", { ascending: false });
  const reviews = (data ?? []) as unknown as {
    id: string; rating_overall: number; rating_communication: number; rating_accuracy: number; rating_transaction: number;
    body: string; status: string; created_at: string; buyer: { display_name: string } | null;
    seller_responses: { body: string }[] | { body: string } | null;
  }[];

  return (
    <>
      <PageHeader title="Reviews" subtitle="Respond publicly to thank buyers or add context." />
      {reviews.length === 0 ? (
        <EmptyState title="No reviews yet" body="Buyers can review you after they confirm an order is complete." />
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => {
            const resp = Array.isArray(r.seller_responses) ? r.seller_responses[0] : r.seller_responses;
            return (
              <li key={r.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <StarRating value={r.rating_overall} />
                  <span className="text-xs text-muted">{r.buyer?.display_name} · {formatDate(r.created_at)}</span>
                  {r.status !== "published" && <span className="badge bg-line text-ink-soft">Hidden by moderators</span>}
                </div>
                <p className="mt-1 text-xs text-muted">
                  Communication {r.rating_communication}/5 · Accuracy {r.rating_accuracy}/5 · Transaction {r.rating_transaction}/5
                </p>
                <p className="mt-2 text-sm whitespace-pre-line">{r.body}</p>
                <div className="mt-4 border-t border-line pt-4">
                  <ResponseForm reviewId={r.id} existing={resp?.body ?? ""} />
                </div>
                <div className="mt-2 text-right"><ReportButton targetType="review" targetId={r.id} label="Report as abusive or fake" /></div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
