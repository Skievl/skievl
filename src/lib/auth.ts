import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SellerProfile } from "@/lib/types";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  home_town: string | null;
  role: "user" | "admin";
  is_suspended: boolean;
  created_at: string;
}

/** Current auth user + profile (cached per request). Null when signed out. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: seller }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single<Profile>(),
    supabase.from("seller_profiles").select("*").eq("user_id", user.id).maybeSingle<SellerProfile>(),
  ]);
  if (!profile) return null;
  return { user, profile, seller: seller ?? null, isAdmin: profile.role === "admin" && !profile.is_suspended };
});

export async function requireUser(next?: string) {
  const session = await getSession();
  if (!session) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return session;
}

export async function requireSeller() {
  const session = await requireUser("/sell");
  if (!session.seller) redirect("/sell/setup");
  return { ...session, seller: session.seller };
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session?.isAdmin) notFound(); // don't reveal admin routes
  return session;
}
