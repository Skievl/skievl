import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getSettings } from "@/lib/catalog";
import { toCardData } from "@/lib/cards";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";
import { Mountains } from "@/components/Mountains";
import { CategoryIcon } from "@/components/CategoryIcon";
import { formatPercentBps } from "@/lib/format";
import type { SearchResult } from "@/lib/types";

export default async function HomePage() {
  const supabase = await createClient();
  const [categories, settings, recent] = await Promise.all([
    getCategories(),
    getSettings(),
    supabase.rpc("search_listings", { p_sort: "newest", p_limit: 8 }),
  ]);
  const listings = ((recent.data ?? []) as SearchResult[]).map((r) => toCardData(r, categories));

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-ink via-[#1d3f5c] to-sky text-white">
        <div className="container-page relative z-10 pt-16 pb-40 sm:pt-24 sm:pb-52">
          <p className="mb-3 text-xs font-bold tracking-[0.25em] text-white/70 uppercase">Ellicottville, New York</p>
          <h1 className="max-w-3xl text-4xl leading-[1.05] font-extrabold sm:text-6xl">
            Buy. Sell. Trade. <span className="text-gold">Ski Local.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/80 sm:text-lg">
            The local marketplace for pre-owned ski and snowboard gear. Pay securely online, then pick up in town or have
            the seller drop it off.
          </p>
          <div className="mt-8 max-w-2xl">
            <Suspense>
              <SearchBar />
            </Suspense>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {["skis", "snowboards", "ski-boots", "helmets"].map((slug) => {
              const c = categories.find((x) => x.slug === slug);
              return c ? (
                <Link key={slug} href={`/search?category=${slug}`} className="rounded-full bg-white/10 px-3 py-1 text-white/90 ring-1 ring-white/20 hover:bg-white/20">
                  {c.name}
                </Link>
              ) : null;
            })}
            <Link href="/search?age=kids,youth,toddler" className="rounded-full bg-white/10 px-3 py-1 text-white/90 ring-1 ring-white/20 hover:bg-white/20">
              Kids&apos; gear
            </Link>
          </div>
        </div>
        <Mountains className="absolute inset-x-0 bottom-0 h-40 w-full sm:h-56" />
      </section>

      {/* Categories */}
      <section className="container-page -mt-6 relative z-10">
        <h2 className="sr-only">Browse by category</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/search?category=${c.slug}`}
              className="card flex flex-col items-center gap-2 px-2 py-4 text-center text-xs font-semibold text-ink-soft transition hover:border-sky hover:text-ink"
            >
              <CategoryIcon slug={c.slug} className="h-7 w-7 text-sky" />
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      {/* Recent listings */}
      <section className="container-page mt-16">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-extrabold">Fresh on the Exchange</h2>
            <p className="text-sm text-muted">Recently listed by your neighbors.</p>
          </div>
          <Link href="/search?sort=newest" className="text-sm font-semibold text-sky">
            See all →
          </Link>
        </div>
        {listings.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {listings.map((l, i) => (
              <ListingCard key={l.id} l={l} priority={i < 4} />
            ))}
          </div>
        ) : (
          <div className="card p-10 text-center">
            <p className="font-semibold">The racks are empty — for now.</p>
            <p className="mt-1 text-sm text-muted">Be one of the first sellers on the Exchange.</p>
            <Link href="/sell" className="btn-primary mt-4">List your gear</Link>
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="container-page mt-20" id="how">
        <h2 className="text-center text-2xl font-extrabold">How the Exchange works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="card p-6">
            <h3 className="text-lg font-bold">Buying</h3>
            <ol className="mt-4 space-y-4">
              {[
                ["Find it", "Filter by ski length, boot size, brand, condition and more."],
                ["Pay securely", "Check out with card, Apple Pay or Google Pay through Stripe. Your payment is protected."],
                ["Get it local", "Pick up for free in town, or choose seller drop-off for a small fee."],
                ["Review the seller", "After the handoff, leave a verified review to help the community."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ice text-sm font-bold text-sky">{i + 1}</span>
                  <span><span className="font-semibold">{t}.</span> <span className="text-ink-soft">{d}</span></span>
                </li>
              ))}
            </ol>
          </div>
          <div className="card p-6">
            <h3 className="text-lg font-bold">Selling</h3>
            <ol className="mt-4 space-y-4">
              {[
                ["List in minutes", "Snap photos, pick the category, add size and condition."],
                ["Get paid out", "Set up payouts with Stripe once. Proceeds go straight to your bank."],
                ["Stay private", "Your pickup address is only shared with a buyer after they’ve paid."],
                ["Hand it off", "Meet for pickup or drop it off — you set the drop-off fee and area."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pine-light text-sm font-bold text-pine">{i + 1}</span>
                  <span><span className="font-semibold">{t}.</span> <span className="text-ink-soft">{d}</span></span>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-xs text-muted">
              Marketplace fee: {formatPercentBps(settings.commission_bps)} of the item price. No listing fees.
            </p>
          </div>
        </div>
      </section>

      {/* Trust + Seller CTA */}
      <section className="container-page mt-20 grid gap-6 lg:grid-cols-3">
        {[
          ["Verified reviews", "Only buyers who completed a purchase can review a seller — every review is tied to a real transaction."],
          ["Secure payments", "Payments are processed by Stripe. Sellers are identity-verified before they can get paid."],
          ["Local by design", "No shipping, no strangers across the country. Gear changes hands right here in the valley."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-[var(--radius-card)] bg-ice p-6">
            <h3 className="font-bold">{t}</h3>
            <p className="mt-2 text-sm text-ink-soft">{d}</p>
          </div>
        ))}
      </section>

      <section className="container-page mt-20">
        <div className="relative overflow-hidden rounded-2xl bg-pine px-6 py-12 text-white sm:px-12">
          <div className="relative z-10 max-w-xl">
            <h2 className="text-3xl font-extrabold">Gear in the garage? Turn it into lift tickets.</h2>
            <p className="mt-3 text-white/80">
              List your skis, boards, boots and outerwear for free. Sell to skiers in {settings.market_name} and get paid
              directly to your bank.
            </p>
            <Link href="/sell" className="btn-primary mt-6">Start selling</Link>
          </div>
          <Mountains className="absolute right-0 bottom-0 h-32 w-2/3 opacity-30" />
        </div>
      </section>
    </>
  );
}
