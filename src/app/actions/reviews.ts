"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/lib/types";

const star = z.coerce.number().int().min(1, "Choose a rating").max(5);
const reviewSchema = z.object({
  order_id: z.string().uuid(),
  rating_overall: star,
  rating_communication: star,
  rating_accuracy: star,
  rating_transaction: star,
  body: z.string().trim().min(10, "Write at least a sentence (10+ characters)").max(2000),
});

export async function submitReview(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please complete every rating", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again" };

  const { data: order } = await supabase
    .from("orders")
    .select("id, seller_id, buyer_id, status, order_number")
    .eq("id", parsed.data.order_id)
    .maybeSingle();
  if (!order || order.buyer_id !== user.id) return { ok: false, error: "Order not found" };
  if (order.status !== "completed") return { ok: false, error: "You can review once the order is completed" };

  // RLS re-verifies: buyer owns the completed order and seller matches.
  const { error } = await supabase.from("reviews").insert({ ...parsed.data, buyer_id: user.id, seller_id: order.seller_id });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "You already reviewed this order" };
    return { ok: false, error: "Could not post review" };
  }

  await notify({
    userId: order.seller_id,
    type: "review",
    title: `New ${parsed.data.rating_overall}-star review`,
    body: parsed.data.body.slice(0, 200),
    link: "/sell/reviews",
    email: { ctaLabel: "View and respond" },
  });
  revalidatePath(`/sellers/${order.seller_id}`);
  return { ok: true, message: "Thanks! Your verified review is live." };
}

const responseSchema = z.object({
  review_id: z.string().uuid(),
  body: z.string().trim().min(2, "Write a response").max(1000),
});

export async function respondToReview(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = responseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again" };

  const { data: existing } = await supabase
    .from("seller_responses")
    .select("id")
    .eq("review_id", parsed.data.review_id)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("seller_responses").update({ body: parsed.data.body }).eq("id", existing.id)
    : await supabase.from("seller_responses").insert({ review_id: parsed.data.review_id, seller_id: user.id, body: parsed.data.body });
  if (error) return { ok: false, error: "Could not save response" };
  revalidatePath("/sell/reviews");
  revalidatePath(`/sellers/${user.id}`);
  return { ok: true, message: "Response posted publicly." };
}
