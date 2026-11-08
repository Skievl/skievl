import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, siteLink } from "@/lib/email";
import { serverEnv } from "@/lib/env";

interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  email?: { subject?: string; paragraphs?: string[]; ctaLabel?: string } | false;
}

/** In-app notification + (optional) email. Safe to call from webhooks and actions. */
export async function notify({ userId, type, title, body, link, email }: NotifyInput) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({ user_id: userId, type, title, body, link });

  if (email === false) return;
  const { data } = await admin.auth.admin.getUserById(userId);
  const to = data.user?.email;
  if (!to) return;
  await sendEmail({
    to,
    subject: email?.subject ?? title,
    heading: title,
    paragraphs: email?.paragraphs ?? [body],
    cta: link ? { label: email?.ctaLabel ?? "View on SKIEVL", href: siteLink(link) } : undefined,
  });
}

export async function alertAdmins(subject: string, paragraphs: string[], link?: string) {
  if (!serverEnv.adminAlertEmail) {
    console.warn("[admin-alert]", subject, paragraphs.join(" "));
    return;
  }
  await sendEmail({
    to: serverEnv.adminAlertEmail,
    subject: `[SKIEVL admin] ${subject}`,
    heading: subject,
    paragraphs,
    cta: link ? { label: "Open admin", href: siteLink(link) } : undefined,
  });
}
