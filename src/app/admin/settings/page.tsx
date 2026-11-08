import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Notice } from "@/components/ui";
import { SettingsForm } from "./SettingsForm";
import type { PlatformSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSettings() {
  await requireAdmin();
  const { data } = await createAdminClient().from("platform_settings").select("*").single();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Marketplace settings" />
      <div className="mb-6">
        <Notice tone="warn">
          The default 8% commission is a <strong>placeholder</strong> pending business approval. Changes apply to new checkouts only —
          existing orders keep the rate recorded at purchase.
        </Notice>
      </div>
      <SettingsForm settings={data as PlatformSettings} />
    </div>
  );
}
