import { createAdminClient } from "@/lib/supabase/admin";
import { KEY, json, outgoing, statusFor, visitorFrom } from "@/lib/widget/server";

export const dynamic = "force-dynamic";

/** The visitor's thread. Fetching while the widget is open marks the team's replies as read. */
export async function GET(request: Request, ctx: RouteContext<"/api/widget/[key]/messages">) {
  const { key } = await ctx.params;
  const visitor = visitorFrom(request);
  if (!KEY.test(key) || !visitor) return json({ error: "bad_request" }, 400);
  const { data, error } = await createAdminClient().rpc("webchat_thread", { p_key: key, p_visitor: visitor });
  if (error) return json({ error: "unavailable" }, statusFor(error.message));
  return json({ messages: data ?? [] });
}

/** One visitor message. The client's id makes a retried send harmless. */
export async function POST(request: Request, ctx: RouteContext<"/api/widget/[key]/messages">) {
  const { key } = await ctx.params;
  const visitor = visitorFrom(request);
  if (!KEY.test(key) || !visitor) return json({ error: "bad_request" }, 400);
  const parsed = outgoing.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request" }, 400);
  const m = parsed.data;
  const { data, error } = await createAdminClient().rpc("webchat_send", {
    p_key: key,
    p_visitor: visitor,
    p_client_id: m.clientId,
    p_body: m.body,
    p_name: m.name ?? null,
    p_email: m.email ?? null,
  });
  if (error) {
    const status = statusFor(error.message);
    return json({ error: status === 429 ? "rate_limited" : status === 404 ? "unknown_widget" : "not_sent" }, status);
  }
  return json({ id: data }, 201);
}
