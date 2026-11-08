import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="mt-20 bg-ink text-white/80">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
            Buy. Sell. Trade. Ski Local. A community marketplace for pre-owned ski and snowboard gear in
            Ellicottville and the Southern Tier — with secure checkout and local pickup or drop-off.
          </p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-white uppercase">Marketplace</h2>
          <ul className="space-y-2 text-sm">
            <li><Link href="/search" className="hover:text-white">Browse gear</Link></li>
            <li><Link href="/sell" className="hover:text-white">Sell your gear</Link></li>
            <li><Link href="/how-it-works" className="hover:text-white">How it works</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold tracking-wide text-white uppercase">Support</h2>
          <ul className="space-y-2 text-sm">
            <li><Link href="/how-it-works#safety" className="hover:text-white">Buying &amp; meeting safely</Link></li>
            <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
            <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
            <li><a href="mailto:support@skievl.com" className="hover:text-white">support@skievl.com</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-5 text-xs text-white/50">
          © {new Date().getFullYear()} Ellicottville Ski Exchange. Payments processed securely by Stripe. Not affiliated with Holiday Valley Resort.
        </p>
      </div>
    </footer>
  );
}
