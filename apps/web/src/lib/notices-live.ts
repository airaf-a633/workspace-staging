import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppNotice } from "@/components/notifications/notifications";
import { toNotices, type NoticeRow } from "@/lib/notices-map";

/**
 * The bell's items for the signed-in person (decided 2026-11-04). Row-level security returns only their own notices;
 * the database keeps 30 days, and the bell shows the newest 50.
 */
export async function loadNotices(supabase: SupabaseClient, workspaceId: string, base: string): Promise<AppNotice[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, subject, quote, percent, conversation_id, deal_id, task_id, channel_id, created_at, read_at, actor:members!actor_member_id(display_name)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(50);
  return toNotices((data ?? []) as unknown as NoticeRow[], base);
}
