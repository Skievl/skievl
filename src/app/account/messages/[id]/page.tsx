import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { ReportButton } from "@/components/ReportButton";
import { MessageComposer } from "./MessageComposer";

export const metadata = { title: "Conversation" };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser(`/account/messages/${id}`);
  const supabase = await createClient();
  const { data: convo } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, listing:listings(id, title, status), buyer:profiles!conversations_buyer_id_fkey(display_name), seller:seller_profiles(shop_name)")
    .eq("id", id)
    .maybeSingle();
  if (!convo) notFound();
  const c = convo as unknown as {
    id: string;
    buyer_id: string;
    seller_id: string;
    listing: { id: string; title: string; status: string } | null;
    buyer: { display_name: string } | null;
    seller: { shop_name: string } | null;
  };

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("conversation_id", id)
    .order("created_at")
    .limit(500);

  // Mark incoming as read
  await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("conversation_id", id).neq("sender_id", user.id).is("read_at", null);

  const iAmBuyer = c.buyer_id === user.id;
  const other = iAmBuyer ? c.seller?.shop_name : c.buyer?.display_name;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/account/messages" className="text-sm text-sky">← All messages</Link>
      <div className="mt-3 mb-4">
        <h1 className="text-xl font-extrabold">{other ?? "Member"}</h1>
        {c.listing && (
          <p className="text-sm text-muted">
            About <Link href={`/listings/${c.listing.id}`} className="font-medium text-sky">{c.listing.title}</Link>
          </p>
        )}
      </div>
      <div className="card flex flex-col gap-3 p-4">
        {(messages ?? []).length === 0 && <p className="py-6 text-center text-sm text-muted">Say hi and ask your question.</p>}
        {(messages ?? []).map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`max-w-[85%] ${mine ? "self-end text-right" : "self-start"}`}>
              <p className={`rounded-2xl px-4 py-2 text-left text-sm whitespace-pre-line ${mine ? "bg-ink text-white" : "bg-ice text-ink"}`}>{m.body}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {formatDate(m.created_at, true)}
                {!mine && <> · <ReportButton targetType="message" targetId={m.id} /></>}
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-4">
        <MessageComposer conversationId={id} />
      </div>
      <p className="mt-3 text-xs text-muted">
        For your safety, pay only through SKIEVL checkout. Never share bank details or pay by wire, gift card, or payment apps.
      </p>
    </div>
  );
}
