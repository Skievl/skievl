"use client";
import { useActionState, useRef } from "react";
import { addDropoffZip, savePickupAddress, saveShop } from "@/app/actions/seller";
import { FieldError, FormMessage, SubmitButton, initialState } from "@/components/forms";

export function ShopForm({ shopName, town, bio }: { shopName: string; town: string; bio: string }) {
  const [state, action] = useActionState(saveShop, initialState);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="shop_name">Shop name</label>
          <input id="shop_name" name="shop_name" defaultValue={shopName} required maxLength={60} className="input" />
          <FieldError state={state} name="shop_name" />
        </div>
        <div>
          <label className="label" htmlFor="town">Town (public)</label>
          <input id="town" name="town" defaultValue={town} required maxLength={80} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="bio">About you (optional)</label>
        <textarea id="bio" name="bio" defaultValue={bio} rows={3} maxLength={1000} className="input" placeholder="Lifelong Holiday Valley skier clearing out the family gear closet…" />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Save shop profile</SubmitButton>
    </form>
  );
}

export function PickupAddressForm({ initial }: { initial: Record<string, string> }) {
  const [state, action] = useActionState(savePickupAddress, initialState);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label" htmlFor="address_line1">Street address</label>
        <input id="address_line1" name="address_line1" defaultValue={initial.address_line1} required autoComplete="address-line1" className="input" />
        <FieldError state={state} name="address_line1" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="address_line2">Unit / condo (optional)</label>
        <input id="address_line2" name="address_line2" defaultValue={initial.address_line2} autoComplete="address-line2" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="city">Town</label>
        <input id="city" name="city" defaultValue={initial.city} required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="postal_code">ZIP</label>
        <input id="postal_code" name="postal_code" defaultValue={initial.postal_code} required inputMode="numeric" maxLength={5} className="input" />
        <FieldError state={state} name="postal_code" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="pickup_instructions">Pickup instructions (optional)</label>
        <textarea id="pickup_instructions" name="pickup_instructions" defaultValue={initial.pickup_instructions} rows={2} maxLength={500} className="input" placeholder="Side door by the garage. Text when you arrive." />
      </div>
      <div>
        <label className="label" htmlFor="phone">Phone for pickup (optional)</label>
        <input id="phone" name="phone" type="tel" defaultValue={initial.phone} maxLength={30} className="input" />
        <p className="hint">Shared with the buyer after payment.</p>
      </div>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
        <div className="mt-3"><SubmitButton>Save private address</SubmitButton></div>
      </div>
    </form>
  );
}

export function ZipForm({ suggestions }: { suggestions: [string, string][] }) {
  const [state, action] = useActionState(addDropoffZip, initialState);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <div className="space-y-3">
      <form ref={ref} action={action} className="flex flex-wrap gap-2">
        <input name="postal_code" inputMode="numeric" maxLength={5} placeholder="ZIP" required className="input w-28" aria-label="ZIP code" />
        <input name="label" placeholder="Label (e.g. Great Valley)" maxLength={80} className="input w-56" aria-label="Label" />
        <SubmitButton className="btn-secondary">Add</SubmitButton>
      </form>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Quick add:</span>
          {suggestions.map(([zip, label]) => (
            <form key={zip} action={action}>
              <input type="hidden" name="postal_code" value={zip} />
              <input type="hidden" name="label" value={label} />
              <button className="chip hover:border-sky">+ {label} {zip}</button>
            </form>
          ))}
        </div>
      )}
      <FormMessage state={state} />
    </div>
  );
}
