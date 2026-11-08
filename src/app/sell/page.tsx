import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/catalog";
import { formatDate, formatMoney, formatPercentBps } from "@/lib/format";
import { listingImageUrl } from "@/lib/images";
import { ListingStatusBadge, OrderStatusBadge } from "@/components/StatusBadge";
import { StarRating } from "@/components/StarRating";
import { EmptyState, Notice, PageHeader, Stat } from "@/components/ui";
import type { Listing, ListingImage, Order } from "@/lib/types";

export const metadata = { title: "Seller dashboard" };

export default async function SellDashboard() {
  const session = await requireUser("/sell");
  const settings = await getSettings();
  if (!session.seller) return <SellerLanding commission={formatPercentBps(settings.commission_bps)} />;
  const seller = session.seller;

  const supabase = await createClient();
  const [listingsRes, ordersRes, payoutsRes, privateRes] = await Promise.all([
    supabase
      .from("listings")
      .select("*, listing_images(storage_path, sort_order)")
      .eq("seller_id", seller.user_id)
      .neq("status", "removed")
      .order("updated_at", { ascending: false }),
    supabase
      .from("orders")
      .select("*")
      .eq("seller_id", seller.user_id)
      .not("status", "in", "(pending_payment,expired)")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("payouts").select("*").eq("seller_id", seller.user_id).order("created_at", { ascending: false }).limit(10),
    supabase.from("seller_private").select("user_id").maybeSingle(),
  ]);
  const listings = (listingsRes.data ?? []) as (Listing & { listing_images: Pick<ListingImage, "storage_path" | "sort_order">[] })[];
  const orders = (ordersRes.data ?? []) as Order[];
  const payouts = payoutsRes.data ?? [];

  const needsAction = orders.filter((o) => ["awaiting_fulfillment", "ready_for_pickup", "pickup_scheduled", "delivery_scheduled"].includes(o.status));
  const earned = orders
    .filter((o) => !["cancelled", "refunded"].includes(o.status))
    .reduce((s, o) => s + o.seller_proceeds_cents - Math.max(0, o.refunded_cents), 0);
  const active = listings.filter((l) => l.status === "active").length;

  return (
    <>
      <PageHeader title={seller.shop_name} subtitle="Your seller dashboard">
        <Link href="/sell/listings/new" className="btn-primary">+ New listing</Link>
      </PageHeader>

      <div className="mb-6 space-y-3">
        {!seller.charges_enabled && (
          <Notice tone="warn">
            <strong>Finish payout setup</strong> to publish listings and get paid.{" "}
            <Link href="/sell/setup#payouts" className="font-semibold underline">Set up payouts with Stripe →</Link>
          </Notice>
        )}
        {!privateRes.data && (
          <Notice tone="info">
            Add your private pickup address so buyers can collect gear. <Link href="/sell/setup#pickup" className="font-semibold underline">Add address →</Link>
          </Notice>
        )}
        {needsAction.length > 0 && (
          <Notice tone="success">
            You have <strong>{needsAction.length}</strong> order{needsAction.length > 1 ? "s" : ""} to fulfill.{" "}
            <Link href="/sell/orders" className="font-semibold underline">View orders →</Link>
          </Notice>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Live listings" value={active} />
        <Stat label="Sales" value={seller.sales_count} />
        <Stat label="Earned (after fees)" value={formatMoney(earned)} />
        <Stat
          label="Seller rating"
          value={seller.rating_count ? <StarRating value={Number(seller.rating_avg)} count={seller.rating_count} size="lg" /> : "—"}
        />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold">Your listings</h2>
        {listings.length === 0 ? (
          <EmptyState title="No listings yet" body="It takes about two minutes to list your first item." action={{ href: "/sell/listings/new", label: "Create a listing" }} />
        ) : (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Item</th><th>Status</th><th>Price</th><th>Updated</th><th /></tr>
              </thead>
              <tbody>
                {listings.map((l) => {
                  const cover = [...l.listing_images].sort((a, b) => a.sort_order - b.sort_order)[0];
                  const img = listingImageUrl(cover?.storage_path);
                  return (
                    <tr key={l.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-12 shrink-0 overflow-hidden rounded bg-ice">
                            {img && <Image src={img} alt="" fill sizes="48px" className="object-cover" />}
                          </div>
                          <span className="font-medium">{l.title}</span>
                        </div>
                        {l.rejection_reason && l.status === "draft" && <p className="mt-1 text-xs text-danger">Not approved: {l.rejection_reason}</p>}
                      </td>
                      <td><ListingStatusBadge status={l.status} /></td>
                      <td>{formatMoney(l.price_cents, { whole: true })}</td>
                      <td className="text-muted">{formatDate(l.updated_at)}</td>
                      <td className="text-right">
                        {["reserved", "sold"].includes(l.status) ? (
                          <Link href={`/listings/${l.id}`} className="text-sm font-semibold text-sky">View</Link>
                        ) : (
                          <Link href={`/sell/listings/${l.id}`} className="text-sm font-semibold text-sky">Edit</Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-bold">Recent orders</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-muted">No sales yet.</p>
          ) : (
            <ul className="card divide-y divide-line">
              {orders.slice(0, 6).map((o) => (
                <li key={o.id}>
                  <Link href={`/sell/orders/${o.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-snow">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{o.listing_snapshot.title}</span>
                      <span className="text-xs text-muted">{o.order_number} · {formatDate(o.paid_at)}</span>
                    </span>
                    <OrderStatusBadge status={o.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Payouts</h2>
            {seller.stripe_account_id && (
              <form action="/api/stripe/connect?action=dashboard" method="post">
                <button className="text-sm font-semibold text-sky">Open Stripe payouts dashboard →</button>
              </form>
            )}
          </div>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted">Payouts to your bank appear here. Stripe typically deposits funds within a few business days of each sale.</p>
          ) : (
            <ul className="card divide-y divide-line">
              {payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between p-3 text-sm">
                  <span>{formatDate(p.arrival_date ?? p.created_at)}</span>
                  <span className="text-muted capitalize">{p.status.replace("_", " ")}</span>
                  <span className="font-semibold">{formatMoney(p.amount_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

function SellerLanding({ commission }: { commission: string }) {
  return (
    <div className="mx-auto max-w-3xl py-6 text-center">
      <h1 className="text-4xl font-extrabold">Sell your gear to skiers next door</h1>
      <p className="mt-4 text-lg text-ink-soft">
        List for free. Buyers pay securely online, and your money goes straight to your bank. You only pay a {commission} fee when an item sells.
      </p>
      <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
        {[
          ["1. Create your shop", "Pick a shop name and add your private pickup address."],
          ["2. Connect payouts", "Verify your identity and bank with Stripe — takes about 5 minutes."],
          ["3. List & sell", "Add photos, size and condition. We'll email you when it sells."],
        ].map(([t, d]) => (
          <div key={t} className="card p-5">
            <p className="font-bold">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </div>
        ))}
      </div>
      <Link href="/sell/setup" className="btn-primary mt-8 px-8 py-3 text-base">Get started</Link>
    </div>
  );
}
