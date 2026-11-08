import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * POST (form submit from /sell/setup): create the seller's Stripe Express
 * account if needed, then redirect to Stripe-hosted onboarding.
 * ?action=dashboard opens the Express dashboard (payouts, bank details, 1099s).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/sell/setup", request.url), 303);

  const admin = createAdminClient();
  const { data: seller } = await admin
    .from("seller_profiles")
    .select("user_id, shop_name, stripe_account_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!seller) return NextResponse.redirect(new URL("/sell/setup", request.url), 303);

  const stripe = getStripe();
  const action = request.nextUrl.searchParams.get("action");

  try {
    if (action === "dashboard" && seller.stripe_account_id) {
      const link = await stripe.accounts.createLoginLink(seller.stripe_account_id);
      return NextResponse.redirect(link.url, 303);
    }

    let accountId = seller.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create(
        {
          type: "express",
          country: "US",
          email: user.email,
          business_type: "individual",
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
          business_profile: {
            product_description: "Used ski and snowboard equipment sold on SKIEVL.com",
            url: `${publicEnv.siteUrl}/sellers/${user.id}`,
          },
          metadata: { user_id: user.id },
        },
        { idempotencyKey: `connect_account_${user.id}` },
      );
      accountId = account.id;
      await admin.from("seller_profiles").update({ stripe_account_id: accountId }).eq("user_id", user.id);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${publicEnv.siteUrl}/sell/setup?stripe=refresh`,
      return_url: `${publicEnv.siteUrl}/sell/setup?stripe=return`,
    });
    return NextResponse.redirect(link.url, 303);
  } catch (err) {
    console.error("[connect]", err);
    return NextResponse.redirect(new URL("/sell/setup?stripe=error", request.url), 303);
  }
}
