import Link from "next/link";
import Image from "next/image";
import { formatMoney, CONDITION_LABELS } from "@/lib/format";
import { listingImageUrl } from "@/lib/images";
import { StarRating } from "@/components/StarRating";
import type { ItemCondition } from "@/lib/types";

export interface ListingCardData {
  id: string;
  title: string;
  price_cents: number;
  condition: ItemCondition;
  brand_name: string | null;
  size_label?: string | null;
  cover_image: string | null;
  seller_name?: string;
  seller_rating?: number;
  seller_rating_count?: number;
  offers_dropoff?: boolean;
  status_badge?: string;
}

export function ListingCard({ l, priority = false }: { l: ListingCardData; priority?: boolean }) {
  const img = listingImageUrl(l.cover_image);
  return (
    <Link href={`/listings/${l.id}`} className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[4/3] bg-ice">
        {img ? (
          <Image
            src={img}
            alt={l.title}
            fill
            priority={priority}
            sizes="(min-width:1280px) 300px, (min-width:768px) 33vw, 50vw"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">No photo</div>
        )}
        <span className="badge absolute top-2 left-2 bg-white/95 text-ink shadow-sm">{CONDITION_LABELS[l.condition]}</span>
        {l.status_badge && <span className="badge absolute top-2 right-2 bg-ink text-white">{l.status_badge}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
          {[l.brand_name, l.size_label].filter(Boolean).join(" · ") || " "}
        </p>
        <h3 className="line-clamp-2 text-sm font-semibold text-ink">{l.title}</h3>
        <div className="mt-auto flex items-end justify-between pt-2">
          <span className="text-lg font-bold">{formatMoney(l.price_cents, { whole: true })}</span>
          {l.offers_dropoff && <span className="text-[11px] font-medium text-pine">Drop-off available</span>}
        </div>
        {l.seller_name && (
          <div className="flex items-center gap-1.5 border-t border-line pt-2 text-xs text-muted">
            <span className="truncate">{l.seller_name}</span>
            {l.seller_rating_count ? (
              <StarRating value={l.seller_rating ?? 0} count={l.seller_rating_count} size="xs" />
            ) : (
              <span className="text-[11px]">New seller</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
