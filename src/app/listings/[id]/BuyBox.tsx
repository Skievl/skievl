"use client";
import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@/lib/format";

interface Props {
  listingId: string;
  priceCents: number;
  offersPickup: boolean;
  offersDropoff: boolean;
  dropoffFeeCents: number;
  dropoffZips: string[];
  signedIn: boolean;
  sellerTown: string;
}

export function BuyBox(p: Props) {
  const [method, setMethod] = useState<"pickup" | "dropoff">(p.offersPickup ? "pickup" : "dropoff");
  const [addr, setAddr] = useState({ line1: "", line2: "", city: "", postal_code: "" });
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fee = method === "dropoff" ? p.dropoffFeeCents : 0;
  const zipOk = method === "pickup" || p.dropoffZips.includes(addr.postal_code);

  async function checkout() {
    setError(null);
    if (method === "dropoff") {
      if (!addr.line1.trim() || !/^\d{5}$/.test(addr.postal_code)) return setError("Enter your drop-off street address and 5-digit ZIP.");
      if (!zipOk) return setError("The seller doesn’t drop off in that ZIP code. Choose pickup or a different address.");
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: p.listingId,
          method,
          dropoff: method === "dropoff" ? { ...addr, state: "NY" } : undefined,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? "Checkout failed. Please try again.");
      window.location.assign(json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-bold">How do you want to get it?</legend>
        <div className="space-y-2">
          {p.offersPickup && (
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${method === "pickup" ? "border-ember bg-ember/5" : "border-line"}`}>
              <input type="radio" name="method" className="mt-1 accent-ember" checked={method === "pickup"} onChange={() => setMethod("pickup")} />
              <span className="flex-1 text-sm">
                <span className="flex justify-between font-semibold">Pick up <span>Free</span></span>
                <span className="text-muted">In {p.sellerTown}. Exact address shared after payment.</span>
              </span>
            </label>
          )}
          {p.offersDropoff && (
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${method === "dropoff" ? "border-ember bg-ember/5" : "border-line"}`}>
              <input type="radio" name="method" className="mt-1 accent-ember" checked={method === "dropoff"} onChange={() => setMethod("dropoff")} />
              <span className="flex-1 text-sm">
                <span className="flex justify-between font-semibold">Seller drop-off <span>{formatMoney(p.dropoffFeeCents)}</span></span>
                <span className="text-muted">Delivers to ZIP {p.dropoffZips.join(", ") || "—"}</span>
              </span>
            </label>
          )}
        </div>
      </fieldset>

      {method === "dropoff" && (
        <div className="grid grid-cols-2 gap-2">
          <input className="input col-span-2" placeholder="Street address" autoComplete="address-line1" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} aria-label="Street address" />
          <input className="input col-span-2" placeholder="Apt, condo, lodge (optional)" autoComplete="address-line2" value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} aria-label="Address line 2" />
          <input className="input" placeholder="Town" autoComplete="address-level2" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} aria-label="Town" />
          <input className="input" placeholder="ZIP" inputMode="numeric" maxLength={5} autoComplete="postal-code" value={addr.postal_code} onChange={(e) => setAddr({ ...addr, postal_code: e.target.value.replace(/\D/g, "") })} aria-label="ZIP code" />
          {addr.postal_code.length === 5 && !zipOk && <p className="field-error col-span-2">Seller doesn&apos;t deliver to {addr.postal_code}.</p>}
        </div>
      )}

      <textarea className="input" rows={2} maxLength={500} placeholder="Note to seller (optional) — e.g. best times to meet" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note to seller" />

      <dl className="space-y-1 border-t border-line pt-3 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Item</dt><dd>{formatMoney(p.priceCents)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">{method === "dropoff" ? "Drop-off fee" : "Pickup"}</dt><dd>{fee ? formatMoney(fee) : "Free"}</dd></div>
        <div className="flex justify-between text-base font-bold"><dt>Total</dt><dd>{formatMoney(p.priceCents + fee)}</dd></div>
      </dl>

      {error && <p role="alert" className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>}

      {p.signedIn ? (
        <button type="button" className="btn-primary w-full py-3 text-base" onClick={checkout} disabled={loading}>
          {loading ? "Holding item…" : "Buy now"}
        </button>
      ) : (
        <Link href={`/login?next=/listings/${p.listingId}`} className="btn-primary w-full py-3 text-base">Sign in to buy</Link>
      )}
      <p className="text-center text-xs text-muted">The item is held for you during checkout. Secure payment by Stripe.</p>
    </div>
  );
}
