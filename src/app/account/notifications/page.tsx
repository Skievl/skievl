import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const { user } = await requireUser("/account/notifications");
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  // Opening the page marks everything read
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);

  return (
    <>
      <PageHeader title="Notifications" />
      {(data ?? []).length === 0 ? (
        <EmptyState title="You're all caught up" />
      ) : (
        <ul className="card divide-y divide-line">
          {(data ?? []).map((n) => (
            <li key={n.id} className={`p-4 ${n.read_at ? "" : "bg-ice/60"}`}>
              {n.link ? (
                <Link href={n.link} className="block">
                  <p className="font-semibold">{n.title}</p>
                  {n.body && <p className="text-sm text-ink-soft">{n.body}</p>}
                </Link>
              ) : (
                <>
                  <p className="font-semibold">{n.title}</p>
                  {n.body && <p className="text-sm text-ink-soft">{n.body}</p>}
                </>
              )}
              <p className="mt-1 text-xs text-muted">{timeAgo(n.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
