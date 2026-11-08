import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Service-role client. BYPASSES Row Level Security.
 * Only use in trusted server code (webhooks, cron, admin actions) AFTER
 * verifying the caller is allowed to perform the operation.
 */
export function createAdminClient() {
  return createSupabaseClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
