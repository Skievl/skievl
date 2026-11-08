import type { AgeGroup, Gender, ItemCondition, OrderStatus, ListingStatus } from "@/lib/types";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatMoney(cents: number, opts: { whole?: boolean } = {}) {
  const value = cents / 100;
  if (opts.whole && Number.isInteger(value)) return usdWhole.format(value);
  return usd.format(value);
}

/** "350" | "350.5" | "$1,200" -> cents. Returns null on invalid input. */
export function parseMoneyToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;
  const n = typeof input === "number" ? input : Number(String(input).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function formatPercentBps(bps: number) {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
};

export const CONDITION_HELP: Record<ItemCondition, string> = {
  new: "Never used, tags or original packaging.",
  like_new: "Used a handful of days, no visible wear.",
  good: "Normal wear: light scratches or scuffs, fully functional.",
  fair: "Noticeable wear or cosmetic damage, still functional.",
};

export const GENDER_LABELS: Record<Gender, string> = { mens: "Men's", womens: "Women's", unisex: "Unisex" };

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  adult: "Adult",
  youth: "Youth",
  kids: "Kids",
  toddler: "Toddler",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  awaiting_fulfillment: "Awaiting fulfillment",
  ready_for_pickup: "Ready for pickup",
  pickup_scheduled: "Pickup scheduled",
  delivery_scheduled: "Drop-off scheduled",
  shipped: "Shipped",
  delivered: "Delivered",
  picked_up: "Picked up",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  disputed: "Disputed",
  expired: "Checkout expired",
};

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Draft",
  pending_review: "In review",
  active: "Live",
  reserved: "Checkout in progress",
  sold: "Sold",
  unavailable: "Unavailable",
  removed: "Removed",
};

export function formatDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
    timeZone: "America/New_York",
  }).format(new Date(iso));
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, "y"],
    [60 * 60 * 24 * 30, "mo"],
    [60 * 60 * 24 * 7, "w"],
    [60 * 60 * 24, "d"],
    [60 * 60, "h"],
    [60, "m"],
  ];
  for (const [secs, label] of units) if (s >= secs) return `${Math.floor(s / secs)}${label} ago`;
  return "just now";
}

export function addressLines(a: { line1: string; line2?: string | null; city?: string | null; state?: string | null; postal_code: string } | null) {
  if (!a) return [];
  return [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(", ") + " " + a.postal_code].filter(
    (l): l is string => Boolean(l && l.trim()),
  );
}
