"use client";
import { useActionState, useState } from "react";
import { sellerCancelOrder, updateFulfillment } from "@/app/actions/orders";
import { FormMessage, SubmitButton, initialState } from "@/components/forms";
import type { FulfillmentMethod, OrderStatus } from "@/lib/types";

const NEXT: Record<FulfillmentMethod, Partial<Record<OrderStatus, { status: OrderStatus; label: string; schedule?: boolean }[]>>> = {
  pickup: {
    awaiting_fulfillment: [
      { status: "ready_for_pickup", label: "Mark ready for pickup" },
      { status: "pickup_scheduled", label: "Schedule pickup", schedule: true },
      { status: "picked_up", label: "Buyer picked it up" },
    ],
    ready_for_pickup: [
      { status: "pickup_scheduled", label: "Schedule pickup", schedule: true },
      { status: "picked_up", label: "Buyer picked it up" },
    ],
    pickup_scheduled: [
      { status: "pickup_scheduled", label: "Reschedule", schedule: true },
      { status: "picked_up", label: "Buyer picked it up" },
    ],
  },
  dropoff: {
    awaiting_fulfillment: [
      { status: "delivery_scheduled", label: "Schedule drop-off", schedule: true },
      { status: "delivered", label: "Mark delivered" },
    ],
    delivery_scheduled: [
      { status: "delivery_scheduled", label: "Reschedule", schedule: true },
      { status: "delivered", label: "Mark delivered" },
    ],
  },
};

export function FulfillmentControls({ orderId, method, status }: { orderId: string; method: FulfillmentMethod; status: OrderStatus }) {
  const [state, action] = useActionState(updateFulfillment, initialState);
  const [choice, setChoice] = useState<{ status: OrderStatus; schedule?: boolean } | null>(null);
  const [when, setWhen] = useState("");
  const options = NEXT[method][status] ?? [];
  if (!options.length) {
    if (status === "picked_up" || status === "delivered")
      return <p className="text-sm text-muted">Waiting for the buyer to confirm receipt. Orders auto-complete after a few days.</p>;
    return null;
  }
  return (
    <section className="card space-y-4 p-5">
      <h2 className="font-bold">Update fulfillment</h2>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.label} type="button" className={choice?.status === o.status && choice.schedule === o.schedule ? "btn-dark" : "btn-secondary"} onClick={() => setChoice(o)}>
            {o.label}
          </button>
        ))}
      </div>
      {choice && (
        <form action={action} className="space-y-3">
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="status" value={choice.status} />
          {choice.schedule && (
            <div>
              <label className="label" htmlFor="when">Date & time</label>
              <input id="when" type="datetime-local" required className="input max-w-xs" value={when} onChange={(e) => setWhen(e.target.value)} />
              {/* datetime-local has no zone; convert using the seller's browser time zone */}
              <input type="hidden" name="scheduled_for" value={when ? new Date(when).toISOString() : ""} />
            </div>
          )}
          <div>
            <label className="label" htmlFor="note">Note to buyer (optional)</label>
            <textarea id="note" name="note" rows={2} maxLength={1000} className="input" placeholder="I'll leave them on the porch / meet at the Village Square." />
          </div>
          <FormMessage state={state} />
          <SubmitButton>Confirm update</SubmitButton>
        </form>
      )}
      {!choice && <FormMessage state={state} />}
    </section>
  );
}

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(sellerCancelOrder, initialState);
  const [open, setOpen] = useState(false);
  if (!open) return <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>Cancel order & refund buyer</button>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="order_id" value={orderId} />
      <textarea name="reason" required minLength={3} maxLength={500} rows={2} className="input" placeholder="Reason (shared with the buyer)" aria-label="Reason" />
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton className="btn-danger" pendingText="Refunding…">Cancel & refund</SubmitButton>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Keep order</button>
      </div>
    </form>
  );
}
