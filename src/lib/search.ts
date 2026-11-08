import type { AgeGroup, Category, FulfillmentMethod, Gender, ItemCondition } from "@/lib/types";

/**
 * URL format (shareable, bookmarkable):
 *   /search?q=pocket+rocket&category=skis&gender=mens,unisex&age=adult
 *          &brand=rossignol,k2&condition=good,like_new&min=100&max=400
 *          &fulfillment=dropoff&rating=4.5&sort=price_asc&page=2
 *          &a.ski_type=powder,park        (enum / boolean attributes)
 *          &r.length_cm=165-179           (numeric ranges; boot_size in Mondo)
 */
export type RawParams = Record<string, string | string[] | undefined>;

export const SORTS = {
  relevance: "Best match",
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
} as const;
export type SortKey = keyof typeof SORTS;

const GENDERS: Gender[] = ["mens", "womens", "unisex"];
const AGES: AgeGroup[] = ["adult", "youth", "kids", "toddler"];
const CONDITIONS: ItemCondition[] = ["new", "like_new", "good", "fair"];
export const PAGE_SIZE = 24;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const list = (v: string | string[] | undefined) =>
  one(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const num = (v: string | string[] | undefined) => {
  const n = Number(one(v));
  return one(v) !== "" && Number.isFinite(n) ? n : undefined;
};

export interface ParsedSearch {
  q: string;
  category: string | null;
  genders: Gender[];
  ages: AgeGroup[];
  brands: string[];
  conditions: ItemCondition[];
  min?: number;
  max?: number;
  fulfillment: FulfillmentMethod | null;
  rating?: number;
  sort: SortKey;
  page: number;
  attrIn: Record<string, (string | boolean)[]>;
  attrRange: Record<string, { min?: number; max?: number }>;
}

export function parseSearch(params: RawParams, categories: Category[]): ParsedSearch {
  const categorySlug = one(params.category) || null;
  const category = categories.find((c) => c.slug === categorySlug) ?? null;
  const defs = category?.attribute_definitions ?? [];

  const attrIn: ParsedSearch["attrIn"] = {};
  const attrRange: ParsedSearch["attrRange"] = {};
  for (const def of defs) {
    if (!def.is_filterable) continue;
    if (def.data_type === "enum") {
      const allowed = new Set(def.options?.map((o) => o.value));
      const vals = list(params[`a.${def.key}`]).filter((v) => allowed.has(v));
      if (vals.length) attrIn[def.key] = vals;
    } else if (def.data_type === "boolean") {
      const v = one(params[`a.${def.key}`]);
      if (v === "true" || v === "false") attrIn[def.key] = [v === "true"];
    } else {
      const [lo, hi] = one(params[`r.${def.key}`]).split("-");
      const min = lo ? Number(lo) : undefined;
      const max = hi ? Number(hi) : undefined;
      const r: { min?: number; max?: number } = {};
      if (min !== undefined && Number.isFinite(min)) r.min = min;
      if (max !== undefined && Number.isFinite(max)) r.max = max;
      if (r.min !== undefined || r.max !== undefined) attrRange[def.key] = r;
    }
  }

  const sortRaw = one(params.sort) as SortKey;
  const q = one(params.q).slice(0, 100);
  const rating = num(params.rating);
  const fulfillment = one(params.fulfillment);

  return {
    q,
    category: category?.slug ?? null,
    genders: list(params.gender).filter((g): g is Gender => GENDERS.includes(g as Gender)),
    ages: list(params.age).filter((a): a is AgeGroup => AGES.includes(a as AgeGroup)),
    brands: list(params.brand).slice(0, 20),
    conditions: list(params.condition).filter((c): c is ItemCondition => CONDITIONS.includes(c as ItemCondition)),
    min: num(params.min),
    max: num(params.max),
    fulfillment: fulfillment === "pickup" || fulfillment === "dropoff" ? fulfillment : null,
    rating: rating === 4 || rating === 4.5 ? rating : undefined,
    sort: sortRaw in SORTS ? sortRaw : q ? "relevance" : "newest",
    page: Math.max(1, Math.min(100, Math.floor(num(params.page) ?? 1))),
    attrIn,
    attrRange,
  };
}

/** Arguments for the search_listings RPC. */
export function toRpcArgs(s: ParsedSearch) {
  return {
    p_q: s.q || null,
    p_category: s.category,
    p_genders: s.genders.length ? s.genders : null,
    p_age_groups: s.ages.length ? s.ages : null,
    p_brands: s.brands.length ? s.brands : null,
    p_conditions: s.conditions.length ? s.conditions : null,
    p_min_price_cents: s.min !== undefined ? Math.round(s.min * 100) : null,
    p_max_price_cents: s.max !== undefined ? Math.round(s.max * 100) : null,
    p_fulfillment: s.fulfillment,
    p_min_rating: s.rating ?? null,
    p_attr_in: Object.keys(s.attrIn).length ? s.attrIn : null,
    p_attr_range: Object.keys(s.attrRange).length ? s.attrRange : null,
    p_sort: s.sort === "newest" ? "newest" : s.sort,
    p_limit: PAGE_SIZE,
    p_offset: (s.page - 1) * PAGE_SIZE,
  };
}

/** Build a /search URL from a params object, dropping empty values. */
export function buildSearchUrl(params: Record<string, string | undefined | null>) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) usp.set(k, v);
  const qs = usp.toString();
  return qs ? `/search?${qs}` : "/search";
}
