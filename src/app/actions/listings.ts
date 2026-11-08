"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCategoryById } from "@/lib/catalog";
import { parseMoneyToCents } from "@/lib/format";
import { LISTING_IMAGE_BUCKET } from "@/lib/images";
import type { ActionResult, Attributes } from "@/lib/types";

const uuid = z.string().uuid();

const listingSchema = z.object({
  listing_id: uuid.optional().or(z.literal("")),
  category_id: uuid,
  brand_id: uuid.optional().or(z.literal("")),
  brand_other: z.string().trim().max(60).optional(),
  title: z.string().trim().min(3, "Add a title").max(100),
  model: z.string().trim().max(100).optional(),
  model_year: z.coerce.number().int().min(1970).max(2100).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional(),
  condition: z.enum(["new", "like_new", "good", "fair"], { errorMap: () => ({ message: "Choose a condition" }) }),
  condition_notes: z.string().trim().max(1000).optional(),
  price: z.string().trim().min(1, "Enter a price"),
  gender: z.enum(["mens", "womens", "unisex"]).optional().or(z.literal("")),
  age_group: z.enum(["adult", "youth", "kids", "toddler"]).optional().or(z.literal("")),
  offers_pickup: z.literal("on").optional(),
  offers_dropoff: z.literal("on").optional(),
  dropoff_fee: z.string().trim().optional(),
});

