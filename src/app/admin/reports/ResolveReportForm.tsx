"use client";
import { useActionState } from "react";
import { resolveReport } from "@/app/actions/admin";
import { FormMessage, SubmitButton, initialState } from "@/components/forms";

export function ResolveReportForm({ reportId }: { reportId: string }) {
  const [state, action] = useActionState(resolveReport, initialState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="report_id" value={reportId} />
      <textarea name="note" rows={2} className="input" placeholder="What did you do? (internal)" aria-label="Resolution note" />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="status" value="reviewing" className="btn-secondary btn-sm">Mark reviewing</SubmitButton>
        <SubmitButton name="status" value="resolved" className="btn-primary btn-sm">Resolve</SubmitButton>
        <SubmitButton name="status" value="dismissed" className="btn-ghost btn-sm">Dismiss</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
