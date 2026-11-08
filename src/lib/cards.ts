import { sizeLabel } from "@/lib/sizes";
import type { Category, SearchResult } from "@/lib/types";
import type { ListingCardData } from "@/components/ListingCard";

export function toCardData(r: SearchResult, categories: Category[]): ListingCardData {
  const cat = categories.find((c) => c.slug === r.category_slug);
  return {
    id: r.id,
    title: r.title,
    price_cents: r.price_cents,
    condition: r.condition,
    brand_name: r.brand_name,
    size_label: cat ? sizeLabel(cat.attribute_definitions, r.attributes) : null,
    cover_image: r.cover_image,
    seller_name: r.seller_name,
    seller_rating: Number(r.seller_rating),
    seller_rating_count: r.seller_rating_count,
    offers_dropoff: r.offers_dropoff,
  };
}
