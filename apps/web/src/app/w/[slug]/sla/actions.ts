"use server";

import type { WeekHours } from "@/components/sla/sla";
import { toMinutes, weekToJson } from "@/lib/sla-map";
import { loadWorkspace } from "@/lib/workspace";

/**
 * What Settings › Reply targets can do on real data (decided 2026-11-03). Each action is one database function, which checks who
 * may do it (teams.manage: everything, or only the person's own teams); a refusal comes back as a short code the screen words in
 * plain language (slaSettings.errors.<code>), never as the database's own text.
 */

export type Result = { ok: true } | { ok: false; error: "notAllowed" | "overlap" | "badDates" | "badHours" | "failed" };

function code(message: string): Extract<Result, { ok: false }>["error"] {
  if (message.includes("not_allowed")) return "notAllowed";
  if (message.includes("overlap")) return "overlap";
  if (message.includes("bad_dates")) return "badDates";
  if (message.includes("bad_hours")) return "badHours";
  return "failed";
}

async function call(slug: string, fn: (db: Awaited<ReturnType<typeof loadWorkspace>>["supabase"], workspaceId: string) => PromiseLike<{ error: { message: string } | null }>): Promise<Result> {
  const { supabase, workspace } = await loadWorkspace(slug);
  const { error } = await fn(supabase, workspace.id);
  return error ? { ok: false, error: code(error.message) } : { ok: true };
}

export async function saveHours(slug: string, teamId: string, week: WeekHours): Promise<Result> {
  return call(slug, (db) => db.rpc("save_team_hours", { p_team: teamId, p_hours: weekToJson(week) }));
}

export async function addClosure(slug: string, teamId: string, input: { from: string; to: string; hours: [string, string] | null; label: string }): Promise<Result> {
  return call(slug, (db) =>
    db.rpc("add_team_closure", {
      p_team: teamId,
      p_from: input.from,
      p_to: input.to,
      p_opens: input.hours ? toMinutes(input.hours[0]) : null,
      p_closes: input.hours ? toMinutes(input.hours[1]) : null,
      p_label: input.label || null,
    }),
  );
}

export async function removeClosure(slug: string, id: string): Promise<Result> {
  return call(slug, (db) => db.rpc("remove_team_closure", { p_id: id }));
}

export interface PolicyInput {
  id: string | null;
  name: string;
  active: boolean;
  teams: string[];
  channels: string[];
  vip: boolean;
  firstReply: number | null;
  nextReply: number | null;
  resolution: number | null;
}

export async function savePolicy(slug: string, p: PolicyInput): Promise<Result> {
  return call(slug, (db, ws) =>
    db.rpc("save_sla_policy", {
      p_workspace: ws,
      p_id: p.id,
      p_name: p.name,
      p_active: p.active,
      p_teams: p.teams,
      p_channels: p.channels,
      p_vip: p.vip,
      p_first: p.firstReply,
      p_next: p.nextReply,
      p_resolution: p.resolution,
    }),
  );
}

export async function deletePolicy(slug: string, id: string): Promise<Result> {
  return call(slug, (db) => db.rpc("delete_sla_policy", { p_id: id }));
}

export async function saveAlerts(slug: string, warnAt: number, alertManager: boolean): Promise<Result> {
  return call(slug, (db, ws) => db.rpc("set_sla_alerts", { p_workspace: ws, p_warn: warnAt, p_managers: alertManager }));
}
