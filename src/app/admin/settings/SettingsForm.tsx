"use client";
import { useActionState, useState } from "react";
import { saveSettings } from "@/app/actions/admin";
import { FieldError, FormMessage, SubmitButton, initialState } from "@/components/forms";
import { formatMoney } from "@/lib/format";
import type { PlatformSettings } from "@/lib/types";

export function SettingsForm({ settings: s }: { settings: PlatformSettings }) {
  const [state, action] = useActionState(saveSettings, initialState);
  const [pct, setPct] = useState(String(s.commission_bps / 100));
  const example = Math.round(35000 * (Number(pct) || 0) / 100);

  return (
    <form action={action} className="card space-y-6 p-6">
      <fieldset className="space-y-4">
        <legend className="font-bold">Commission</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="commission_percent">Commission rate (%)</label>
            <input id="commission_percent" name="commission_percent" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} className="input" />
            <p className="hint">On a $350 item: SKIEVL keeps {formatMoney(example)}, seller gets {formatMoney(35000 - example)} (before Stripe fees, which SKIEVL pays).</p>
            <FieldError state={state} name="commission_percent" />
          </div>
          <div>
            <label className="label" htmlFor="min_platform_fee">Minimum fee per order ($)</label>
            <input id="min_platform_fee" name="min_platform_fee" inputMode="decimal" defaultValue={(s.min_platform_fee_cents / 100).toString()} className="input" />
            <p className="hint">Helps cover Stripe&apos;s fixed per-transaction cost on cheap items.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="commission_on_dropoff_fee" defaultChecked={s.commission_on_dropoff_fee} className="h-4 w-4 accent-ember" />
          Also charge commission on the seller&apos;s drop-off fee
        </label>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-bold">Listings</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="require_listing_approval" defaultChecked={s.require_listing_approval} className="h-4 w-4 accent-ember" />
          Require admin approval before new listings go live
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="max_price">Maximum item price ($)</label>
            <input id="max_price" name="max_price" inputMode="decimal" defaultValue={(s.max_price_cents / 100).toString()} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="max_dropoff_fee">Maximum drop-off fee ($)</label>
            <input id="max_dropoff_fee" name="max_dropoff_fee" inputMode="decimal" defaultValue={(s.max_dropoff_fee_cents / 100).toString()} className="input" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-bold">Orders</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="reservation_minutes">Checkout hold (minutes)</label>
            <input id="reservation_minutes" name="reservation_minutes" type="number" min={33} max={120} defaultValue={s.reservation_minutes} className="input" />
            <p className="hint">How long an item is held while a buyer is in checkout. Minimum 33 (Stripe sessions last 31).</p>
          </div>
          <div>
            <label className="label" htmlFor="auto_complete_days">Auto-complete after (days)</label>
            <input id="auto_complete_days" name="auto_complete_days" type="number" min={1} max={30} defaultValue={s.auto_complete_days} className="input" />
            <p className="hint">Days after pickup/delivery before an unconfirmed order completes.</p>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-bold">General</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="market_name">Market name</label>
            <input id="market_name" name="market_name" defaultValue={s.market_name} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="support_email">Support email</label>
            <input id="support_email" name="support_email" type="email" defaultValue={s.support_email} className="input" />
          </div>
        </div>
      </fieldset>

      <FormMessage state={state} />
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}
