import { LISTING_STATUS_LABELS, ORDER_STATUS_LABELS } from "@/lib/format";
import type { ListingStatus, OrderStatus } from "@/lib/types";

const ORDER_TONES: Partial<Record<OrderStatus, string>> = {
  pending_payment: "bg-ice text-ink-soft",
  awaiting_fulfillment: "bg-gold/20 text-[#8a5a10]",
  ready_for_pickup: "bg-sky/15 text-sky",
  pickup_scheduled: "bg-sky/15 text-sky",
  delivery_scheduled: "bg-sky/15 text-sky",
  picked_up: "bg-pine-light text-pine",
  delivered: "bg-pine-light text-pine",
  completed: "bg-pine text-white",
  cancelled: "bg-line text-ink-soft",
  expired: "bg-line text-ink-soft",
  refunded: "bg-danger-light text-danger",
  disputed: "bg-danger text-white",
};

const LISTING_TONES: Partial<Record<ListingStatus, string>> = {
  draft: "bg-line text-ink-soft",
  pending_review: "bg-gold/20 text-[#8a5a10]",
  active: "bg-pine-light text-pine",
  reserved: "bg-sky/15 text-sky",
  sold: "bg-ink text-white",
  unavailable: "bg-line text-ink-soft",
  removed: "bg-danger-light text-danger",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${ORDER_TONES[status] ?? "bg-line"}`}>{ORDER_STATUS_LABELS[status]}</span>;
}

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return <span className={`badge ${LISTING_TONES[status] ?? "bg-line"}`}>{LISTING_STATUS_LABELS[status]}</span>;
}
