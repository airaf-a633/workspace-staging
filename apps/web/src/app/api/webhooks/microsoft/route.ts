import { createAdminClient } from "@/lib/supabase/admin";

// Microsoft Graph push notifications for connected Outlook mailboxes (decided 2026-10-20). Microsoft first checks
// the URL by sending a validationToken we must echo back. After that, each notification names a subscription and
// carries our per-mailbox secret (clientState); a match queues a mail check for that mailbox, and the worker reads
// the mail itself. Nothing in the notification is trusted beyond "go and look".
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const validation = new URL(request.url).searchParams.get("validationToken");
  if (validation) return new Response(validation, { status: 200, headers: { "Content-Type": "text/plain" } });

  const body = (await request.json().catch(() => null)) as { value?: { subscriptionId?: string; clientState?: string }[] } | null;
  const items = Array.isArray(body?.value) ? body!.value.slice(0, 100) : [];
  const db = createAdminClient();
  const seen = new Set<string>();
  for (const n of items) {
    if (!n.subscriptionId || !n.clientState) continue;
    const { data: channel } = await db.rpc("mail_subscription_channel", { p_subscription: n.subscriptionId, p_client_state: n.clientState });
    if (!channel || seen.has(channel)) continue;
    seen.add(channel);
    await db.rpc("enqueue_job", { p_queue: "mail_sync", p_payload: { channel_id: channel }, p_priority: 5 });
  }
  // Always 202: Microsoft retries non-2xx, and a mismatched secret should look no different to a prober.
  return new Response(null, { status: 202 });
}
