import "server-only";
import { publicEnv, serverEnv } from "@/lib/env";

interface SendEmailInput {
  to: string | string[];
  subject: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; href: string };
  replyTo?: string;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderEmail({ heading, paragraphs, cta }: SendEmailInput) {
  const ctaHtml = cta
    ? `<p style="margin:28px 0"><a href="${escapeHtml(cta.href)}" style="background:#d9542b;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#13293d">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#13293d;padding:20px 28px;color:#fff;font-weight:700;letter-spacing:.02em">ELLICOTTVILLE SKI EXCHANGE</td></tr>
    <tr><td style="padding:28px">
      <h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(heading)}</h1>
      ${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.55;margin:0 0 12px">${escapeHtml(p)}</p>`).join("")}
      ${ctaHtml}
    </td></tr>
    <tr><td style="padding:18px 28px;background:#f8fafb;font-size:12px;color:#5b6b78">
      SKIEVL.com · Buy. Sell. Trade. Ski Local. · Ellicottville, NY<br/>
      You received this because of activity on your SKIEVL account.
    </td></tr>
  </table></td></tr></table></body></html>`;
}

/** Send a transactional email via Resend's HTTP API. Never throws — logs failures. */
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  if (!serverEnv.resendApiKey) {
    console.info("[email:disabled]", input.subject, "→", input.to);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${serverEnv.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: serverEnv.emailFrom,
        to: input.to,
        subject: input.subject,
        html: renderEmail(input),
        text: [input.heading, "", ...input.paragraphs, input.cta ? `\n${input.cta.label}: ${input.cta.href}` : ""].join("\n"),
        reply_to: input.replyTo,
      }),
    });
    if (!res.ok) {
      console.error("[email:error]", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email:error]", err);
    return false;
  }
}

export const siteLink = (path: string) => `${publicEnv.siteUrl}${path}`;
