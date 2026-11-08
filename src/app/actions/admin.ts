"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { refundOrder } from "@/lib/refunds";
import { parseMoneyToCents } from "@/lib/format";
import type { ActionResult, Order } from "@/lib/types";

/** Every admin action re-verifies the role server-side, then uses the service role. */
async function adminContext() {
  const session = await getSession();
  if (!session?.isAdmin) throw new Error("Not authorized");
  return { adminId: session.user.id, db: createAdminClient() };
}

const uuid = z.string().uuid();

// ---------------------------------------------------------------- listings
export async function moderateListing(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { adminId, db } = await adminContext();
  const parsed = z
    .object({ listing_id: uuid, decision: z.enum(["approve", "reject", "remove", "restore"]), reason: z.string().trim().max(500).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { listing_id, decision, reason } = parsed.data;
  if ((decision === "reject" || decision === "remove") && !reason) return { ok: false, error: "Give the seller a reason" };

  const { data: listing } = await db.from("listings").select("id, seller_id, title, status").eq("id", listing_id).single();
  if (!listing) return { ok: false, error: "Listing not found" };
  if (["reserved", "sold"].includes(listing.status) && decision !== "approve") return { ok: false, error: "Listing has an order in progress; handle via Orders." };

  const update =
    decision === "approve"
      ? { status: "active", approved_at: new Date().toISOString(), rejection_reason: null }
      : decision === "reject"
        ? { status: "draft", rejection_reason: reason }
        : decision === "remove"
          ? { status: "removed", rejection_reason: reason }
          : { status: "unavailable", rejection_reason: null };
  const { error } = await db.from("listings").update(update).eq("id", listing_id);
  if (error) return { ok: false, error: error.message };
  await auditLog(adminId, `listing.${decision}`, { type: "listing", id: listing_id }, { reason });

  const messages = {
    approve: ["Your listing is live!", `“${listing.title}” was approved and is now visible to buyers.`],
    reject: ["Your listing needs changes", `“${listing.title}” wasn’t approved: ${reason}. Edit it and resubmit.`],
    remove: ["Your listing was removed", `“${listing.title}” was removed by moderators: ${reason}`],
    restore: ["Your listing was restored", `“${listing.title}” was restored. You can relist it from your dashboard.`],
  } as const;
  await notify({
    userId: listing.seller_id,
    type: `listing_${decision}`,
    title: messages[decision][0],
    body: messages[decision][1],
    link: decision === "approve" ? `/listings/${listing_id}` : `/sell/listings/${listing_id}`,
  });
  revalidatePath("/admin/listings");
  return { ok: true, message: `Listing ${decision}d.` };
}

// ---------------------------------------------------------------- orders
export async function adminRefund(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { adminId, db } = await adminContext();
  const parsed = z
    .object({ order_id: uuid, amount: z.string().optional(), reason: z.string().trim().min(3, "Reason required").max(500), relist: z.literal("on").optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { data } = await db.from("orders").select("*").eq("id", parsed.data.order_id).single();
  const order = data as Order | null;
  if (!order?.stripe_payment_intent_id) return { ok: false, error: "No payment on this order" };

  const amount = parsed.data.amount ? parseMoneyToCents(parsed.data.amount) : undefined;
  if (parsed.data.amount && !amount) return { ok: false, error: "Invalid amount" };
  const res = await refundOrder(order, { reason: parsed.data.reason, initiatedBy: adminId, amountCents: amount ?? undefined, relist: parsed.data.relist === "on" });
  if (!res.ok) return res;
  await auditLog(adminId, "order.refund", { type: "order", id: order.id }, { amount: amount ?? "full", reason: parsed.data.reason });
  revalidatePath(`/admin/orders`);
  return { ok: true, message: "Refund issued." };
}

export async function adminSetOrderStatus(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { adminId, db } = await adminContext();
  const parsed = z
    .object({ order_id: uuid, status: z.enum(["completed", "cancelled", "awaiting_fulfillment"]), note: z.string().trim().max(500).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const now = new Date().toISOString();
  const { error } = await db
    .from("orders")
    .update({
      status: parsed.data.status,
      ...(parsed.data.status === "completed" ? { completed_at: now } : {}),
      ...(parsed.data.status === "cancelled" ? { cancelled_at: now, cancel_reason: parsed.data.note ?? "Cancelled by SKIEVL" } : {}),
    })
    .eq("id", parsed.data.order_id);
  if (error) return { ok: false, error: error.message };
  await auditLog(adminId, "order.set_status", { type: "order", id: parsed.data.order_id }, parsed.data);
  revalidatePath(`/admin/orders`);
  return { ok: true, message: "Order updated. (Status change does not move money — use Refund for that.)" };
}

// ---------------------------------------------------------------- users
export async function setUserSuspended(userId: string, suspended: boolean) {
  const { adminId, db } = await adminContext();
  const id = uuid.parse(userId);
  if (id === adminId) throw new Error("You can't suspend yourself");
  await db.from("profiles").update({ is_suspended: suspended }).eq("id", id);
  if (suspended) {
    // Hide their live listings
    await db.from("listings").update({ status: "unavailable" }).eq("seller_id", id).in("status", ["active", "pending_review"]);
  }
  await auditLog(adminId, suspended ? "user.suspend" : "user.unsuspend", { type: "user", id });
  revalidatePath("/admin/users");
}

export async function setUserRole(userId: string, role: "user" | "admin") {
  const { adminId, db } = await adminContext();
  const id = uuid.parse(userId);
  if (id === adminId && role !== "admin") throw new Error("You can't remove your own admin role");
  await db.from("profiles").update({ role }).eq("id", id);
  await auditLog(adminId, "user.set_role", { type: "user", id }, { role });
  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------- reviews
export async function moderateReview(reviewId: string, status: "published" | "hidden" | "removed", note?: string) {
  const { adminId, db } = await adminContext();
  await db.from("reviews").update({ status, moderation_note: note ?? null }).eq("id", uuid.parse(reviewId));
  await auditLog(adminId, `review.${status}`, { type: "review", id: reviewId }, { note });
  revalidatePath("/admin/reviews");
}

export async function setResponseHidden(reviewId: string, hidden: boolean) {
  const { adminId, db } = await adminContext();
  await db.from("seller_responses").update({ is_hidden: hidden }).eq("review_id", uuid.parse(reviewId));
  await auditLog(adminId, hidden ? "response.hide" : "response.show", { type: "review", id: reviewId });
  revalidatePath("/admin/reviews");
}

// ---------------------------------------------------------------- reports
export async function resolveReport(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { adminId, db } = await adminContext();
  const parsed = z
    .object({ report_id: uuid, status: z.enum(["reviewing", "resolved", "dismissed"]), note: z.string().trim().max(1000).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const done = parsed.data.status !== "reviewing";
  await db
    .from("reports")
    .update({
      status: parsed.data.status,
      resolution_note: parsed.data.note || null,
      resolved_by: done ? adminId : null,
      resolved_at: done ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.report_id);
  await auditLog(adminId, `report.${parsed.data.status}`, { type: "report", id: parsed.data.report_id }, { note: parsed.data.note });
  revalidatePath("/admin/reports");
  return { ok: true, message: "Report updated." };
}

// ---------------------------------------------------------------- settings
const settingsSchema = z.object({
  commission_percent: z.coerce.number().min(0).max(50),
  min_platform_fee: z.string().optional(),
  commission_on_dropoff_fee: z.literal("on").optional(),
  require_listing_approval: z.literal("on").optional(),
  reservation_minutes: z.coerce.number().int().min(33).max(120),
  auto_complete_days: z.coerce.number().int().min(1).max(30),
  max_dropoff_fee: z.string(),
  max_price: z.string(),
  market_name: z.string().trim().min(2).max(60),
  support_email: z.string().trim().email(),
});

export async function saveSettings(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { adminId, db } = await adminContext();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the values", fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  const values = {
    commission_bps: Math.round(d.commission_percent * 100),
    min_platform_fee_cents: parseMoneyToCents(d.min_platform_fee || "0") ?? 0,
    commission_on_dropoff_fee: d.commission_on_dropoff_fee === "on",
    require_listing_approval: d.require_listing_approval === "on",
    reservation_minutes: d.reservation_minutes,
    auto_complete_days: d.auto_complete_days,
    max_dropoff_fee_cents: parseMoneyToCents(d.max_dropoff_fee) ?? 10000,
    max_price_cents: parseMoneyToCents(d.max_price) ?? 500000,
    market_name: d.market_name,
    support_email: d.support_email,
    updated_at: new Date().toISOString(),
    updated_by: adminId,
  };
  const { data: before } = await db.from("platform_settings").select("*").single();
  const { error } = await db.from("platform_settings").update(values).eq("id", true);
  if (error) return { ok: false, error: error.message };
  await auditLog(adminId, "settings.update", { type: "platform_settings", id: "1" }, { before, after: values });
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved. New commission applies to orders started from now on." };
}

// ---------------------------------------------------------------- catalog
export async function addBrand(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const { adminId, db } = await adminContext();
  const name = z.string().trim().min(1).max(60).safeParse(formData.get("name"));
  if (!name.success) return { ok: false, error: "Enter a brand name" };
  const slug = name.data.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { error } = await db.from("brands").insert({ name: name.data, slug, is_featured: formData.get("is_featured") === "on" });
  if (error) return { ok: false, error: error.code === "23505" ? "Brand already exists" : error.message };
  await auditLog(adminId, "brand.add", { type: "brand", id: slug });
  revalidatePath("/admin/catalog");
  return { ok: true, message: `Added ${name.data}.` };
}

export async function updateBrand(brandId: string, patch: { is_active?: boolean; is_featured?: boolean }) {
  const { adminId, db } = await adminContext();
  await db.from("brands").update(patch).eq("id", uuid.parse(brandId));
  await auditLog(adminId, "brand.update", { type: "brand", id: brandId }, patch);
  revalidatePath("/admin/catalog");
}

export async function updateCategory(categoryId: string, patch: { is_active?: boolean; name?: string; sort_order?: number }) {
  const { adminId, db } = await adminContext();
  await db.from("categories").update(patch).eq("id", uuid.parse(categoryId));
  await auditLog(adminId, "category.update", { type: "category", id: categoryId }, patch);
  revalidatePath("/admin/catalog");
}
