import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What the real setup checklist can know (2026-11-04): whether any channel is connected, whether the website chat is, and
 * whether a reply-target rule is on. Importing contacts and trying AI are not tracked, so they stay unticked.
 */
export async function loadSetupFacts(supabase: SupabaseClient, workspaceId: string): Promise<{ connected: boolean; done: string[] }> {
  const [{ data: channels }, { count: rules }] = await Promise.all([
    supabase.from("channels").select("type").eq("workspace_id", workspaceId),
    supabase.from("sla_policies").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("active", true),
  ]);
  const types = (channels ?? []).map((c) => c.type as string);
  return { connected: types.length > 0, done: [...(types.includes("webchat") ? ["widget"] : []), ...((rules ?? 0) > 0 ? ["targets"] : [])] };
}
