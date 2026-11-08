"use client";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/types";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText,
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value}>
      {pending ? pendingText ?? "Working…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionResult<unknown> | null | undefined }) {
  if (!state) return null;
  if (state.ok && state.message)
    return (
      <p role="status" className="rounded-lg border border-pine/30 bg-pine-light px-3 py-2 text-sm text-pine">
        {state.message}
      </p>
    );
  if (!state.ok && state.error)
    return (
      <p role="alert" className="rounded-lg border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger">
        {state.error}
      </p>
    );
  return null;
}

export function FieldError({ state, name }: { state: ActionResult<unknown> | null | undefined; name: string }) {
  if (!state || state.ok) return null;
  const msg = state.fieldErrors?.[name]?.[0];
  return msg ? <p className="field-error">{msg}</p> : null;
}

export const initialState: ActionResult = { ok: true };
