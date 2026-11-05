"use server";

import { loadWorkspace } from "@/lib/workspace";

/**
 * What the Deals board can do on real data (decided 2026-11-03). Each action is one database function, which checks who may do it;
 * a refusal comes back as a short code the board words in plain language (errors.<code>), never as the database's own text.
 */

export type Result = { ok: true; id?: string } | { ok: false; error: string };

const KNOWN = [
  "not_allowed", "closed", "bad_title", "bad_value", "bad_owner", "bad_team", "bad_contact", "bad_stage", "bad_reason", "bad_percent",
  "already_pending", "own_request", "not_pending", "bad_note",
] as const;

function code(message: string): string {
  return KNOWN.find((k) => message.includes(k)) ?? "failed";
}

async function call<T>(slug: string, fn: (db: Awaited<ReturnType<typeof loadWorkspace>>["supabase"], workspaceId: string) => PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<Result> {
  const { supabase, workspace } = await loadWorkspace(slug);
  const { data, error } = await fn(supabase, workspace.id);
  if (error) return { ok: false, error: code(error.message) };
  return typeof data === "string" ? { ok: true, id: data } : { ok: true };
}

export async function createDeal(slug: string, input: { title: string; contactId: string | null; valueMinor: number }): Promise<Result> {
  return call(slug, (db, ws) => db.rpc("create_deal", { p_workspace: ws, p_title: input.title, p_contact: input.contactId, p_value_minor: input.valueMinor }));
}

export async function moveDeal(slug: string, id: string, stage: string): Promise<Result> {
  return call(slug, (db) => db.rpc("update_deal", { p_deal: id, p_patch: { stage } }));
}

export async function winDeal(slug: string, id: string, finalMinor: number): Promise<Result> {
  return call(slug, (db) => db.rpc("close_deal_won", { p_deal: id, p_final_minor: finalMinor }));
}

export async function loseDeal(slug: string, id: string, reason: string): Promise<Result> {
  return call(slug, (db) => db.rpc("close_deal_lost", { p_deal: id, p_reason: reason }));
}

export async function reopenDeal(slug: string, id: string): Promise<Result> {
  return call(slug, (db) => db.rpc("reopen_deal", { p_deal: id }));
}

export async function noteDeal(slug: string, id: string, body: string): Promise<Result> {
  return call(slug, (db) => db.rpc("add_deal_note", { p_deal: id, p_body: body }));
}

export async function askDiscount(slug: string, id: string, percent: number, note: string): Promise<Result> {
  return call(slug, (db) => db.rpc("request_discount", { p_deal: id, p_percent: percent, p_note: note }));
}

export async function decideDiscount(slug: string, approvalId: string, approve: boolean, note: string): Promise<Result> {
  return call(slug, (db) => db.rpc("decide_discount", { p_approval: approvalId, p_approve: approve, p_note: note }));
}
