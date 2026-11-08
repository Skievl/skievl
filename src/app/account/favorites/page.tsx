import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/catalog";
import { sizeLabel } from "@/lib/sizes";
import { LISTING_STATUS_LABELS } from "@/lib/format";
import { ListingCard } from "@/components/ListingCard";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Listing, ListingImage } from "@/lib/types";

export const metadata = { title: "Saved gear" };

type Row = { listing: (Listing & { brand: { name: string } | null; listing_images: ListingImage[] }) | null };

export default async function FavoritesPage() {
  const { user } = await requireUser("/account/favorites");
  const supabase = await createClient();
  const [categories, { data }] = await Promise.all([
    getCategories(),
    supabase
      .from("favorites")
      .select("listing:listings(*, brand:brands(name), listing_images(storage_path, sort_order))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  const listings = ((data ?? []) as unknown as Row[]).map((r) => r.listing).filter((l): l is NonNullable<Row["listing"]> => Boolean(l));

  return (
    <>
      <PageHeader title="Saved gear" subtitle="Items you've favorited. Sold items stay here for reference." />
      {listings.length === 0 ? (
        <EmptyState title="Nothing saved yet" body="Tap Save on any listing to keep an eye on it." action={{ href: "/search", label: "Browse gear" }} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {listings.map((l) => {
            const cat = categories.find((c) => c.id === l.category_id);
            const cover = [...l.listing_images].sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path ?? null;
            return (
              <ListingCard
                key={l.id}
                l={{
                  id: l.id,
                  title: l.title,
                  price_cents: l.price_cents,
                  condition: l.condition,
                  brand_name: l.brand?.name ?? l.brand_other,
                  size_label: cat ? sizeLabel(cat.attribute_definitions, l.attributes) : null,
                  cover_image: cover,
                  offers_dropoff: l.offers_dropoff,
                  status_badge: l.status !== "active" ? LISTING_STATUS_LABELS[l.status] : undefined,
                }}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
