"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";
import { refundOrder } from "@/lib/refunds";
import { formatDate, ORDER_STATUS_LABELS } from "@/lib/format";
import type { ActionResult, Order, OrderStatus } from "@/lib/types";

const uuid = z.string().uuid();

/** Buyer confirms receipt -> order completed. */
export async function confirmReceived(orderId: string) {
  const id = uuid.parse(orderId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buyer_confirm_order", { p_order_id: id });
  if (error) throw new Error(error.message);
  const order = data as Order;
  await notify({
    userId: order.seller_id,
    type: "order_completed",
    title: `Order ${order.order_number} completed`,
    body: `The buyer confirmed they received “${order.listing_snapshot.title}”. Nice sale!`,
    link: `/sell/orders/${order.id}`,
  });
  revalidatePath(`/account/orders/${id}`);
}

const updateSchema = z.object({
  order_id: uuid,
  status: z.enum(["ready_for_pickup", "pickup_scheduled", "picked_up", "delivery_scheduled", "delivered"]),
  scheduled_for: z.string().datetime({ offset: true }).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional(),
});

const BUYER_MESSAGES: Partial<Record<OrderStatus, string>> = {
  ready_for_pickup: "Your item is ready for pickup. Check the order page for the address and message the seller to set a time.",
  pickup_scheduled: "Your pickup has been scheduled.",
  delivery_scheduled: "Your drop-off has been scheduled.",
  picked_up: "The seller marked your item as picked up. Please confirm receipt to complete the order.",
  delivered: "The seller marked your item as delivered. Please confirm receipt to complete the order.",
};

/** Seller moves an order through fulfillment (state machine enforced in SQL). */
export async function updateFulfillment(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please check the status and time" };
  const { order_id, status, scheduled_for, note } = parsed.data;
  if ((status === "pickup_scheduled" || status === "delivery_scheduled") && !scheduled_for)
    return { ok: false, error: "Choose a date and time" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("seller_update_order", {
    p_order_id: order_id,
    p_status: status,
    p_scheduled_for: scheduled_for || null,
    p_note: note || null,
  });
  if (error) return { ok: false, error: error.message };
  const order = data as Order;

  const when = order.scheduled_for ? ` for ${formatDate(order.scheduled_for, true)}` : "";
  await notify({
    userId: order.buyer_id,
    type: "order_status",
    title: `${ORDER_STATUS_LABELS[status]}${status.endsWith("scheduled") ? when : ""}: ${order.listing_snapshot.title}`,
    body: (BUYER_MESSAGES[status] ?? "Your order was updated.") + (note ? ` Seller note: “${note}”` : ""),
    link: `/account/orders/${order.id}`,
  });
  revalidatePath(`/sell/orders/${order_id}`);
  return { ok: true, message: `Order updated: ${ORDER_STATUS_LABELS[status]}` };
}

const cancelSchema = z.object({ order_id: uuid, reason: z.string().trim().min(3, "Tell the buyer why").max(500) });

/**
 * Seller cancels before handoff -> full refund to buyer (transfer reversed and
 * platform fee refunded). Listing returns to "unavailable" so the seller can relist.
 */
export async function sellerCancelOrder(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase.from("orders").select("*").eq("id", parsed.data.order_id).maybeSingle();
  const order = data as Order | null;
  if (!user || !order || order.seller_id !== user.id) return { ok: false, error: "Order not found" };
  if (!["awaiting_fulfillment", "ready_for_pickup", "pickup_scheduled", "delivery_scheduled"].includes(order.status))
    return { ok: false, error: "This order can no longer be cancelled by the seller. Contact support." };
  if (!order.stripe_payment_intent_id) return { ok: false, error: "Payment not found" };

  const result = await refundOrder(order, { reason: `Seller cancelled: ${parsed.data.reason}`, initiatedBy: user.id });
  if (!result.ok) return result;

  await notify({
    userId: order.buyer_id,
    type: "order_cancelled",
    title: `Order ${order.order_number} was cancelled`,
    body: `The seller cancelled your order for “${order.listing_snapshot.title}” and you’ve been fully refunded. Reason: ${parsed.data.reason}`,
    link: `/account/orders/${order.id}`,
  });
  revalidatePath(`/sell/orders/${order.id}`);
  return { ok: true, message: "Order cancelled and buyer refunded." };
}
