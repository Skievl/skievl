import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import { listingImageUrl } from "@/lib/images";
import { OrderStatusBadge } from "@/components/StatusBadge";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Order } from "@/lib/types";

export const metadata = { title: "My orders" };

export default async function OrdersPage() {
  const { user } = await requireUser("/account");
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", user.id)
    .not("status", "in", "(pending_payment,expired)")
    .order("created_at", { ascending: false });
  const orders = (data ?? []) as Order[];

  return (
    <>
      <PageHeader title="My orders" subtitle="Everything you've bought on the Exchange." />
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" body="When you buy gear it will show up here." action={{ href: "/search", label: "Browse gear" }} />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const img = listingImageUrl(o.listing_snapshot.cover_image);
            return (
              <li key={o.id}>
                <Link href={`/account/orders/${o.id}`} className="card flex items-center gap-4 p-4 hover:border-sky">
                  <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-ice">
                    {img && <Image src={img} alt="" fill sizes="80px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{o.listing_snapshot.title}</p>
                    <p className="text-xs text-muted">{o.order_number} · {formatDate(o.paid_at ?? o.created_at)}</p>
                    <div className="mt-1"><OrderStatusBadge status={o.status} /></div>
                  </div>
                  <span className="font-bold">{formatMoney(o.total_cents)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
