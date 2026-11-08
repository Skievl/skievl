"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteListing, setListingStatus } from "@/app/actions/listings";
import type { ListingStatus } from "@/lib/types";

export function PublishPanel({
  listingId,
  status,
  ready,
  requiresApproval,
}: {
  listingId: string;
  status: ListingStatus;
  ready: boolean;
  requiresApproval: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (s: "active" | "unavailable" | "draft") =>
    start(async () => {
      const res = await setListingStatus(listingId, s);
      setMsg(res.ok ? { ok: true, text: res.message ?? "Updated" } : { ok: false, text: res.error });
      router.refresh();
    });

  return (
    <div className="space-y-2">
      {(status === "draft" || status === "unavailable") && (
        <button className="btn-primary w-full" disabled={pending || !ready} onClick={() => run("active")}>
          {requiresApproval ? "Submit for review" : status === "unavailable" ? "Relist" : "Publish"}
        </button>
      )}
      {status === "pending_review" && <p className="text-sm text-muted">Waiting for approval. You can keep editing meanwhile.</p>}
      {(status === "active" || status === "pending_review") && (
        <button className="btn-secondary w-full" disabled={pending} onClick={() => run("unavailable")}>
          Mark unavailable
        </button>
      )}
      {status === "draft" && (
        <button
          className="btn-ghost w-full text-danger"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this draft and its photos?")) start(() => deleteListing(listingId));
          }}
        >
          Delete draft
        </button>
      )}
      {msg && <p className={`text-sm ${msg.ok ? "text-pine" : "text-danger"}`} role="status">{msg.text}</p>}
    </div>
  );
}
