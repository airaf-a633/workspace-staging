import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InboxData } from "@/components/inbox/types";
import type { ServerClock, SlaSettings, TeamSchedule } from "@/components/sla/sla";
import { clocksByConversation, closureFromRow, policyFromRow, weekFromRows, type ClockRow, type ClosureRow, type HoursRow, type PolicyRow } from "./sla-map";

/**
 * Reply targets on real data (decided 2026-11-03, migration 20261106000001_reply_targets): the rules, each team's opening
 * hours and closed days, and the clocks the database is running on open chats. Row-level security lets every member read the
 * rules and hours; the clocks come from one function that only returns chats the person may see.
 */

/** Rules, hours and closed days (closed days that are already over are left out of the list; they stay stored). */
export async function loadSlaSettings(supabase: SupabaseClient, workspaceId: string, tz: string, teamIds: string[]): Promise<SlaSettings> {
  const [{ data: hours }, { data: closures }, { data: policies }, { data: ws }] = await Promise.all([
    supabase.from("team_hours").select("team_id, weekday, opens, closes").eq("workspace_id", workspaceId),
    supabase.from("team_closures").select("id, team_id, from_date, to_date, opens, closes, label").eq("workspace_id", workspaceId).order("from_date"),
    supabase.from("sla_policies").select("id, name, active, team_ids, channel_types, vip, first_reply_min, next_reply_min, resolution_min").eq("workspace_id", workspaceId).order("created_at"),
    supabase.from("workspaces").select("sla_warn_at, sla_alert_managers").eq("id", workspaceId).single(),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const schedules: Record<string, TeamSchedule> = {};
  for (const id of teamIds) {
    schedules[id] = {
      week: weekFromRows(((hours ?? []) as (HoursRow & { team_id: string })[]).filter((h) => h.team_id === id)),
      closures: ((closures ?? []) as (ClosureRow & { team_id: string })[]).filter((c) => c.team_id === id && c.to_date >= today).map(closureFromRow),
    };
  }
  return {
    tz,
    schedules,
    policies: ((policies ?? []) as PolicyRow[]).map(policyFromRow),
    warnAt: Number(ws?.sla_warn_at ?? 0.8),
    alertManager: ws?.sla_alert_managers ?? true,
    live: true,
  };
}

/** The clocks on the open chats this person may see, grouped by chat. Empty when no rule applies yet. */
export async function loadSlaClocks(supabase: SupabaseClient, workspaceId: string): Promise<Map<string, ServerClock[]>> {
  const { data } = await supabase.rpc("sla_clocks", { p_workspace: workspaceId });
  return clocksByConversation((data ?? []) as ClockRow[]);
}

/**
 * Puts the database's clocks on real chats and switches the screens to reply targets. Without an active rule nothing changes:
 * the inbox keeps its flat 30-minute flag and Home shows no "late" numbers. Returns whether reply targets are on.
 */
export async function attachSlaClocks(supabase: SupabaseClient, workspaceId: string, tz: string, data: InboxData): Promise<boolean> {
  const [settings, clocks] = await Promise.all([loadSlaSettings(supabase, workspaceId, tz, []), loadSlaClocks(supabase, workspaceId)]);
  if (!settings.policies.some((p) => p.active)) return false;
  data.sla = settings;
  for (const c of data.conversations) c.slaClocks = clocks.get(c.id) ?? [];
  return true;
}
