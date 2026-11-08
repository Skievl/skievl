import Link from "next/link";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { SearchBar } from "@/components/SearchBar";
import { MobileMenu } from "@/components/MobileMenu";

export async function Header() {
  const session = await getSession();
  let unread = 0;
  if (session) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    unread = count ?? 0;
  }

  const links = session
    ? [
        { href: "/account/favorites", label: "Saved" },
        { href: "/account/messages", label: "Messages" },
        { href: "/account", label: "My orders" },
        { href: "/sell", label: session.seller ? "Seller dashboard" : "Start selling" },
        ...(session.isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
      ]
    : [{ href: "/how-it-works", label: "How it works" }];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-4">
        <Logo />
        <div className="hidden flex-1 md:block">
          <Suspense fallback={<div className="h-10" />}>
            <SearchBar compact />
          </Suspense>
        </div>
        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Main">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="btn-ghost">
              {l.label}
            </Link>
          ))}
          {session ? (
            <Link href="/account/notifications" className="btn-ghost relative" aria-label={`Notifications (${unread} unread)`}>
              <BellIcon />
              {unread > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          ) : null}
          {session ? (
            <form action="/auth/signout" method="post">
              <button className="btn-ghost text-muted">Sign out</button>
            </form>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link href="/sell" className="btn-primary">
                Sell your gear
              </Link>
            </>
          )}
        </nav>
        <div className="ml-auto lg:hidden">
          <MobileMenu
            links={[
              ...links,
              ...(session
                ? [{ href: "/account/notifications", label: `Notifications${unread ? ` (${unread})` : ""}` }, { href: "/auth/signout", label: "Sign out" }]
                : [{ href: "/login", label: "Sign in" }, { href: "/signup", label: "Create account" }, { href: "/sell", label: "Sell your gear" }]),
            ]}
          />
        </div>
      </div>
      <div className="container-page pb-3 md:hidden">
        <Suspense fallback={<div className="h-10" />}>
            <SearchBar compact />
          </Suspense>
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
