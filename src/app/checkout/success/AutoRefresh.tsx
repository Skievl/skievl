"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Polls while the Stripe webhook confirms payment. */
export function AutoRefresh({ everyMs = 2500, maxTries = 12 }: { everyMs?: number; maxTries?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      if (++n > maxTries) return clearInterval(t);
      router.refresh();
    }, everyMs);
    return () => clearInterval(t);
  }, [router, everyMs, maxTries]);
  return null;
}
