import type { AttributeDefinition, Attributes } from "@/lib/types";

/**
 * Boot sizes are stored canonically as Mondopoint (cm), e.g. 26.5.
 * US conversions use the common industry approximation:
 *   US men's   = Mondo - 18
 *   US women's = Mondo - 17
 * Manufacturer charts vary slightly; listings always show the Mondo size.
 */
export type BootSystem = "mondo" | "us_mens" | "us_womens";

export const BOOT_SYSTEM_LABELS: Record<BootSystem, string> = {
  mondo: "Mondo (cm)",
  us_mens: "US men's",
  us_womens: "US women's",
};

export function toMondo(value: number, system: BootSystem): number {
  const m = system === "mondo" ? value : system === "us_mens" ? value + 18 : value + 17;
  return Math.round(m * 2) / 2;
}

export function fromMondo(mondo: number, system: BootSystem): number {
  const v = system === "mondo" ? mondo : system === "us_mens" ? mondo - 18 : mondo - 17;
  return Math.round(v * 2) / 2;
}

export function describeBootSize(mondo: number) {
  const mens = fromMondo(mondo, "us_mens");
  const womens = fromMondo(mondo, "us_womens");
  const parts = [`Mondo ${mondo}`];
  if (mens > 0) parts.push(`≈ US M ${mens}`);
  if (womens > 0) parts.push(`W ${womens}`);
  return parts.join(" · ");
}

/** Human-readable value for an attribute. */
export function formatAttribute(def: AttributeDefinition, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  switch (def.data_type) {
    case "boolean":
      return value ? "Yes" : "No";
    case "boot_size":
      return describeBootSize(Number(value));
    case "number":
      return `${value}${def.unit ? ` ${def.unit}` : ""}`;
    case "enum":
      return def.options?.find((o) => o.value === value)?.label ?? String(value);
  }
}

/** Short size label for cards: "176 cm", "Mondo 26.5", "M". */
export function sizeLabel(defs: AttributeDefinition[], attrs: Attributes): string | null {
  const def = defs.filter((d) => d.is_size).sort((a, b) => a.sort_order - b.sort_order)[0];
  if (!def) return null;
  const v = attrs[def.key];
  if (v === undefined) return null;
  if (def.data_type === "boot_size") return `Mondo ${v}`;
  return formatAttribute(def, v);
}

/** Size presets for filter UIs. */
export const LENGTH_PRESETS: Record<string, { label: string; min?: number; max?: number }[]> = {
  skis: [
    { label: "Under 130 cm", max: 129 },
    { label: "130–149 cm", min: 130, max: 149 },
    { label: "150–164 cm", min: 150, max: 164 },
    { label: "165–179 cm", min: 165, max: 179 },
    { label: "180+ cm", min: 180 },
  ],
  snowboards: [
    { label: "Under 130 cm", max: 129 },
    { label: "130–144 cm", min: 130, max: 144 },
    { label: "145–154 cm", min: 145, max: 154 },
    { label: "155–159 cm", min: 155, max: 159 },
    { label: "160+ cm", min: 160 },
  ],
};

export const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: "Under $50", max: 50 },
  { label: "$50–$150", min: 50, max: 150 },
  { label: "$150–$300", min: 150, max: 300 },
  { label: "$300–$500", min: 300, max: 500 },
  { label: "$500+", min: 500 },
];
