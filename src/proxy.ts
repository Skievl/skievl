import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// Next.js 16 "proxy" (formerly middleware): refresh auth session + guard private routes.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets, images, and the Stripe webhook (needs the raw body, no auth).
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|api/stripe/webhook|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
