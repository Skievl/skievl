import Link from "next/link";

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <svg viewBox="0 0 120 50" className="mb-4 h-12 w-28 text-line" aria-hidden>
        <path d="M0 50 30 12l16 20 12-14 22 26 12-10 28 16z" fill="currentColor" />
      </svg>
      <h2 className="text-lg font-bold">{title}</h2>
      {body && <p className="mt-1 max-w-md text-sm text-muted">{body}</p>}
      {action && (
        <Link href={action.href} className="btn-primary mt-5">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "success"; children: React.ReactNode }) {
  const tones = {
    info: "border-sky/30 bg-ice text-ink",
    warn: "border-gold/40 bg-gold/10 text-ink",
    error: "border-danger/30 bg-danger-light text-danger",
    success: "border-pine/30 bg-pine-light text-pine",
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (p: number) => string }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 && (
        <Link className="btn-secondary" href={hrefFor(page - 1)} rel="prev">
          ← Previous
        </Link>
      )}
      <span className="px-3 text-sm text-muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <Link className="btn-secondary" href={hrefFor(page + 1)} rel="next">
          Next →
        </Link>
      )}
    </nav>
  );
}
