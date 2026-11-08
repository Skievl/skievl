import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Brand, Category, PlatformSettings } from "@/lib/types";

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*, attribute_definitions(*)")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data as Category[]).map((c) => ({
    ...c,
    attribute_definitions: [...c.attribute_definitions].sort((a, b) => a.sort_order - b.sort_order),
  }));
});

export const getBrands = cache(async (): Promise<Brand[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data as Brand[];
});

export const getSettings = cache(async (): Promise<PlatformSettings> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("platform_settings").select("*").single();
  if (error) throw error;
  return data as PlatformSettings;
});

export async function getCategoryBySlug(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

export async function getCategoryById(id: string) {
  return (await getCategories()).find((c) => c.id === id) ?? null;
}
