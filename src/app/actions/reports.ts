"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { alertAdmins } from "@/lib/notify";
import type { ActionResult } from "@/lib/types";

const schema = z.object({
  target_type: z.enum(["listing", "user", "review", "message"]),
  target_id: z.string().uuid(),
  reason: z.enum(["prohibited_item", "scam_or_fraud", "misleading", "offensive", "harassment", "fake_review", "other"]),
  details: z.string().trim().max(2000).optional(),
});

export async function createReport(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please choose a reason" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to report" };

  const { error } = await supabase.from("reports").insert({ ...parsed.data, reporter_id: user.id });
  if (error) {
    if (error.code === "23505") return { ok: true, message: "You’ve already reported this — our team is reviewing it." };
    return { ok: false, error: "Could not submit report" };
  }
  await alertAdmins(`New ${parsed.data.target_type} report: ${parsed.data.reason}`, [parsed.data.details || "(no details)"], "/admin/reports");
  return { ok: true, message: "Thanks — our team will review this report." };
}
