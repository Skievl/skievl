import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getBrands, getCategories } from "@/lib/catalog";
import { parseSearch, toRpcArgs, PAGE_SIZE, type RawParams } from "@/lib/search";
import { toCardData } from "@/lib/cards";
import { ListingCard } from "@/components/ListingCard";
import { EmptyState, Pagination } from "@/components/ui";
import { FilterPanel } from "./FilterPanel";
import { SortSelect } from "./SortSelect";
import type { SearchResult } from "@/lib/types";

export async function generateMetadata({ searchParams }: { searchParams: Promise<RawParams> }): Promise<Metadata> {
  const params = await searchParams;
  const categories = await getCategories();
  const cat = categories.find((c) => c.slug === params.category);
  const q = typeof params.q === "string" ? params.q : "";
  const title = q ? `“${q}” — used gear` : cat ? `Used ${cat.name}` : "Browse used ski & snowboard gear";
  return { title, description: `${title} for sale in Ellicottville, NY. Local pickup or drop-off.` };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams;
  const [categories, brands] = await Promise.all([getCategories(), getBrands()]);
  const parsed = parseSearch(params, categories);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_listings", toRpcArgs(parsed));
  if (error) console.error("[search]", error);

  const rows = (data ?? []) as SearchResult[];
  const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const category = categories.find((c) => c.slug === parsed.category);

  const hrefFor = (page: number) => {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && k !== "page") usp.set(k, v);
    usp.set("page", String(page));
    return `/search?${usp}`;
  };

  return (
    <div className="container-page py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            {parsed.q ? <>Results for “{parsed.q}”</> : category ? `Used ${category.name}` : "All gear"}
          </h1>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {total} {total === 1 ? "item" : "items"} available in Ellicottville
          </p>
        </div>
        <Suspense>
          <SortSelect value={parsed.sort} hasQuery={Boolean(parsed.q)} />
        </Suspense>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <Suspense>
          <FilterPanel categories={categories} brands={brands} />
        </Suspense>
        <section aria-label="Results">
          {error ? (
            <EmptyState title="Search is temporarily unavailable" body="Please try again in a moment." />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No gear matches those filters"
              body="Try widening the size range or removing a filter. New gear is listed every day."
              action={{ href: "/search", label: "Clear filters" }}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {rows.map((r, i) => (
                  <ListingCard key={r.id} l={toCardData(r, categories)} priority={i < 3} />
                ))}
              </div>
              <Pagination page={parsed.page} totalPages={totalPages} hrefFor={hrefFor} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
