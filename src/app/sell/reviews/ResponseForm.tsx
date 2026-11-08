"use client";
import { useActionState } from "react";
import { respondToReview } from "@/app/actions/reviews";
import { FormMessage, SubmitButton, initialState } from "@/components/forms";

export function ResponseForm({ reviewId, existing }: { reviewId: string; existing: string }) {
  const [state, action] = useActionState(respondToReview, initialState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="review_id" value={reviewId} />
      <label className="label" htmlFor={`resp-${reviewId}`}>{existing ? "Your public response" : "Respond publicly"}</label>
      <textarea id={`resp-${reviewId}`} name="body" defaultValue={existing} rows={2} maxLength={1000} className="input" required />
      <FormMessage state={state} />
      <SubmitButton className="btn-secondary btn-sm">{existing ? "Update response" : "Post response"}</SubmitButton>
    </form>
  );
}
