import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const staticPages = ["", "/search", "/how-it-works", "/sell", "/terms", "/privacy"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "daily" as const,
  }));
  if (!publicEnv.supabaseUrl) return staticPages;

  // Anonymous client: only public rows are visible under RLS
  const supabase = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false } });
  const [{ data: listings }, { data: categories }] = await Promise.all([
    supabase.from("listings").select("id, updated_at").eq("status", "active").limit(5000),
    supabase.from("categories").select("slug").eq("is_active", true),
  ]);
  return [
    ...staticPages,
    ...(categories ?? []).map((c) => ({ url: `${base}/search?category=${c.slug}`, changeFrequency: "daily" as const })),
    ...(listings ?? []).map((l) => ({ url: `${base}/listings/${l.id}`, lastModified: l.updated_at })),
  ];
}
