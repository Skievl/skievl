import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/catalog", label: "Catalog" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="container-page py-8">
      <div className="mb-2 flex items-center gap-2">
        <span className="badge bg-ember text-white">ADMIN</span>
        <span className="text-sm text-muted">All actions are recorded in the audit log.</span>
      </div>
      <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-line" aria-label="Admin">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="border-b-2 border-transparent px-3 py-2 text-sm font-semibold whitespace-nowrap text-ink-soft hover:border-ember hover:text-ink">
            {n.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
