import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { AutoRefresh } from "./AutoRefresh";

export const metadata = { title: "Thanks for your order" };

export default async function CheckoutSuccess({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: orderId } = await searchParams;
  const { user } = await requireUser("/account");
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, status, fulfillment_method, total_cents, listing_snapshot")
    .eq("id", orderId ?? "")
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (!order) {
    return (
      <div className="container-page py-16">
        <Notice tone="info">We couldn&apos;t find that order. <Link href="/account" className="font-semibold underline">See your orders</Link>.</Notice>
      </div>
    );
  }
  const confirmed = order.status !== "pending_payment" && order.status !== "expired";

  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pine-light text-2xl text-pine" aria-hidden>✓</div>
        <h1 className="text-2xl font-extrabold">{confirmed ? "You got it!" : "Payment received — confirming…"}</h1>
        <p className="mt-2 text-ink-soft">
          {(order.listing_snapshot as { title: string }).title} · {formatMoney(order.total_cents)}
        </p>
        <p className="mt-1 text-sm text-muted">Order {order.order_number}</p>
        {confirmed ? (
          <p className="mt-5 text-sm text-ink-soft">
            {order.fulfillment_method === "pickup"
              ? "The pickup address is on your order page. Message the seller to pick a time."
              : "The seller will reach out to schedule your drop-off."}{" "}
            A receipt is on its way to your inbox.
          </p>
        ) : (
          <>
            <p className="mt-5 text-sm text-muted">This usually takes a few seconds.</p>
            <AutoRefresh />
          </>
        )}
        <Link href={`/account/orders/${order.id}`} className="btn-primary mt-6">View order</Link>
      </div>
    </div>
  );
}
