import Link from "next/link";
import { getSettings } from "@/lib/catalog";
import { formatPercentBps } from "@/lib/format";

export const metadata = {
  title: "How it works",
  description: "How buying and selling works on the Ellicottville Ski Exchange: secure checkout, local pickup or drop-off, and verified reviews.",
};

export default async function HowItWorks() {
  const s = await getSettings();
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-4xl font-extrabold">How the Exchange works</h1>
      <p className="mt-3 text-lg text-ink-soft">A local, trusted way to pass good gear on to the next skier — without meeting strangers with cash in hand.</p>

      <div className="prose-skievl mt-8">
        <h2>For buyers</h2>
        <ul>
          <li><strong>Search with real filters.</strong> Ski length, Mondo boot size, apparel size, brand, condition, and price.</li>
          <li><strong>Pay through SKIEVL.</strong> Card, Apple Pay, or Google Pay via Stripe. The item is held for you while you check out.</li>
          <li><strong>Pick up for free or choose drop-off.</strong> Pickup addresses are revealed only after payment. Drop-off is offered by some sellers in specific ZIP codes for a fee shown before you pay.</li>
          <li><strong>Confirm and review.</strong> Once you have the gear, confirm receipt. Then leave a verified review of the seller.</li>
        </ul>

        <h2>For sellers</h2>
        <ul>
          <li><strong>Free to list.</strong> SKIEVL charges a {formatPercentBps(s.commission_bps)} marketplace fee only when an item sells. Drop-off fees you set go to you{s.commission_on_dropoff_fee ? " (commission also applies to drop-off fees)" : ""}.</li>
          <li><strong>Get paid by Stripe.</strong> Verify your identity and add your bank once. Proceeds are paid out automatically.</li>
          <li><strong>Stay private.</strong> Listings show only your town. Your pickup address goes only to a buyer who has paid.</li>
          <li><strong>Be accurate.</strong> Reviews rate your communication, listing accuracy, and handoff — so describe wear honestly.</li>
        </ul>

        <h2 id="safety">Meeting safely</h2>
        <ul>
          <li>Always pay and get paid through SKIEVL. Off-platform payments (Venmo, Zelle, cash, gift cards) are not protected.</li>
          <li>Prefer daylight handoffs and public places when you can — the Village Square, a shop parking lot, or the resort base lodge.</li>
          <li>Inspect gear at pickup. If something is not as described, message the seller before confirming receipt, or contact us.</li>
          <li>Ski bindings must be adjusted and tested by a qualified shop technician before you ski on them.</li>
        </ul>

        <h2>Problems?</h2>
        <p>
          Message the other person first — most issues are quick to fix. If not, email <a className="text-sky underline" href={`mailto:${s.support_email}`}>{s.support_email}</a> with your order number. We can cancel and refund orders when a handoff doesn&apos;t happen.
        </p>
      </div>
      <div className="mt-10 flex gap-3">
        <Link href="/search" className="btn-primary">Browse gear</Link>
        <Link href="/sell" className="btn-secondary">Start selling</Link>
      </div>
    </div>
  );
}
