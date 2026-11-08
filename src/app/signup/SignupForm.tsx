"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { FieldError, FormMessage, SubmitButton, initialState } from "@/components/forms";

export function SignupForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUp, initialState);
  if (state.ok && state.message) return <div className="mt-6"><FormMessage state={state} /></div>;
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <div>
        <label className="label" htmlFor="display_name">Your name</label>
        <input id="display_name" name="display_name" required maxLength={60} autoComplete="name" className="input" />
        <p className="hint">Shown to buyers and sellers you trade with.</p>
        <FieldError state={state} name="display_name" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
        <FieldError state={state} name="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
        <FieldError state={state} name="password" />
      </div>
      <label className="flex items-start gap-2 text-sm text-ink-soft">
        <input type="checkbox" name="terms" className="mt-0.5" required />
        <span>
          I agree to the <Link href="/terms" className="text-sky underline">Terms</Link> and{" "}
          <Link href="/privacy" className="text-sky underline">Privacy Policy</Link>.
        </span>
      </label>
      <FieldError state={state} name="terms" />
      <SubmitButton className="btn-primary w-full" pendingText="Creating account…">Create account</SubmitButton>
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-sky">Sign in</Link>
      </p>
    </form>
  );
}
