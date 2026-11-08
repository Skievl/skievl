import Link from "next/link";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Ellicottville Ski Exchange home">
      <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="14" fill={light ? "#f5f8fa" : "#13293d"} />
        <path d="M8 46 24 22l8 11 6-8 18 21z" fill={light ? "#13293d" : "#f5f8fa"} />
        <circle cx="47" cy="17" r="5" fill="#d9542b" />
      </svg>
      <span className="leading-none">
        <span className={`block font-[family-name:var(--font-display)] text-[15px] font-extrabold tracking-tight ${light ? "text-white" : "text-ink"}`}>
          Ellicottville Ski Exchange
        </span>
        <span className={`block text-[11px] font-semibold tracking-[0.18em] ${light ? "text-white/60" : "text-muted"}`}>
          SKIEVL.COM
        </span>
      </span>
    </Link>
  );
}
