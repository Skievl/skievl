import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/catalog";
import { getSession } from "@/lib/auth";
import { toCardData } from "@/lib/cards";
import { formatDate } from "@/lib/format";
import { ListingCard } from "@/components/ListingCard";
import { StarRating } from "@/components/StarRating";
import { ReportButton } from "@/components/ReportButton";
import { EmptyState } from "@/components/ui";
import type { SearchResult, SellerProfile } from "@/lib/types";

interface ReviewRow {
  id: string;
  rating_overall: number;
  rating_communication: number;
  rating_accuracy: number;
  rating_transaction: number;
  body: string;
  created_at: string;
  buyer: { display_name: string } | null;
  seller_responses: { body: string; created_at: string; is_hidden: boolean }[] | { body: string; created_at: string; is_hidden: boolean } | null;
}

async function loadSeller(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("seller_profiles").select("*").eq("user_id", id).maybeSingle();
  return data as SellerProfile | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const seller = await loadSeller((await params).id);
  return { title: seller ? `${seller.shop_name} — seller on the Exchange` : "Seller not found" };
}

export default async function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const seller = await loadSeller(id);
  if (!seller) notFound();

  const supabase = await createClient();
  const [categories, session, listings, reviewsRes] = await Promise.all([
    getCategories(),
    getSession(),
    supabase.rpc("search_listings", { p_seller: id, p_sort: "newest", p_limit: 60 }),
    supabase
      .from("reviews")
      .select("id, rating_overall, rating_communication, rating_accuracy, rating_transaction, body, created_at, buyer:profiles!reviews_buyer_id_fkey(display_name), seller_responses(body, created_at, is_hidden)")
      .eq("seller_id", id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const reviews = (reviewsRes.data ?? []) as unknown as ReviewRow[];
  const avg = (k: keyof ReviewRow) =>
    reviews.length ? reviews.reduce((s, r) => s + Number(r[k]), 0) / reviews.length : 0;

  return (
    <div className="container-page py-10">
      <div className="card flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">{seller.shop_name}</h1>
          <p className="mt-1 text-sm text-muted">
            {seller.town} · Selling since {formatDate(seller.created_at)} · {seller.sales_count} {seller.sales_count === 1 ? "sale" : "sales"}
          </p>
          {seller.bio && <p className="mt-3 max-w-2xl text-sm whitespace-pre-line text-ink-soft">{seller.bio}</p>}
          {session && session.user.id !== id && <div className="mt-3"><ReportButton targetType="user" targetId={id} label="Report seller" /></div>}
        </div>
        <div className="shrink-0 rounded-xl bg-ice p-5 text-center">
          {seller.rating_count > 0 ? (
            <>
              <p className="text-4xl font-extrabold">{Number(seller.rating_avg).toFixed(1)}</p>
              <StarRating value={Number(seller.rating_avg)} size="sm" />
              <p className="mt-1 text-xs text-muted">{seller.rating_count} verified {seller.rating_count === 1 ? "review" : "reviews"}</p>
            </>
          ) : (
            <p className="text-sm text-muted">No reviews yet</p>
          )}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold">Gear for sale</h2>
        {(listings.data ?? []).length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {((listings.data ?? []) as SearchResult[]).map((r) => (
              <ListingCard key={r.id} l={{ ...toCardData(r, categories), seller_name: undefined }} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nothing listed right now" body="Check back soon — sellers add gear all season." />
        )}
      </section>

      <section className="mt-12" id="reviews">
        <h2 className="mb-4 text-xl font-bold">Seller reviews</h2>
        {reviews.length > 0 && (
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {([["Communication", "rating_communication"], ["Accuracy of listing", "rating_accuracy"], ["Transaction experience", "rating_transaction"]] as const).map(([label, k]) => (
              <div key={k} className="card flex items-center justify-between p-4">
                <span className="text-sm font-medium">{label}</span>
                <StarRating value={avg(k)} size="xs" />
              </div>
            ))}
          </div>
        )}
        {reviews.length === 0 ? (
          <p className="text-sm text-muted">Reviews appear here after buyers complete a purchase.</p>
        ) : (
          <ul className="space-y-4">
            {reviews.map((r) => {
              const resp = Array.isArray(r.seller_responses) ? r.seller_responses[0] : r.seller_responses;
              return (
                <li key={r.id} className="card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating value={r.rating_overall} size="sm" />
                    <span className="badge bg-pine-light text-pine">✓ Verified purchase</span>
                    <span className="text-xs text-muted">{r.buyer?.display_name ?? "Buyer"} · {formatDate(r.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-line text-ink-soft">{r.body}</p>
                  {resp && !resp.is_hidden && (
                    <div className="mt-3 rounded-lg border-l-4 border-sky bg-ice p-3 text-sm">
                      <p className="text-xs font-semibold text-ink">Response from {seller.shop_name}</p>
                      <p className="mt-1 whitespace-pre-line text-ink-soft">{resp.body}</p>
                    </div>
                  )}
                  {session && (
                    <div className="mt-2 text-right"><ReportButton targetType="review" targetId={r.id} label="Report review" /></div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
