"use server";

import { loadWorkspace } from "@/lib/workspace";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Marks the bell's notices read: the ones given, or all of them (null). The database only touches the caller's own. */
export async function markNoticesRead(slug: string, ids: string[] | null): Promise<void> {
  const { supabase, workspace } = await loadWorkspace(slug);
  const clean = ids === null ? null : ids.filter((i) => typeof i === "string" && UUID.test(i)).slice(0, 200);
  if (clean !== null && clean.length === 0) return;
  await supabase.rpc("mark_notifications_read", { p_workspace: workspace.id, p_ids: clean });
}
