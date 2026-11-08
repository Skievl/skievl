import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBrands, getCategories, getSettings } from "@/lib/catalog";
import { ListingStatusBadge } from "@/components/StatusBadge";
import { Notice } from "@/components/ui";
import { ListingForm } from "../ListingForm";
import { PhotoManager } from "../PhotoManager";
import { PublishPanel } from "./PublishPanel";
import type { Listing } from "@/lib/types";

export const metadata = { title: "Edit listing" };

export default async function EditListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { id } = await params;
  const { created } = await searchParams;
  const { seller, user } = await requireSeller();
  const supabase = await createClient();
  const { data } = await supabase.from("listings").select("*").eq("id", id).eq("seller_id", seller.user_id).maybeSingle();
  if (!data) notFound();
  const listing = data as Listing;

  const [categories, brands, settings, images, zips, priv] = await Promise.all([
    getCategories(),
    getBrands(),
    getSettings(),
    supabase.from("listing_images").select("id, storage_path, sort_order").eq("listing_id", id).order("sort_order"),
    supabase.from("dropoff_areas").select("id", { count: "exact", head: true }).eq("seller_id", seller.user_id),
    supabase.from("seller_private").select("user_id").maybeSingle(),
  ]);
  const locked = ["reserved", "sold", "removed"].includes(listing.status);
  const photoCount = images.data?.length ?? 0;

  const checklist = [
    { done: seller.charges_enabled, label: "Payouts set up", href: "/sell/setup#payouts" },
    { done: photoCount > 0, label: "At least one photo" },
    { done: !listing.offers_pickup || Boolean(priv.data), label: "Private pickup address", href: "/sell/setup#pickup" },
    { done: !listing.offers_dropoff || (zips.count ?? 0) > 0, label: "Drop-off ZIP codes", href: "/sell/setup#dropoff" },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold">{listing.title}</h1>
          <ListingStatusBadge status={listing.status} />
        </div>
        {created && <Notice tone="success">Draft saved! Now add photos, then publish.</Notice>}
        {listing.rejection_reason && listing.status === "draft" && (
          <Notice tone="error">Not approved: {listing.rejection_reason}. Update the listing and submit again.</Notice>
        )}
        {locked && <Notice tone="info">This listing is {listing.status} and can no longer be edited.</Notice>}

        <section className="card p-6" id="photos">
          <h2 className="mb-4 text-lg font-bold">Photos</h2>
          <PhotoManager userId={user.id} listingId={listing.id} images={images.data ?? []} locked={locked} />
        </section>

        {!locked && <ListingForm categories={categories} brands={brands} listing={listing} hasDropoffArea={(zips.count ?? 0) > 0} />}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card p-5">
          <h2 className="font-bold">Ready to publish?</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2">
                <span className={c.done ? "text-pine" : "text-muted"}>{c.done ? "✓" : "○"}</span>
                {c.done || !c.href ? c.label : <Link href={c.href} className="text-sky underline">{c.label}</Link>}
              </li>
            ))}
          </ul>
          {!locked && (
            <div className="mt-4">
              <PublishPanel listingId={listing.id} status={listing.status} ready={checklist.every((c) => c.done)} requiresApproval={settings.require_listing_approval && !listing.approved_at} />
            </div>
          )}
        </div>
        <Link href={`/listings/${listing.id}`} className="btn-secondary w-full">Preview listing</Link>
      </aside>
    </div>
  );
}
