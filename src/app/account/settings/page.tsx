import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ProfileForm, PasswordForm } from "./SettingsForms";

export const metadata = { title: "Account settings" };

export default async function SettingsPage() {
  const { profile, user } = await requireUser("/account/settings");
  return (
    <div className="max-w-xl space-y-8">
      <PageHeader title="Settings" subtitle={user.email ?? undefined} />
      <section className="card p-6">
        <h2 className="mb-4 font-bold">Profile</h2>
        <ProfileForm displayName={profile.display_name} homeTown={profile.home_town ?? ""} />
      </section>
      <section className="card p-6" id="password">
        <h2 className="mb-4 font-bold">Change password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
