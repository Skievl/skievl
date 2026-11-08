import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getCategoryById, getSettings } from "@/lib/catalog";
import { listingImageUrl } from "@/lib/images";
import { formatAttribute } from "@/lib/sizes";
import { AGE_GROUP_LABELS, CONDITION_HELP, CONDITION_LABELS, GENDER_LABELS, formatDate, formatMoney, timeAgo } from "@/lib/format";
import { ImageGallery } from "@/components/ImageGallery";
import { FavoriteButton } from "@/components/FavoriteButton";
import { StarRating } from "@/components/StarRating";
import { ListingStatusBadge } from "@/components/StatusBadge";
import { Notice } from "@/components/ui";
import { BuyBox } from "./BuyBox";
import { ReportButton } from "@/components/ReportButton";
import { startConversation } from "@/app/actions/messages";
import type { Listing, ListingImage, SellerProfile } from "@/lib/types";

type FullListing = Listing & {
  brand: { name: string } | null;
  listing_images: ListingImage[];
  seller: SellerProfile;
};

async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("*, brand:brands(name), listing_images(*), seller:seller_profiles(*)")
    .eq("id", id)
    .maybeSingle();
  return data as FullListing | null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const listing = await load((await params).id);
  if (!listing) return { title: "Listing not found" };
  const img = listingImageUrl([...listing.listing_images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path);
  return {
    title: `${listing.title} — ${formatMoney(listing.price_cents, { whole: true })}`,
    description: `${CONDITION_LABELS[listing.condition]} condition. ${listing.description.slice(0, 140)}`,
    openGraph: img ? { images: [img] } : undefined,
  };
}

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ checkout?: string }> }) {
  const { id } = await params;
  const { checkout } = await searchParams;
  const listing = await load(id);
  if (!listing) notFound();

  const supabase = await createClient();
  const [session, category, settings, zips, reviews] = await Promise.all([
    getSession(),
    getCategoryById(listing.category_id),
    getSettings(),
    supabase.from("dropoff_areas").select("postal_code, label").eq("seller_id", listing.seller_id).order("postal_code"),
    supabase
      .from("reviews")
      .select("id, rating_overall, body, created_at")
      .eq("seller_id", listing.seller_id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  let isFavorite = false;
  let iHoldIt = false; // current user is mid-checkout on this item
  if (session) {
    const [{ data: fav }, { data: hold }] = await Promise.all([
      supabase.from("favorites").select("listing_id").eq("listing_id", id).maybeSingle(),
      listing.status === "reserved"
        ? supabase.from("orders").select("id").eq("listing_id", id).eq("buyer_id", session.user.id).eq("status", "pending_payment").maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    isFavorite = Boolean(fav);
    iHoldIt = Boolean(hold);
  }

  const images = [...listing.listing_images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => listingImageUrl(i.storage_path)!)
    .filter(Boolean);
  const isOwner = session?.user.id === listing.seller_id;
  const brand = listing.brand?.name ?? listing.brand_other;
  const specs: [string, string][] = [
    ["Category", category?.name ?? "—"],
    ...(brand ? [["Brand", brand] as [string, string]] : []),
    ...(listing.model ? [["Model", listing.model] as [string, string]] : []),
    ...(listing.model_year ? [["Year", String(listing.model_year)] as [string, string]] : []),
    ...(listing.gender ? [["Gender", GENDER_LABELS[listing.gender]] as [string, string]] : []),
    ...(listing.age_group ? [["Age group", AGE_GROUP_LABELS[listing.age_group]] as [string, string]] : []),
    ...(category?.attribute_definitions ?? [])
      .filter((d) => listing.attributes[d.key] !== undefined)
      .map((d) => [d.label, formatAttribute(d, listing.attributes[d.key])] as [string, string]),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    brand: brand ? { "@type": "Brand", name: brand } : undefined,
    image: images,
    description: listing.description,
    offers: {
      "@type": "Offer",
      price: (listing.price_cents / 100).toFixed(2),
      priceCurrency: "USD",
      itemCondition: listing.condition === "new" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
      availability: listing.status === "active" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
    },
  };

  return (
    <div className="container-page py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav className="mb-4 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/search" className="hover:text-ink">Gear</Link>
        {category && (
          <>
            {" / "}
            <Link href={`/search?category=${category.slug}`} className="hover:text-ink">{category.name}</Link>
          </>
        )}
      </nav>

      {checkout === "cancelled" && (
        <div className="mb-4"><Notice tone="info">Checkout was cancelled — you haven&apos;t been charged.</Notice></div>
      )}
      {isOwner && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Notice tone="info">
            This is your listing. Status: <ListingStatusBadge status={listing.status} />
            {listing.rejection_reason && <> — {listing.rejection_reason}</>}
          </Notice>
          <Link href={`/sell/listings/${listing.id}`} className="btn-secondary">Edit listing</Link>
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <ImageGallery images={images} alt={listing.title} />

          <section className="mt-8">
            <h2 className="text-lg font-bold">Details</h2>
            <dl className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              {specs.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line py-2 text-sm">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-bold">Condition: {CONDITION_LABELS[listing.condition]}</h2>
            <p className="mt-1 text-sm text-muted">{CONDITION_HELP[listing.condition]}</p>
            {listing.condition_notes && <p className="mt-3 rounded-lg bg-ice p-3 text-sm whitespace-pre-line">{listing.condition_notes}</p>}
          </section>

          {listing.description && (
            <section className="mt-8">
              <h2 className="text-lg font-bold">Description</h2>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink-soft">{listing.description}</p>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{brand ?? category?.name}</p>
            <h1 className="mt-1 text-2xl font-extrabold">{listing.title}</h1>
            <p className="mt-3 text-3xl font-extrabold">{formatMoney(listing.price_cents, { whole: true })}</p>
            <p className="mt-1 text-xs text-muted">Listed {timeAgo(listing.published_at ?? listing.created_at)}</p>

            <div className="mt-5">
              {(listing.status === "active" || iHoldIt) && !isOwner ? (
                <BuyBox
                  listingId={listing.id}
                  priceCents={listing.price_cents}
                  offersPickup={listing.offers_pickup}
                  offersDropoff={listing.offers_dropoff}
                  dropoffFeeCents={listing.dropoff_fee_cents}
                  dropoffZips={(zips.data ?? []).map((z) => z.postal_code)}
                  signedIn={Boolean(session)}
                  sellerTown={listing.seller.town}
                />
              ) : listing.status === "reserved" ? (
                <Notice tone="warn">Someone is checking out with this item right now. Check back shortly.</Notice>
              ) : listing.status === "sold" ? (
                <Notice tone="info">This item has sold.</Notice>
              ) : !isOwner ? (
                <Notice tone="info">This item isn&apos;t available right now.</Notice>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2">
              {!isOwner && <FavoriteButton listingId={listing.id} initial={isFavorite} signedIn={Boolean(session)} />}
              {!isOwner && listing.status !== "sold" && (
                session ? (
                  <form action={startConversation.bind(null, listing.id)} className="flex-1">
                    <button className="btn-secondary w-full">Message seller</button>
                  </form>
                ) : (
                  <Link href={`/login?next=/listings/${listing.id}`} className="btn-secondary flex-1">Message seller</Link>
                )
              )}
            </div>
          </div>

          <div className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">Sold by</p>
            <Link href={`/sellers/${listing.seller_id}`} className="mt-1 block text-lg font-bold hover:text-sky">
              {listing.seller.shop_name}
            </Link>
            <p className="text-sm text-muted">{listing.seller.town} · Member since {formatDate(listing.seller.created_at)}</p>
            <div className="mt-2">
              {listing.seller.rating_count > 0 ? (
                <StarRating value={Number(listing.seller.rating_avg)} count={listing.seller.rating_count} />
              ) : (
                <span className="text-sm text-muted">No reviews yet</span>
              )}
              {listing.seller.sales_count > 0 && <span className="ml-2 text-xs text-muted">{listing.seller.sales_count} sales</span>}
            </div>
            {(reviews.data ?? []).length > 0 && (
              <ul className="mt-4 space-y-3 border-t border-line pt-4">
                {(reviews.data ?? []).map((r) => (
                  <li key={r.id} className="text-sm">
                    <StarRating value={r.rating_overall} size="xs" />
                    <span className="ml-2 badge bg-pine-light text-pine">Verified purchase</span>
                    <p className="mt-1 line-clamp-3 text-ink-soft">{r.body}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/sellers/${listing.seller_id}`} className="mt-4 inline-block text-sm font-semibold text-sky">
              View seller profile →
            </Link>
          </div>

          <div className="rounded-[var(--radius-card)] bg-ice p-4 text-xs leading-relaxed text-ink-soft">
            <p className="font-semibold text-ink">Buy with confidence</p>
            <p className="mt-1">
              Pay through SKIEVL — never by cash app or wire. The seller&apos;s pickup address is shared only after payment.
              Meet in a public, well-lit place when you can. Marketplace fee is paid by the seller ({(settings.commission_bps / 100).toFixed(0)}%).
            </p>
          </div>
          {session && !isOwner && (
            <div className="text-right">
              <ReportButton targetType="listing" targetId={listing.id} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
