import Link from "next/link";
import Image from "next/image";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatMoney, CONDITION_LABELS } from "@/lib/format";
import { listingImageUrl } from "@/lib/images";
import { ListingStatusBadge } from "@/components/StatusBadge";
import { EmptyState, PageHeader } from "@/components/ui";
import { ModerateListingForm } from "./ModerateListingForm";
import type { ListingStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
const STATUSES: ListingStatus[] = ["pending_review", "active", "reserved", "sold", "unavailable", "draft", "removed"];

export default async function AdminListings({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdmin();
  const { status: s, q } = await searchParams;
  const status = (STATUSES.includes(s as ListingStatus) ? s : "pending_review") as ListingStatus;
  const db = createAdminClient();
  let query = db
    .from("listings")
    .select("id, title, status, price_cents, condition, created_at, description, rejection_reason, seller:seller_profiles(shop_name, user_id, rating_avg, rating_count), listing_images(storage_path, sort_order)")
    .eq("status", status)
    .order("created_at", { ascending: status === "pending_review" })
    .limit(100);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;
  const rows = (data ?? []) as unknown as {
    id: string; title: string; status: ListingStatus; price_cents: number; condition: keyof typeof CONDITION_LABELS; created_at: string;
    description: string; rejection_reason: string | null;
    seller: { shop_name: string; user_id: string; rating_avg: number; rating_count: number } | null;
    listing_images: { storage_path: string; sort_order: number }[];
  }[];

  return (
    <>
      <PageHeader title="Listings" subtitle="Approve new listings and moderate existing ones." />
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((st) => (
          <Link key={st} href={`/admin/listings?status=${st}`} className={`chip ${st === status ? "border-ink bg-ink text-white" : ""}`}>
            <ListingStatusBadge status={st} />
          </Link>
        ))}
        <form className="ml-auto">
          <input type="hidden" name="status" value={status} />
          <input name="q" defaultValue={q} placeholder="Search title" className="input w-56" />
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Nothing here" body={status === "pending_review" ? "No listings are waiting for approval." : undefined} />
      ) : (
        <ul className="space-y-3">
          {rows.map((l) => {
            const imgs = [...l.listing_images].sort((a, b) => a.sort_order - b.sort_order);
            return (
              <li key={l.id} className="card grid gap-4 p-4 md:grid-cols-[220px_1fr_280px]">
                <div className="grid grid-cols-3 gap-1">
                  {imgs.slice(0, 6).map((i) => (
                    <div key={i.storage_path} className="relative aspect-square overflow-hidden rounded bg-ice">
                      <Image src={listingImageUrl(i.storage_path)!} alt="" fill sizes="70px" className="object-cover" />
                    </div>
                  ))}
                </div>
                <div className="min-w-0">
                  <Link href={`/listings/${l.id}`} className="font-bold text-sky" target="_blank">{l.title}</Link>
                  <p className="text-sm">{formatMoney(l.price_cents)} · {CONDITION_LABELS[l.condition]} · {formatDate(l.created_at)}</p>
                  <p className="text-sm text-muted">
                    Seller: <Link href={`/admin/users?q=${encodeURIComponent(l.seller?.shop_name ?? "")}`} className="underline">{l.seller?.shop_name}</Link>
                    {l.seller?.rating_count ? ` · ★ ${Number(l.seller.rating_avg).toFixed(1)} (${l.seller.rating_count})` : " · new seller"}
                  </p>
                  <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{l.description}</p>
                  {l.rejection_reason && <p className="mt-1 text-xs text-danger">Note: {l.rejection_reason}</p>}
                </div>
                <ModerateListingForm listingId={l.id} status={l.status} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
