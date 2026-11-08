import Image from "next/image";
import { addressLines, formatDate, formatMoney, formatPercentBps } from "@/lib/format";
import { listingImageUrl } from "@/lib/images";
import { OrderStatusBadge } from "@/components/StatusBadge";
import type { Order, OrderStatus } from "@/lib/types";

const PICKUP_STEPS: OrderStatus[] = ["awaiting_fulfillment", "ready_for_pickup", "pickup_scheduled", "picked_up", "completed"];
const DROPOFF_STEPS: OrderStatus[] = ["awaiting_fulfillment", "delivery_scheduled", "delivered", "completed"];
const STEP_LABEL: Partial<Record<OrderStatus, string>> = {
  awaiting_fulfillment: "Paid",
  ready_for_pickup: "Ready",
  pickup_scheduled: "Scheduled",
  delivery_scheduled: "Scheduled",
  picked_up: "Picked up",
  delivered: "Delivered",
  completed: "Completed",
};

export function OrderTimeline({ order }: { order: Order }) {
  const steps = order.fulfillment_method === "pickup" ? PICKUP_STEPS : DROPOFF_STEPS;
  const idx = steps.indexOf(order.status);
  if (idx < 0) return <OrderStatusBadge status={order.status} />;
  return (
    <ol className="flex items-center gap-1" aria-label="Order progress">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col items-center gap-1 text-center">
          <span className={`h-1.5 w-full rounded-full ${i <= idx ? "bg-pine" : "bg-line"}`} />
          <span className={`text-[11px] ${i <= idx ? "font-semibold text-ink" : "text-muted"}`} aria-current={i === idx ? "step" : undefined}>
            {STEP_LABEL[s]}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function OrderHeader({ order }: { order: Order }) {
  const img = listingImageUrl(order.listing_snapshot.cover_image);
  return (
    <div className="flex gap-4">
      <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-ice">
        {img && <Image src={img} alt="" fill sizes="96px" className="object-cover" />}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted">Order {order.order_number} · {formatDate(order.paid_at ?? order.created_at, true)}</p>
        <h1 className="truncate text-xl font-extrabold">{order.listing_snapshot.title}</h1>
        <div className="mt-1 flex items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <span className="text-xs text-muted">{order.fulfillment_method === "pickup" ? "Buyer pickup" : "Seller drop-off"}</span>
        </div>
      </div>
    </div>
  );
}

export function MoneyBreakdown({ order, perspective }: { order: Order; perspective: "buyer" | "seller" | "admin" }) {
  return (
    <dl className="space-y-1.5 text-sm">
      <Row k="Item price" v={formatMoney(order.item_price_cents)} />
      <Row k={order.fulfillment_method === "dropoff" ? "Drop-off fee" : "Pickup"} v={order.dropoff_fee_cents ? formatMoney(order.dropoff_fee_cents) : "Free"} />
      <Row k={perspective === "buyer" ? "Total paid" : "Buyer paid"} v={formatMoney(order.total_cents)} bold />
      {perspective !== "buyer" && (
        <>
          <Row k={`Marketplace fee (${formatPercentBps(order.commission_bps)})`} v={`−${formatMoney(order.platform_fee_cents)}`} />
          <Row k="Seller proceeds" v={formatMoney(order.seller_proceeds_cents)} bold />
        </>
      )}
      {order.refunded_cents > 0 && <Row k="Refunded" v={`−${formatMoney(order.refunded_cents)}`} />}
    </dl>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "border-t border-line pt-1.5 font-bold" : ""}`}>
      <dt className={bold ? "" : "text-muted"}>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

export function AddressBlock({ title, address }: { title: string; address: Order["pickup_address"] }) {
  if (!address) return null;
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{title}</p>
      <address className="mt-1 text-sm not-italic">
        {addressLines(address).map((l) => (
          <span key={l} className="block">{l}</span>
        ))}
      </address>
      {address.instructions && <p className="mt-1 text-sm text-ink-soft">{address.instructions}</p>}
      {address.phone && <p className="mt-1 text-sm">📞 {address.phone}</p>}
      <a
        className="mt-2 inline-block text-sm font-semibold text-sky"
        target="_blank"
        rel="noopener noreferrer"
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLines(address).join(", "))}`}
      >
        Open in Maps →
      </a>
    </div>
  );
}
