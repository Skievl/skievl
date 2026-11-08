"use client";
import { useActionState } from "react";
import { moderateListing } from "@/app/actions/admin";
import { FormMessage, SubmitButton, initialState } from "@/components/forms";
import type { ListingStatus } from "@/lib/types";

export function ModerateListingForm({ listingId, status }: { listingId: string; status: ListingStatus }) {
  const [state, action] = useActionState(moderateListing, initialState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="listing_id" value={listingId} />
      <textarea name="reason" rows={2} maxLength={500} className="input" placeholder="Reason (required to reject/remove; sent to seller)" aria-label="Reason" />
      <div className="flex flex-wrap gap-2">
        {status === "pending_review" && <SubmitButton name="decision" value="approve" className="btn-primary btn-sm">Approve</SubmitButton>}
        {status === "pending_review" && <SubmitButton name="decision" value="reject" className="btn-secondary btn-sm">Request changes</SubmitButton>}
        {!["removed", "reserved", "sold"].includes(status) && <SubmitButton name="decision" value="remove" className="btn-danger btn-sm">Remove</SubmitButton>}
        {status === "removed" && <SubmitButton name="decision" value="restore" className="btn-secondary btn-sm">Restore</SubmitButton>}
      </div>
      <FormMessage state={state} />
    </form>
  );
}
