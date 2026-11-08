"use client";
import { useActionState, useState } from "react";
import { submitReview } from "@/app/actions/reviews";
import { FieldError, FormMessage, SubmitButton, initialState } from "@/components/forms";

const CRITERIA = [
  ["rating_communication", "Communication", "Responsive and clear about pickup or drop-off?"],
  ["rating_accuracy", "Accuracy of listing", "Did the gear match the photos, size and condition described?"],
  ["rating_transaction", "Transaction experience", "Was the handoff on time and easy?"],
  ["rating_overall", "Overall seller experience", "Would you buy from this seller again?"],
] as const;

export function ReviewForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(submitReview, initialState);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  if (state.ok && state.message) return <div className="mt-3"><FormMessage state={state} /></div>;

  return (
    <form action={action} className="mt-3 space-y-4">
      <input type="hidden" name="order_id" value={orderId} />
      <p className="text-sm text-muted">Rate the <strong>seller experience</strong> — not just the gear itself.</p>
      {CRITERIA.map(([key, label, help]) => (
        <fieldset key={key}>
          <legend className="text-sm font-semibold">{label}</legend>
          <p className="text-xs text-muted">{help}</p>
          <div className="mt-1 flex gap-1" role="radiogroup" aria-label={label}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer">
                <input type="radio" name={key} value={n} className="sr-only" required onChange={() => setRatings((r) => ({ ...r, [key]: n }))} />
                <svg viewBox="0 0 20 20" className={`h-7 w-7 ${n <= (ratings[key] ?? 0) ? "fill-gold" : "fill-line"}`} aria-hidden>
                  <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z" />
                </svg>
                <span className="sr-only">{n} star{n > 1 ? "s" : ""}</span>
              </label>
            ))}
          </div>
          <FieldError state={state} name={key} />
        </fieldset>
      ))}
      <div>
        <label className="label" htmlFor="review-body">Your review</label>
        <textarea id="review-body" name="body" className="input" rows={4} minLength={10} maxLength={2000} required placeholder="How was buying from this seller?" />
        <FieldError state={state} name="body" />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Post verified review</SubmitButton>
    </form>
  );
}
