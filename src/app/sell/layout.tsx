import Link from "next/link";
import { getSession } from "@/lib/auth";

const NAV = [
  { href: "/sell", label: "Dashboard" },
  { href: "/sell/listings/new", label: "New listing" },
  { href: "/sell/orders", label: "Orders" },
  { href: "/sell/reviews", label: "Reviews" },
  { href: "/sell/setup", label: "Shop & payouts" },
];

export default async function SellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="container-page py-8">
      {session?.seller && (
        <nav className="mb-8 flex gap-1 overflow-x-auto border-b border-line" aria-label="Seller">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="border-b-2 border-transparent px-3 py-2 text-sm font-semibold whitespace-nowrap text-ink-soft hover:border-ember hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
      )}
      {children}
    </div>
  );
}
