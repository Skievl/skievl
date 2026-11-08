"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { SORTS, type SortKey } from "@/lib/search";

export function SortSelect({ value, hasQuery }: { value: SortKey; hasQuery: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Sort</span>
      <select
        className="input w-auto"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("sort", e.target.value);
          next.delete("page");
          router.push(`/search?${next}`);
        }}
      >
        {(Object.entries(SORTS) as [SortKey, string][])
          .filter(([k]) => hasQuery || k !== "relevance")
          .map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
      </select>
    </label>
  );
}
