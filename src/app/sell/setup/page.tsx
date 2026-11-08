import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { syncConnectedAccount } from "@/lib/connect";
import { Notice, PageHeader } from "@/components/ui";
import { removeDropoffZip } from "@/app/actions/seller";
import { ShopForm, PickupAddressForm, ZipForm } from "./SetupForms";

export const metadata = { title: "Shop & payouts" };

const SUGGESTED_ZIPS: [string, string][] = [
  ["14731", "Ellicottville"],
  ["14741", "Great Valley"],
  ["14779", "Salamanca"],
  ["14755", "Little Valley"],
  ["14760", "Olean"],
  ["14141", "Springville"],
];

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const { stripe: stripeParam } = await searchParams;
  let session = await requireUser("/sell/setup");

  // Returning from Stripe onboarding: refresh capability flags right away
  if (stripeParam === "return" && session.seller?.stripe_account_id) {
    try {
      const account = await getStripe().accounts.retrieve(session.seller.stripe_account_id);
      await syncConnectedAccount(account);
      session = { ...session, seller: { ...session.seller, charges_enabled: account.charges_enabled, payouts_enabled: account.payouts_enabled, details_submitted: account.details_submitted } };
    } catch (e) {
      console.error("[setup] stripe sync", e);
    }
  }

  const seller = session.seller;
  const supabase = await createClient();
  const [{ data: priv }, { data: zips }] = await Promise.all([
    supabase.from("seller_private").select("*").maybeSingle(),
    seller ? supabase.from("dropoff_areas").select("*").eq("seller_id", seller.user_id).order("postal_code") : Promise.resolve({ data: [] as { id: string; postal_code: string; label: string | null }[] }),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader title={seller ? "Shop & payouts" : "Set up your shop"} subtitle="Everything buyers need to trust you — and everything you need to get paid." />

      {stripeParam === "error" && <Notice tone="error">We couldn&apos;t reach Stripe. Please try again.</Notice>}

      <section className="card p-6">
        <h2 className="text-lg font-bold">1. Shop profile</h2>
        <p className="mb-4 text-sm text-muted">Shown publicly on your listings and seller page.</p>
        <ShopForm shopName={seller?.shop_name ?? session.profile.display_name} town={seller?.town ?? "Ellicottville"} bio={seller?.bio ?? ""} />
      </section>

      <section className={`card p-6 ${seller ? "" : "pointer-events-none opacity-50"}`} id="payouts">
        <h2 className="text-lg font-bold">2. Payouts with Stripe</h2>
        <p className="mb-4 text-sm text-muted">
          SKIEVL uses Stripe to verify sellers and send your earnings to your bank. We never see your bank or SSN details.
        </p>
        {seller?.charges_enabled ? (
          <div className="space-y-3">
            <Notice tone="success">✓ Payouts are set up{seller.payouts_enabled ? "" : " — Stripe is still verifying your bank account"}.</Notice>
            <form action="/api/stripe/connect?action=dashboard" method="post">
              <button className="btn-secondary">Manage bank & payouts on Stripe</button>
            </form>
          </div>
        ) : (
          <form action="/api/stripe/connect" method="post" className="space-y-2">
            {seller?.details_submitted && <Notice tone="warn">Stripe needs a bit more information before you can accept payments.</Notice>}
            <button className="btn-dark" disabled={!seller}>{seller?.stripe_account_id ? "Continue Stripe setup" : "Set up payouts"}</button>
          </form>
        )}
      </section>

      <section className={`card p-6 ${seller ? "" : "pointer-events-none opacity-50"}`} id="pickup">
        <h2 className="text-lg font-bold">3. Private pickup address</h2>
        <p className="mb-4 text-sm text-muted">
          🔒 Never shown publicly. Only shared with a buyer <strong>after they’ve paid</strong> and chosen pickup. Listings show your town only.
        </p>
        <PickupAddressForm
          initial={{
            address_line1: priv?.address_line1 ?? "",
            address_line2: priv?.address_line2 ?? "",
            city: priv?.city ?? "Ellicottville",
            postal_code: priv?.postal_code ?? "",
            pickup_instructions: priv?.pickup_instructions ?? "",
            phone: priv?.phone ?? "",
          }}
        />
      </section>

      <section className={`card p-6 ${seller ? "" : "pointer-events-none opacity-50"}`} id="dropoff">
        <h2 className="text-lg font-bold">4. Drop-off area (optional)</h2>
        <p className="mb-4 text-sm text-muted">
          If you offer drop-off, buyers in these ZIP codes can choose it at checkout. You set the fee on each listing.
        </p>
        <ul className="mb-4 flex flex-wrap gap-2">
          {(zips ?? []).map((z) => (
            <li key={z.id} className="chip">
              {z.postal_code}{z.label ? ` · ${z.label}` : ""}
              <form action={removeDropoffZip.bind(null, z.id)}>
                <button className="ml-1 text-muted hover:text-danger" aria-label={`Remove ${z.postal_code}`}>×</button>
              </form>
            </li>
          ))}
          {(zips ?? []).length === 0 && <li className="text-sm text-muted">No drop-off ZIP codes yet.</li>}
        </ul>
        <ZipForm suggestions={SUGGESTED_ZIPS.filter(([z]) => !(zips ?? []).some((x) => x.postal_code === z))} />
      </section>
    </div>
  );
}
