"use client";
import { useActionState, useState } from "react";
import { createReport } from "@/app/actions/reports";
import { FormMessage, SubmitButton, initialState } from "@/components/forms";

const REASONS: [string, string][] = [
  ["scam_or_fraud", "Scam or fraud"],
  ["misleading", "Misleading or inaccurate"],
  ["prohibited_item", "Prohibited item"],
  ["offensive", "Offensive content"],
  ["harassment", "Harassment"],
  ["fake_review", "Fake review"],
  ["other", "Something else"],
];

export function ReportButton({ targetType, targetId, label = "Report" }: { targetType: "listing" | "user" | "review" | "message"; targetId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createReport, initialState);
  if (!open) {
    return (
      <button type="button" className="text-xs font-medium text-muted underline hover:text-danger" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }
  if (state.ok && state.message) return <FormMessage state={state} />;
  return (
    <form action={action} className="card space-y-2 p-3 text-left">
      <input type="hidden" name="target_type" value={targetType} />
      <input type="hidden" name="target_id" value={targetId} />
      <select name="reason" className="input" required aria-label="Reason">
        {REASONS.filter(([v]) => targetType === "review" || v !== "fake_review").map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <textarea name="details" className="input" rows={2} maxLength={2000} placeholder="Details (optional)" aria-label="Details" />
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton className="btn-danger btn-sm">Submit report</SubmitButton>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
