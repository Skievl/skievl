import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Messages" };

interface Convo {
  id: string;
  buyer_id: string;
  seller_id: string;
  last_message_at: string;
  listing: { id: string; title: string } | null;
  buyer: { display_name: string } | null;
  seller: { shop_name: string } | null;
  messages: { id: string; read_at: string | null; sender_id: string }[];
}

export default async function MessagesPage() {
  const { user } = await requireUser("/account/messages");
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, last_message_at, listing:listings(id, title), buyer:profiles!conversations_buyer_id_fkey(display_name), seller:seller_profiles(shop_name), messages(id, read_at, sender_id)")
    .order("last_message_at", { ascending: false })
    .limit(100);
  const convos = (data ?? []) as unknown as Convo[];

  return (
    <>
      <PageHeader title="Messages" subtitle="Conversations with buyers and sellers. Keep payments on SKIEVL." />
      {convos.length === 0 ? (
        <EmptyState title="No messages yet" body="Questions about a listing? Use “Message seller” on any item." />
      ) : (
        <ul className="card divide-y divide-line">
          {convos.map((c) => {
            const iAmBuyer = c.buyer_id === user.id;
            const other = iAmBuyer ? c.seller?.shop_name : c.buyer?.display_name;
            const unread = c.messages.filter((m) => !m.read_at && m.sender_id !== user.id).length;
            return (
              <li key={c.id}>
                <Link href={`/account/messages/${c.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-snow">
                  <div className="min-w-0">
                    <p className="font-semibold">{other ?? "Member"} <span className="text-xs font-normal text-muted">· {iAmBuyer ? "seller" : "buyer"}</span></p>
                    <p className="truncate text-sm text-muted">Re: {c.listing?.title ?? "listing"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    {unread > 0 && <span className="badge bg-ember text-white">{unread} new</span>}
                    {timeAgo(c.last_message_at)}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
