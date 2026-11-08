import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/** Mirror a connected account's capability flags into seller_profiles. */
export async function syncConnectedAccount(account: Stripe.Account) {
  const admin = createAdminClient();
  await admin
    .from("seller_profiles")
    .update({
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
    })
    .eq("stripe_account_id", account.id);

  // If a seller loses the ability to take payments, pull their live listings
  if (!account.charges_enabled) {
    const { data: seller } = await admin.from("seller_profiles").select("user_id").eq("stripe_account_id", account.id).maybeSingle();
    if (seller) {
      await admin.from("listings").update({ status: "unavailable" }).eq("seller_id", seller.user_id).eq("status", "active");
    }
  }
}