export async function saveListing(_: ActionResult<{ id: string }>, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const raw = Object.fromEntries(formData);
  const parsed = listingSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again" };

  const category = await getCategoryById(d.category_id);
  if (!category) return { ok: false, error: "Choose a product type" };

  // Category-specific structured attributes: fields named "attr.<key>"
  const attributes: Attributes = {};
  const fieldErrors: Record<string, string[]> = {};
  for (const def of category.attribute_definitions) {
    const v = formData.get(`attr.${def.key}`);
    const s = typeof v === "string" ? v.trim() : "";
    if (s === "") {
      if (def.is_required) fieldErrors[`attr.${def.key}`] = [`${def.label} is required`];
      continue;
    }
    if (def.data_type === "boolean") attributes[def.key] = s === "true";
    else if (def.data_type === "enum") {
      if (!def.options?.some((o) => o.value === s)) fieldErrors[`attr.${def.key}`] = ["Choose a valid option"];
      else attributes[def.key] = s;
    } else {
      const n = Number(s);
      if (!Number.isFinite(n) || (def.min_value !== null && n < def.min_value) || (def.max_value !== null && n > def.max_value))
        fieldErrors[`attr.${def.key}`] = [`Enter a value between ${def.min_value} and ${def.max_value}`];
      else attributes[def.key] = n;
    }
  }
  if (category.uses_gender && !d.gender) fieldErrors.gender = ["Choose a gender fit"];
  if (category.uses_age_group && !d.age_group) fieldErrors.age_group = ["Choose an age group"];

  const priceCents = parseMoneyToCents(d.price);
  if (priceCents === null || priceCents < 100) fieldErrors.price = ["Enter a price of at least $1"];
  const offersPickup = d.offers_pickup === "on";
  const offersDropoff = d.offers_dropoff === "on";
  if (!offersPickup && !offersDropoff) fieldErrors.offers_pickup = ["Offer pickup, drop-off, or both"];
  const dropoffFee = offersDropoff ? parseMoneyToCents(d.dropoff_fee || "0") : 0;
  if (dropoffFee === null) fieldErrors.dropoff_fee = ["Enter a valid fee"];
  if (!d.brand_id && !d.brand_other) fieldErrors.brand_id = ["Choose a brand or enter one"];

  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields", fieldErrors };

  const values = {
    category_id: d.category_id,
    brand_id: d.brand_id || null,
    brand_other: d.brand_id ? null : d.brand_other || null,
    title: d.title,
    model: d.model || null,
    model_year: d.model_year === "" || d.model_year === undefined ? null : d.model_year,
    description: d.description ?? "",
    condition: d.condition,
    condition_notes: d.condition_notes || null,
    price_cents: priceCents!,
    gender: category.uses_gender ? d.gender || null : null,
    age_group: category.uses_age_group ? d.age_group || null : null,
    attributes,
    offers_pickup: offersPickup,
    offers_dropoff: offersDropoff,
    dropoff_fee_cents: dropoffFee ?? 0,
  };

  if (d.listing_id) {
    const { error } = await supabase.from("listings").update(values).eq("id", d.listing_id).eq("seller_id", user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/listings/${d.listing_id}`);
    revalidatePath("/sell");
    return { ok: true, data: { id: d.listing_id }, message: "Changes saved." };
  }

  const { data, error } = await supabase
    .from("listings")
    .insert({ ...values, seller_id: user.id, status: "draft" })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message.includes("row-level") ? "Set up your seller profile first" : error.message };
  redirect(`/sell/listings/${data.id}?created=1`);
}

/** Publish / unpublish. The DB enforces approval, Stripe onboarding, photos, and address rules. */
export async function setListingStatus(listingId: string, status: "active" | "unavailable" | "draft"): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .update({ status })
    .eq("id", uuid.parse(listingId))
    .select("status")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/sell");
  revalidatePath(`/sell/listings/${listingId}`);
  revalidatePath(`/listings/${listingId}`);
  return {
    ok: true,
    message:
      data.status === "pending_review"
        ? "Submitted! Your listing will go live once our team approves it (usually within a day)."
        : data.status === "active"
          ? "Your listing is live."
          : "Listing hidden from buyers.",
  };
}

export async function deleteListing(listingId: string) {
  const id = uuid.parse(listingId);
  const supabase = await createClient();
  const { data: images } = await supabase.from("listing_images").select("storage_path").eq("listing_id", id);
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (images?.length) await supabase.storage.from(LISTING_IMAGE_BUCKET).remove(images.map((i) => i.storage_path));
  revalidatePath("/sell");
  redirect("/sell");
}

export async function addListingImage(listingId: string, storagePath: string, width?: number, height?: number): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again" };
  const id = uuid.parse(listingId);
  if (!storagePath.startsWith(`${user.id}/${id}/`)) return { ok: false, error: "Invalid upload path" };

  const { count } = await supabase.from("listing_images").select("id", { count: "exact", head: true }).eq("listing_id", id);
  const { error } = await supabase.from("listing_images").insert({
    listing_id: id,
    storage_path: storagePath,
    sort_order: count ?? 0,
    width: width ?? null,
    height: height ?? null,
  });
  if (error) {
    await supabase.storage.from(LISTING_IMAGE_BUCKET).remove([storagePath]);
    return { ok: false, error: error.message };
  }
  revalidatePath(`/sell/listings/${id}`);
  return { ok: true };
}

export async function removeListingImage(imageId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: img } = await supabase.from("listing_images").select("id, listing_id, storage_path").eq("id", uuid.parse(imageId)).single();
  if (!img) return { ok: false, error: "Photo not found" };
  const { error } = await supabase.from("listing_images").delete().eq("id", img.id);
  if (error) return { ok: false, error: error.message };
  await supabase.storage.from(LISTING_IMAGE_BUCKET).remove([img.storage_path]);
  revalidatePath(`/sell/listings/${img.listing_id}`);
  return { ok: true };
}

export async function makeCoverImage(listingId: string, imageId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: imgs } = await supabase
    .from("listing_images")
    .select("id, sort_order")
    .eq("listing_id", uuid.parse(listingId))
    .order("sort_order");
  if (!imgs) return { ok: false, error: "Photos not found" };
  const ordered = [imgs.find((i) => i.id === imageId), ...imgs.filter((i) => i.id !== imageId)].filter(Boolean) as { id: string }[];
  for (const [i, img] of ordered.entries()) {
    await supabase.from("listing_images").update({ sort_order: i }).eq("id", img.id);
  }
  revalidatePath(`/sell/listings/${listingId}`);
  return { ok: true };
}
