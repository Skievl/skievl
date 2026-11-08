"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function toggleFavorite(listingId: string) {
  const id = z.string().uuid().parse(listingId);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in to save items" };

  const { data: existing } = await supabase.from("favorites").select("listing_id").eq("listing_id", id).maybeSingle();
  if (existing) await supabase.from("favorites").delete().eq("listing_id", id).eq("user_id", user.id);
  else await supabase.from("favorites").insert({ user_id: user.id, listing_id: id });
  revalidatePath("/account/favorites");
  return { ok: true as const, favorite: !existing };
}
