import { createAdminClient } from "@/lib/supabase/admin";
import { KEY, json, toConfig } from "@/lib/widget/server";

export const dynamic = "force-dynamic";

/** The widget's look and the business's name, by public key. */
export async function GET(_request: Request, ctx: RouteContext<"/api/widget/[key]">) {
  const { key } = await ctx.params;
  if (!KEY.test(key)) return json({ error: "unknown_widget" }, 404);
  const { data, error } = await createAdminClient().rpc("webchat_config", { p_key: key });
  if (error) return json({ error: "unavailable" }, 500);
  const row = (data as Parameters<typeof toConfig>[0][] | null)?.[0];
  return row ? json(toConfig(row)) : json({ error: "unknown_widget" }, 404);
}
