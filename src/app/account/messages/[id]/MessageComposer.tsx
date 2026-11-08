"use client";
import { useActionState, useEffect, useRef } from "react";
import { sendMessage } from "@/app/actions/messages";
import { FormMessage, SubmitButton, initialState } from "@/components/forms";

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const [state, action] = useActionState(sendMessage, initialState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="conversation_id" value={conversationId} />
      <textarea name="body" className="input" rows={3} maxLength={2000} required placeholder="Write a message…" aria-label="Message" />
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Sending…">Send</SubmitButton>
      </div>
    </form>
  );
}
