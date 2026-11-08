import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function auditLog(
  adminId: string,
  action: string,
  target: { type: string; id: string },
  details?: Record<string, unknown>,
) {
  await createAdminClient()
    .from("admin_audit_log")
    .insert({ admin_id: adminId, action, target_type: target.type, target_id: target.id, details: details ?? null });
}
