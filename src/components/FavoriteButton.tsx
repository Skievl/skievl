"use client";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavorite } from "@/app/actions/favorites";

export function FavoriteButton({
  listingId,
  initial,
  signedIn,
}: {
  listingId: string;
  initial: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [fav, setFav] = useOptimistic(initial);

  return (
    <button
      type="button"
      className="btn-secondary"
      aria-pressed={fav}
      disabled={pending}
      onClick={() => {
        if (!signedIn) return router.push(`/login?next=/listings/${listingId}`);
        start(async () => {
          setFav(!fav);
          await toggleFavorite(listingId);
          router.refresh();
        });
      }}
    >
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${fav ? "fill-ember text-ember" : "fill-none"}`} stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2 0 3.4 1.1 4.2 2.4h2C13.8 6.1 15.2 5 17.2 5c3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z" strokeLinejoin="round" />
      </svg>
      {fav ? "Saved" : "Save"}
    </button>
  );
}
