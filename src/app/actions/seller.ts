"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const shopSchema = z.object({
  shop_name: z.string().trim().min(2, "At least 2 characters").max(60),
  town: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(1000).optional(),
});

export async function saveShop(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = shopSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, error: "Sign in again" };

  const { data: existing } = await supabase.from("seller_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  const values = { shop_name: parsed.data.shop_name, town: parsed.data.town, bio: parsed.data.bio || null };
  const { error } = existing
    ? await supabase.from("seller_profiles").update(values).eq("user_id", user.id)
    : await supabase.from("seller_profiles").insert({ user_id: user.id, ...values });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sell", "layout");
  return { ok: true, message: "Shop profile saved." };
}

const addressSchema = z.object({
  address_line1: z.string().trim().min(3, "Enter a street address").max(120),
  address_line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2, "Enter a town").max(80),
  postal_code: z.string().trim().regex(/^\d{5}$/, "5-digit ZIP"),
  pickup_instructions: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(30).optional(),
});

/** Private pickup address — only ever shown to a buyer after payment. */
export async function savePickupAddress(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, error: "Sign in again" };
  const d = parsed.data;
  const { error } = await supabase.from("seller_private").upsert({
    user_id: user.id,
    address_line1: d.address_line1,
    address_line2: d.address_line2 || null,
    city: d.city,
    state: "NY",
    postal_code: d.postal_code,
    pickup_instructions: d.pickup_instructions || null,
    phone: d.phone || null,
  });
  if (error) return { ok: false, error: "Create your shop profile first" };
  revalidatePath("/sell/setup");
  return { ok: true, message: "Pickup address saved (kept private)." };
}

const zipSchema = z.object({ postal_code: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP"), label: z.string().trim().max(80).optional() });

export async function addDropoffZip(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = zipSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, error: "Sign in again" };
  const { error } = await supabase
    .from("dropoff_areas")
    .insert({ seller_id: user.id, postal_code: parsed.data.postal_code, label: parsed.data.label || null });
  if (error) return { ok: false, error: error.code === "23505" ? "Already in your list" : "Create your shop profile first" };
  revalidatePath("/sell/setup");
  return { ok: true };
}

export async function removeDropoffZip(id: string) {
  const { supabase, user } = await currentUser();
  if (!user) return;
  await supabase.from("dropoff_areas").delete().eq("id", z.string().uuid().parse(id)).eq("seller_id", user.id);
  revalidatePath("/sell/setup");
}
