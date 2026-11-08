import { PasswordForm } from "../settings/SettingsForms";

export const metadata = { title: "Set a new password" };

// Landing page for password-reset emails (user is signed in via the reset link).
export default function ResetPasswordPage() {
  return (
    <div className="card mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-extrabold">Choose a new password</h1>
      <PasswordForm />
    </div>
  );
}
