import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Housekeeping (Vercel Cron, see vercel.json):
 *  - release checkout holds whose time ran out (safety net for missed webhooks)
 *  - auto-complete orders N days after pickup/delivery so reviews unlock
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!serverEnv.cronSecret || auth !== `Bearer ${serverEnv.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const [expired, completed] = await Promise.all([
    admin.rpc("expire_stale_reservations"),
    admin.rpc("auto_complete_orders"),
  ]);
  if (expired.error || completed.error) {
    console.error("[cron]", expired.error, completed.error);
    return NextResponse.json({ error: "Maintenance failed" }, { status: 500 });
  }
  return NextResponse.json({ expired: expired.data, completed: completed.data });
}
