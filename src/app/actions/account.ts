"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";

const schema = z.object({
  display_name: z.string().trim().min(1).max(60),
  home_town: z.string().trim().max(80).optional(),
});

export async function updateProfile(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Enter a display name (max 60 characters)" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again" };
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.display_name, home_town: parsed.data.home_town || null })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Could not save" };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}
