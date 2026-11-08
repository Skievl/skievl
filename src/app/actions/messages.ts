"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/lib/types";

export async function startConversation(listingId: string) {
  const id = z.string().uuid().parse(listingId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_conversation", { p_listing_id: id });
  if (error) redirect(`/listings/${id}?error=message`);
  redirect(`/account/messages/${data}`);
}

const sendSchema = z.object({
  conversation_id: z.string().uuid(),
  body: z.string().trim().min(1, "Write a message").max(2000),
});

// Discourage moving payment off-platform
const OFF_PLATFORM = /\b(venmo|zelle|cash ?app|paypal|wire transfer|western union|gift ?card)\b/i;

export async function sendMessage(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = sendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in again" };

  const { data: convo } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, listing:listings(title)")
    .eq("id", parsed.data.conversation_id)
    .single();
  if (!convo) return { ok: false, error: "Conversation not found" };

  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: convo.id, sender_id: user.id, body: parsed.data.body });
  if (error) return { ok: false, error: "Message not sent" };

  const recipient = convo.buyer_id === user.id ? convo.seller_id : convo.buyer_id;
  const listing = convo.listing as unknown as { title: string } | null;
  await notify({
    userId: recipient,
    type: "message",
    title: `New message about ${listing?.title ?? "a listing"}`,
    body: parsed.data.body.slice(0, 200),
    link: `/account/messages/${convo.id}`,
    email: { ctaLabel: "Reply" },
  });

  revalidatePath(`/account/messages/${convo.id}`);
  return {
    ok: true,
    message: OFF_PLATFORM.test(parsed.data.body)
      ? "Sent. Reminder: pay only through SKIEVL checkout — off-platform payments aren’t protected."
      : undefined,
  };
}
