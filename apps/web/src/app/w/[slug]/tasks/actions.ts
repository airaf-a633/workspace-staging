"use server";

import { loadWorkspace } from "@/lib/workspace";

/**
 * What the Tasks list can do on real data (decided 2026-11-03). Each action is one database function, which checks who may do
 * it. Times are worked out in the person's browser (it knows their time zone) and sent as exact moments.
 */

export type Result = { ok: true; id?: string } | { ok: false; error: string };

const KNOWN = ["not_allowed", "bad_text", "bad_repeat", "repeat_needs_date", "bad_owner", "bad_contact", "bad_deal", "bad_due", "bad_note"] as const;

function code(message: string): string {
  return KNOWN.find((k) => message.includes(k)) ?? "failed";
}

async function call<T>(slug: string, fn: (db: Awaited<ReturnType<typeof loadWorkspace>>["supabase"], workspaceId: string) => PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<Result> {
  const { supabase, workspace } = await loadWorkspace(slug);
  const { data, error } = await fn(supabase, workspace.id);
  if (error) return { ok: false, error: code(error.message) };
  return typeof data === "string" ? { ok: true, id: data } : { ok: true };
}

export async function createTask(
  slug: string,
  input: { text: string; ownerId: string | null; contactId: string | null; dealId?: string | null; due: number | null; hasTime: boolean; repeat: string | null },
): Promise<Result> {
  return call(slug, (db, ws) =>
    db.rpc("create_task", {
      p_workspace: ws, p_text: input.text, p_owner: input.ownerId, p_contact: input.contactId, p_deal: input.dealId ?? null,
      p_due: input.due === null ? null : new Date(input.due).toISOString(), p_has_time: input.hasTime, p_repeat: input.repeat,
    }),
  );
}

/** Finishing returns the next task's id when the task repeats. */
export async function completeTask(slug: string, id: string): Promise<Result> {
  return call(slug, (db) => db.rpc("complete_task", { p_task: id }));
}

export async function undoCompleteTask(slug: string, id: string): Promise<Result> {
  return call(slug, (db) => db.rpc("undo_complete_task", { p_task: id }));
}

export async function snoozeTask(slug: string, id: string, due: number, hasTime: boolean): Promise<Result> {
  return call(slug, (db) => db.rpc("snooze_task", { p_task: id, p_due: new Date(due).toISOString(), p_has_time: hasTime }));
}

export async function noteTask(slug: string, id: string, body: string): Promise<Result> {
  return call(slug, (db) => db.rpc("add_task_note", { p_task: id, p_body: body }));
}
