"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import type { ActionResult } from "@/lib/types";

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(72),
});

export async function signIn(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check your email and password", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: error.message === "Email not confirmed" ? "Please confirm your email first — check your inbox." : "Incorrect email or password." };
  redirect(safeNext(formData.get("next")));
}

const signUpSchema = credentials.extend({
  display_name: z.string().trim().min(1, "Enter your name").max(60),
  terms: z.literal("on", { errorMap: () => ({ message: "Please accept the terms" }) }),
});

export async function signUp(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields", fieldErrors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.display_name },
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { ok: false, error: error.message };
  if (data.session) redirect(next); // email confirmation disabled
  return { ok: true, message: "Check your email to confirm your account, then sign in." };
}

export async function requestPasswordReset(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = z.string().trim().email().safeParse(formData.get("email"));
  if (!email.success) return { ok: false, error: "Enter a valid email" };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/account/password`,
  });
  // Same response whether or not the account exists
  return { ok: true, message: "If that email has an account, a reset link is on its way." };
}

export async function updatePassword(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const pw = z.string().min(8, "Use at least 8 characters").max(72).safeParse(formData.get("password"));
  if (!pw.success) return { ok: false, error: pw.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pw.data });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "Password updated." };
}
