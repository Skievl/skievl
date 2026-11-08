import Link from "next/link";
import { requireUser } from "@/lib/auth";

const NAV = [
  { href: "/account", label: "Orders" },
  { href: "/account/favorites", label: "Saved" },
  { href: "/account/messages", label: "Messages" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/settings", label: "Settings" },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("/account");
  return (
    <div className="container-page py-8">
      <p className="text-sm text-muted">Signed in as <span className="font-semibold text-ink">{profile.display_name}</span></p>
      <nav className="mt-3 mb-8 flex gap-1 overflow-x-auto border-b border-line" aria-label="Account">
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
