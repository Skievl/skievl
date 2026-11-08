"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { signIn, requestPasswordReset } from "@/app/actions/auth";
import { FieldError, FormMessage, SubmitButton, initialState } from "@/components/forms";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, initialState);
  const [resetState, resetAction] = useActionState(requestPasswordReset, initialState);
  const [forgot, setForgot] = useState(false);

  if (forgot) {
    return (
      <form action={resetAction} className="mt-6 space-y-4">
        <FormMessage state={resetState} />
        <div>
          <label className="label" htmlFor="reset-email">Email</label>
          <input id="reset-email" name="email" type="email" required autoComplete="email" className="input" />
        </div>
        <SubmitButton className="btn-primary w-full">Send reset link</SubmitButton>
        <button type="button" className="btn-ghost w-full" onClick={() => setForgot(false)}>Back to sign in</button>
      </form>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        <FieldError state={state} name="email" />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="password">Password</label>
          <button type="button" className="mb-1.5 text-xs font-medium text-sky" onClick={() => setForgot(true)}>Forgot password?</button>
        </div>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
        <FieldError state={state} name="password" />
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm text-muted">
        New here? <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-sky">Create an account</Link>
      </p>
    </form>
  );
}
