"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function MobileMenu({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <button className="btn-ghost" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen((o) => !o)}>
        <span className="sr-only">Menu</span>
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
        </svg>
      </button>
      {open && (
        <nav id="mobile-menu" className="absolute inset-x-0 top-full border-b border-line bg-white shadow-lg" aria-label="Mobile">
          <ul className="container-page divide-y divide-line py-2">
            {links.map((l) => (
              <li key={l.href}>
                {l.href === "/auth/signout" ? (
                  <form action="/auth/signout" method="post">
                    <button className="block w-full py-3 text-left text-base font-medium">{l.label}</button>
                  </form>
                ) : (
                  <Link href={l.href} className="block py-3 text-base font-medium">
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
