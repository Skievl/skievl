"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function SearchBar({ compact = false, autoFocus = false }: { compact?: boolean; autoFocus?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const usp = new URLSearchParams();
    if (q.trim()) usp.set("q", q.trim());
    router.push(`/search${usp.size ? `?${usp}` : ""}`);
  }

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <label htmlFor={compact ? "q-compact" : "q-hero"} className="sr-only">
        Search gear
      </label>
      <svg viewBox="0 0 24 24" className={`pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted ${compact ? "h-4 w-4" : "h-5 w-5"}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
      </svg>
      <input
        id={compact ? "q-compact" : "q-hero"}
        type="search"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)}
        placeholder={compact ? "Search skis, boards, boots, brands…" : "Try “Völkl Mantra 177” or “kids helmet”"}
        className={
          compact
            ? "input rounded-full bg-snow pl-10"
            : "w-full rounded-xl border-0 bg-white py-4 pr-32 pl-12 text-base text-ink shadow-xl ring-1 ring-black/5 placeholder:text-muted focus:ring-2 focus:ring-ember focus:outline-none"
        }
      />
      {!compact && (
        <button type="submit" className="btn-primary absolute top-1/2 right-2 -translate-y-1/2">
          Search
        </button>
      )}
    </form>
  );
}
