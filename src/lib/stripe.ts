import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env";

let stripe: Stripe | null = null;

/** Stripe client (uses the API version pinned by the installed SDK). */
export function getStripe(): Stripe {
  if (!stripe) {
    stripe = new Stripe(serverEnv.stripeSecretKey, {
      appInfo: { name: "SKIEVL Marketplace", url: "https://skievl.com" },
      maxNetworkRetries: 2,
    });
  }
  return stripe;
}
