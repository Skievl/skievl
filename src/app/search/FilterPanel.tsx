"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { AGE_GROUP_LABELS, CONDITION_LABELS, GENDER_LABELS } from "@/lib/format";
import { BOOT_SYSTEM_LABELS, LENGTH_PRESETS, PRICE_PRESETS, fromMondo, type BootSystem } from "@/lib/sizes";
import type { AttributeDefinition, Brand, Category } from "@/lib/types";

interface Props {
  categories: Category[];
  brands: Brand[];
}

export function FilterPanel({ categories, brands }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [showAllBrands, setShowAllBrands] = useState(false);

  const category = categories.find((c) => c.slug === params.get("category")) ?? null;

  function push(mutate: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    next.delete("page");
    start(() => router.push(`/search?${next.toString()}`, { scroll: false }));
  }
  const setParam = (key: string, value: string | null) =>
    push((p) => (value ? p.set(key, value) : p.delete(key)));
  const listOf = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const toggleIn = (key: string, value: string) =>
    push((p) => {
      const cur = new Set(listOf(key));
      if (cur.has(value)) cur.delete(value);
      else cur.add(value);
      if (cur.size) p.set(key, [...cur].join(","));
      else p.delete(key);
    });

  function setCategory(slug: string | null) {
    push((p) => {
      for (const k of [...p.keys()]) if (k.startsWith("a.") || k.startsWith("r.")) p.delete(k);
      if (slug) p.set("category", slug);
      else p.delete("category");
      const cat = categories.find((c) => c.slug === slug);
      if (cat && !cat.uses_gender) p.delete("gender");
      if (cat && !cat.uses_age_group) p.delete("age");
    });
  }

  const featured = brands.filter((b) => b.is_featured);
  const visibleBrands = showAllBrands ? brands : featured;
  const activeCount = [...params.keys()].filter((k) => !["q", "sort", "page"].includes(k)).length;

  const panel = (
    <div className={`space-y-6 ${pending ? "opacity-60" : ""}`}>
      <Section title="Product type">
        <select className="input" value={category?.slug ?? ""} onChange={(e) => setCategory(e.target.value || null)} aria-label="Product type">
          <option value="">All gear</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </Section>

      {/* Category-specific filters appear only when a category is chosen */}
      {category?.attribute_definitions
        .filter((d) => d.is_filterable)
        .map((def) => (
          <AttributeFilter key={def.id} def={def} categorySlug={category.slug} params={params} toggleIn={toggleIn} setParam={setParam} />
        ))}

      {(!category || category.uses_gender) && (
        <Section title="Gender">
          <Checks options={Object.entries(GENDER_LABELS)} selected={listOf("gender")} onToggle={(v) => toggleIn("gender", v)} />
          <p className="hint">Unisex items are included with Men&apos;s and Women&apos;s.</p>
        </Section>
      )}

      {(!category || category.uses_age_group) && (
        <Section title="Age group">
          <Checks options={Object.entries(AGE_GROUP_LABELS)} selected={listOf("age")} onToggle={(v) => toggleIn("age", v)} />
        </Section>
      )}

      <Section title="Price">
        <RangeInputs
          key={`price|${params.get("min")}|${params.get("max")}`}
          prefix="$"
          min={params.get("min") ?? ""}
          max={params.get("max") ?? ""}
          onApply={(lo, hi) => push((p) => { lo ? p.set("min", lo) : p.delete("min"); hi ? p.set("max", hi) : p.delete("max"); })}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRICE_PRESETS.map((pr) => (
            <button
              key={pr.label}
              type="button"
              className="chip hover:border-sky"
              onClick={() => push((p) => { pr.min ? p.set("min", String(pr.min)) : p.delete("min"); pr.max ? p.set("max", String(pr.max)) : p.delete("max"); })}
            >
              {pr.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Condition">
        <Checks options={Object.entries(CONDITION_LABELS)} selected={listOf("condition")} onToggle={(v) => toggleIn("condition", v)} />
      </Section>

      <Section title="Brand">
        <Checks
          options={[...visibleBrands.map((b) => [b.slug, b.name] as [string, string]), ["other", "Other brands"]]}
          selected={listOf("brand")}
          onToggle={(v) => toggleIn("brand", v)}
        />
        <button type="button" className="mt-2 text-xs font-semibold text-sky" onClick={() => setShowAllBrands((s) => !s)}>
          {showAllBrands ? "Show fewer brands" : `Show all ${brands.length} brands`}
        </button>
      </Section>

      <Section title="Fulfillment">
        <Radios
          name="fulfillment"
          options={[["", "Any"], ["pickup", "Free buyer pickup"], ["dropoff", "Seller drop-off available"]]}
          value={params.get("fulfillment") ?? ""}
          onChange={(v) => setParam("fulfillment", v || null)}
        />
      </Section>

      <Section title="Seller rating">
        <Radios
          name="rating"
          options={[["", "Any"], ["4", "4+ stars"], ["4.5", "4.5+ stars"]]}
          value={params.get("rating") ?? ""}
          onChange={(v) => setParam("rating", v || null)}
        />
      </Section>

      {activeCount > 0 && (
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => start(() => router.push(params.get("q") ? `/search?q=${encodeURIComponent(params.get("q")!)}` : "/search"))}
        >
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="lg:hidden">
        <button type="button" className="btn-secondary w-full" onClick={() => setOpen(true)} aria-expanded={open}>
          Filters{activeCount ? ` (${activeCount})` : ""}
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="relative ml-auto h-full w-[88%] max-w-sm overflow-y-auto bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Filters</h2>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Done</button>
            </div>
            {panel}
          </div>
        </div>
      )}
      <aside className="hidden lg:block" aria-label="Filters">{panel}</aside>
    </>
  );
}

function AttributeFilter({
  def,
  categorySlug,
  params,
  toggleIn,
  setParam,
}: {
  def: AttributeDefinition;
  categorySlug: string;
  params: URLSearchParams | ReturnType<typeof useSearchParams>;
  toggleIn: (k: string, v: string) => void;
  setParam: (k: string, v: string | null) => void;
}) {
  const [system, setSystem] = useState<BootSystem>("us_mens");
  if (def.data_type === "enum") {
    const key = `a.${def.key}`;
    const selected = (params.get(key) ?? "").split(",").filter(Boolean);
    return (
      <Section title={def.label}>
        <Checks options={(def.options ?? []).map((o) => [o.value, o.label])} selected={selected} onToggle={(v) => toggleIn(key, v)} />
      </Section>
    );
  }
  if (def.data_type === "boolean") {
    return (
      <Section title={def.label}>
        <Radios name={def.key} options={[["", "Any"], ["true", "Yes"], ["false", "No"]]} value={params.get(`a.${def.key}`) ?? ""} onChange={(v) => setParam(`a.${def.key}`, v || null)} />
      </Section>
    );
  }
  const key = `r.${def.key}`;
  const [lo, hi] = (params.get(key) ?? "").split("-");

  if (def.data_type === "boot_size") {
    const sizes: number[] = [];
    for (let m = def.min_value ?? 15; m <= (def.max_value ?? 33.5); m += 0.5) sizes.push(m);
    const options = sizes.map((m) => ({ mondo: m, label: String(fromMondo(m, system)) })).filter((o) => Number(o.label) > 0);
    return (
      <Section title="Boot size">
        <select className="input mb-2" value={system} onChange={(e) => setSystem(e.target.value as BootSystem)} aria-label="Size system">
          {Object.entries(BOOT_SYSTEM_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          {(["min", "max"] as const).map((which) => (
            <select
              key={which}
              className="input"
              aria-label={`${which === "min" ? "Minimum" : "Maximum"} boot size`}
              value={which === "min" ? lo ?? "" : hi ?? ""}
              onChange={(e) => {
                const nlo = which === "min" ? e.target.value : lo ?? "";
                const nhi = which === "max" ? e.target.value : hi ?? "";
                setParam(key, nlo || nhi ? `${nlo}-${nhi}` : null);
              }}
            >
              <option value="">{which === "min" ? "Min" : "Max"}</option>
              {options.map((o) => (
                <option key={o.mondo} value={o.mondo}>{o.label}</option>
              ))}
            </select>
          ))}
        </div>
        <p className="hint">Sizes are matched on Mondopoint; US sizes are approximate ({system !== "mondo" && `Mondo = US + ${system === "us_mens" ? 18 : 17}`}).</p>
      </Section>
    );
  }

  const presets = def.key === "length_cm" ? LENGTH_PRESETS[categorySlug] : undefined;
  return (
    <Section title={`${def.label}${def.unit ? ` (${def.unit})` : ""}`}>
      <RangeInputs
        key={`${key}|${lo}|${hi}`}
        min={lo ?? ""}
        max={hi ?? ""}
        onApply={(a, b) => setParam(key, a || b ? `${a}-${b}` : null)}
        suffix={def.unit ?? undefined}
      />
      {presets && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={p.label} type="button" className="chip hover:border-sky" onClick={() => setParam(key, `${p.min ?? ""}-${p.max ?? ""}`)}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      {def.key === "length_cm" && <SizeTip slug={categorySlug} />}
    </Section>
  );
}

function SizeTip({ slug }: { slug: string }) {
  if (slug === "skis") return <p className="hint">Tip: most adults ski a length between chin and the top of the head.</p>;
  if (slug === "snowboards") return <p className="hint">Tip: an all-mountain board usually stands between chin and nose.</p>;
  return null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Checks({ options, selected, onToggle }: { options: [string, string][]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      {options.map(([v, l]) => (
        <label key={v} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" checked={selected.includes(v)} onChange={() => onToggle(v)} className="h-4 w-4 rounded accent-ember" />
          {l}
        </label>
      ))}
    </div>
  );
}

function Radios({ name, options, value, onChange }: { name: string; options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      {options.map(([v, l]) => (
        <label key={v || "any"} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} className="h-4 w-4 accent-ember" />
          {l}
        </label>
      ))}
    </div>
  );
}

function RangeInputs({
  min,
  max,
  onApply,
  prefix,
  suffix,
}: {
  min: string;
  max: string;
  onApply: (min: string, max: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  const [lo, setLo] = useState(min);
  const [hi, setHi] = useState(max);
  const apply = () => {
    if (lo !== min || hi !== max) onApply(lo.trim(), hi.trim());
  };
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <input className="input" inputMode="decimal" placeholder={`${prefix ?? ""}Min${suffix ? ` ${suffix}` : ""}`} value={lo} onChange={(e) => setLo(e.target.value.replace(/[^\d.]/g, ""))} onBlur={apply} aria-label="Minimum" />
      <span className="text-muted">–</span>
      <input className="input" inputMode="decimal" placeholder={`${prefix ?? ""}Max${suffix ? ` ${suffix}` : ""}`} value={hi} onChange={(e) => setHi(e.target.value.replace(/[^\d.]/g, ""))} onBlur={apply} aria-label="Maximum" />
    </form>
  );
}
