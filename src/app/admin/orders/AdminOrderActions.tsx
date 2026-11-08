"use client";
import { useActionState } from "react";
import { adminRefund, adminSetOrderStatus } from "@/app/actions/admin";
import { FormMessage, SubmitButton, initialState } from "@/components/forms";

export function AdminOrderActions({ orderId, canRefund }: { orderId: string; canRefund: boolean }) {
  const [refundState, refundAction] = useActionState(adminRefund, initialState);
  const [statusState, statusAction] = useActionState(adminSetOrderStatus, initialState);
  return (
    <div className="space-y-5 border-t border-line pt-4">
      {canRefund && (
        <form action={refundAction} className="space-y-2">
          <p className="text-sm font-semibold">Issue refund</p>
          <input type="hidden" name="order_id" value={orderId} />
          <input name="amount" inputMode="decimal" placeholder="Amount (blank = full remaining)" className="input" aria-label="Refund amount" />
          <input name="reason" required placeholder="Reason" className="input" aria-label="Refund reason" />
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" name="relist" defaultChecked /> On full refund, return listing to seller as “unavailable”
          </label>
          <p className="text-xs text-muted">Reverses the seller transfer and refunds SKIEVL’s fee proportionally.</p>
          <FormMessage state={refundState} />
          <SubmitButton className="btn-danger btn-sm" pendingText="Refunding…">Refund via Stripe</SubmitButton>
        </form>
      )}
      <form action={statusAction} className="space-y-2">
        <p className="text-sm font-semibold">Override status</p>
        <input type="hidden" name="order_id" value={orderId} />
        <select name="status" className="input" aria-label="New status">
          <option value="completed">Completed</option>
          <option value="awaiting_fulfillment">Awaiting fulfillment</option>
          <option value="cancelled">Cancelled (no money movement)</option>
        </select>
        <input name="note" placeholder="Note" className="input" aria-label="Note" />
        <FormMessage state={statusState} />
        <SubmitButton className="btn-secondary btn-sm">Update status</SubmitButton>
      </form>
    </div>
  );
}
