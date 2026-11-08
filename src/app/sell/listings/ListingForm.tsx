"use client";
import { useActionState, useState } from "react";
import { saveListing } from "@/app/actions/listings";
import { FieldError, FormMessage, SubmitButton } from "@/components/forms";
import { AGE_GROUP_LABELS, CONDITION_HELP, CONDITION_LABELS, GENDER_LABELS } from "@/lib/format";
import { BOOT_SYSTEM_LABELS, fromMondo, toMondo, type BootSystem } from "@/lib/sizes";
import type { ActionResult, AttributeDefinition, Brand, Category, Listing } from "@/lib/types";

interface Props {
  categories: Category[];
  brands: Brand[];
  listing?: Listing;
  hasDropoffArea: boolean;
}

const init: ActionResult<{ id: string }> = { ok: true };

export function ListingForm({ categories, brands, listing, hasDropoffArea }: Props) {
  const [state, action] = useActionState(saveListing, init);
  const [categoryId, setCategoryId] = useState(listing?.category_id ?? "");
  const [brandId, setBrandId] = useState(listing ? listing.brand_id ?? "other" : "");
  const [dropoff, setDropoff] = useState(listing?.offers_dropoff ?? false);
  const category = categories.find((c) => c.id === categoryId);
  const featured = brands.filter((b) => b.is_featured);
  const others = brands.filter((b) => !b.is_featured);

  return (
    <form action={action} className="space-y-8">
      {listing && <input type="hidden" name="listing_id" value={listing.id} />}

      <Section title="What are you selling?">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="category_id">Product type</label>
            <select id="category_id" name="category_id" className="input" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="" disabled>Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <FieldError state={state} name="category_id" />
          </div>
          <div>
            <label className="label" htmlFor="brand_id">Brand</label>
            <select id="brand_id" className="input" value={brandId} onChange={(e) => setBrandId(e.target.value)} required>
              <option value="" disabled>Choose…</option>
              <optgroup label="Popular">
                {featured.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </optgroup>
              <optgroup label="More brands">
                {others.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </optgroup>
              <option value="other">Other / not listed</option>
            </select>
            <input type="hidden" name="brand_id" value={brandId === "other" ? "" : brandId} />
            {brandId === "other" && (
              <input name="brand_other" defaultValue={listing?.brand_other ?? ""} placeholder="Brand name" maxLength={60} className="input mt-2" required />
            )}
            <FieldError state={state} name="brand_id" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="title">Listing title</label>
          <input id="title" name="title" defaultValue={listing?.title} required maxLength={100} className="input" placeholder="e.g. Völkl Mantra M6 skis with Marker bindings" />
          <FieldError state={state} name="title" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="model">Model (optional)</label>
            <input id="model" name="model" defaultValue={listing?.model ?? ""} maxLength={100} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="model_year">Model year (optional)</label>
            <input id="model_year" name="model_year" defaultValue={listing?.model_year ?? ""} inputMode="numeric" maxLength={4} className="input" placeholder="2023" />
          </div>
        </div>
      </Section>

      {category && (
        <Section title="Size & specs" subtitle={`Structured details help buyers find your ${category.name.toLowerCase()} with filters.`}>
          <div className="grid gap-4 sm:grid-cols-2">
            {category.uses_gender && (
              <div>
                <label className="label" htmlFor="gender">Fit</label>
                <select id="gender" name="gender" className="input" defaultValue={listing?.gender ?? ""} required>
                  <option value="" disabled>Choose…</option>
                  {Object.entries(GENDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <FieldError state={state} name="gender" />
              </div>
            )}
            {category.uses_age_group && (
              <div>
                <label className="label" htmlFor="age_group">Age group</label>
                <select id="age_group" name="age_group" className="input" defaultValue={listing?.age_group ?? ""} required>
                  <option value="" disabled>Choose…</option>
                  {Object.entries(AGE_GROUP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <FieldError state={state} name="age_group" />
              </div>
            )}
            {category.attribute_definitions.map((def) => (
              <AttributeField key={`${category.id}-${def.key}`} def={def} initial={listing?.category_id === category.id ? listing.attributes[def.key] : undefined} state={state} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Condition">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(CONDITION_LABELS) as (keyof typeof CONDITION_LABELS)[]).map((c) => (
            <label key={c} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 has-[:checked]:border-ember has-[:checked]:bg-ember/5">
              <input type="radio" name="condition" value={c} defaultChecked={listing?.condition === c} required className="mt-1 accent-ember" />
              <span className="text-sm">
                <span className="font-semibold">{CONDITION_LABELS[c]}</span>
                <span className="block text-muted">{CONDITION_HELP[c]}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError state={state} name="condition" />
        <div>
          <label className="label" htmlFor="condition_notes">Describe any wear (recommended)</label>
          <textarea id="condition_notes" name="condition_notes" defaultValue={listing?.condition_notes ?? ""} rows={2} maxLength={1000} className="input" placeholder="Base has a few light scratches, edges recently tuned, no core shots." />
        </div>
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea id="description" name="description" defaultValue={listing?.description ?? ""} rows={5} maxLength={5000} className="input" placeholder="What's included, how many days used, why you're selling, binding DIN range…" />
        </div>
      </Section>

      <Section title="Price & fulfillment">
        <div className="max-w-xs">
          <label className="label" htmlFor="price">Asking price</label>
          <div className="relative">
            <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted">$</span>
            <input id="price" name="price" inputMode="decimal" required defaultValue={listing ? (listing.price_cents / 100).toFixed(2).replace(/\.00$/, "") : ""} className="input pl-7" />
          </div>
          <FieldError state={state} name="price" />
        </div>
        <div className="space-y-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="offers_pickup" defaultChecked={listing?.offers_pickup ?? true} className="mt-1 h-4 w-4 accent-ember" />
            <span className="text-sm"><span className="font-semibold">Buyer pickup (free)</span><span className="block text-muted">Your private address is shared only after payment.</span></span>
          </label>
          <FieldError state={state} name="offers_pickup" />
          <label className="flex items-start gap-3">
            <input type="checkbox" name="offers_dropoff" checked={dropoff} onChange={(e) => setDropoff(e.target.checked)} className="mt-1 h-4 w-4 accent-ember" />
            <span className="text-sm"><span className="font-semibold">Seller drop-off (paid)</span><span className="block text-muted">You deliver within your drop-off ZIP codes for a fee you set.</span></span>
          </label>
          {dropoff && (
            <div className="ml-7 max-w-xs">
              <label className="label" htmlFor="dropoff_fee">Drop-off fee</label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted">$</span>
                <input id="dropoff_fee" name="dropoff_fee" inputMode="decimal" defaultValue={listing ? (listing.dropoff_fee_cents / 100).toString() : "15"} className="input pl-7" />
              </div>
              <FieldError state={state} name="dropoff_fee" />
              {!hasDropoffArea && <p className="mt-1 text-xs text-[#8a5a10]">Add drop-off ZIP codes in Shop &amp; payouts before publishing.</p>}
            </div>
          )}
        </div>
      </Section>

      <FormMessage state={state} />
      <div className="flex gap-3">
        <SubmitButton pendingText="Saving…">{listing ? "Save changes" : "Save & add photos →"}</SubmitButton>
      </div>
    </form>
  );
}

function AttributeField({ def, initial, state }: { def: AttributeDefinition; initial: unknown; state: ActionResult<unknown> }) {
  const name = `attr.${def.key}`;
  const [system, setSystem] = useState<BootSystem>("mondo");
  const [bootDisplay, setBootDisplay] = useState(initial !== undefined ? String(initial) : "");

  if (def.data_type === "enum") {
    return (
      <div>
        <label className="label" htmlFor={name}>{def.label}{def.is_required ? "" : " (optional)"}</label>
        <select id={name} name={name} className="input" defaultValue={(initial as string) ?? ""} required={def.is_required}>
          <option value="">{def.is_required ? "Choose…" : "—"}</option>
          {def.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <FieldError state={state} name={name} />
      </div>
    );
  }
  if (def.data_type === "boolean") {
    return (
      <div>
        <label className="label" htmlFor={name}>{def.label}</label>
        <select id={name} name={name} className="input" defaultValue={initial === undefined ? "" : String(initial)}>
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </div>
    );
  }
  if (def.data_type === "boot_size") {
    const mondo = bootDisplay === "" ? "" : String(toMondo(Number(bootDisplay), system));
    return (
      <div>
        <span className="label">Boot size</span>
        <div className="flex gap-2">
          <select
            className="input w-40"
            value={system}
            aria-label="Size system"
            onChange={(e) => {
              const next = e.target.value as BootSystem;
              if (bootDisplay !== "") setBootDisplay(String(fromMondo(toMondo(Number(bootDisplay), system), next)));
              setSystem(next);
            }}
          >
            {Object.entries(BOOT_SYSTEM_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input className="input" inputMode="decimal" value={bootDisplay} onChange={(e) => setBootDisplay(e.target.value.replace(/[^\d.]/g, ""))} placeholder={system === "mondo" ? "26.5" : "8.5"} aria-label="Boot size" required={def.is_required} />
        </div>
        <input type="hidden" name={name} value={mondo} />
        {mondo && <p className="hint">Saved as Mondo {mondo} (≈ US men&apos;s {fromMondo(Number(mondo), "us_mens")}, women&apos;s {fromMondo(Number(mondo), "us_womens")}). Check the size printed on the boot liner or shell.</p>}
        <FieldError state={state} name={name} />
      </div>
    );
  }
  return (
    <div>
      <label className="label" htmlFor={name}>{def.label}{def.unit ? ` (${def.unit})` : ""}{def.is_required ? "" : " (optional)"}</label>
      <input id={name} name={name} inputMode="decimal" defaultValue={initial !== undefined ? String(initial) : ""} className="input" required={def.is_required} placeholder={def.min_value !== null ? `${def.min_value}–${def.max_value}` : undefined} />
      <FieldError state={state} name={name} />
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
