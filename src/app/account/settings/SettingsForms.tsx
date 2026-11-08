"use client";
import { useActionState } from "react";
import { updateProfile } from "@/app/actions/account";
import { updatePassword } from "@/app/actions/auth";
import { FormMessage, SubmitButton, initialState } from "@/components/forms";

export function ProfileForm({ displayName, homeTown }: { displayName: string; homeTown: string }) {
  const [state, action] = useActionState(updateProfile, initialState);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="display_name">Display name</label>
        <input id="display_name" name="display_name" defaultValue={displayName} maxLength={60} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="home_town">Home town</label>
        <input id="home_town" name="home_town" defaultValue={homeTown} maxLength={80} className="input" placeholder="Ellicottville" />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(updatePassword, initialState);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Update password</SubmitButton>
    </form>
  );
}
