import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BoardDeal } from "@/components/deals/sample";
import type { BoardTask } from "@/components/tasks/sample";
import type { Customer } from "@/components/customers/types";
import { dueWord, toBoardDeal, toBoardTask, type DealRow, type TaskRow } from "@/lib/crm-map";

/**
 * Real deals and tasks (decided 2026-11-03). Row-level security decides which ones this person sees, and whether a deal
 * comes with its money, so nothing is filtered by hand here. Bounded: the newest 500 deals and 2,000 open tasks.
 */

const DEAL_COLUMNS =
  "id, title, status, contact_id, owner_member_id, team_id, expected_close, lost_reason, closed_at, created_at, pipeline_stages(key), deal_values(value_minor), " +
  "contacts(name, profile_name, email, phone), deal_notes(author_member_id, body, created_at), " +
  "deal_approvals(id, requested_by, percent, note, status, decided_by, created_at)";
const TASK_COLUMNS =
  "id, text, owner_member_id, team_id, contact_id, deal_id, due_at, has_time, repeat, done_at, contacts(name, profile_name, email, phone), task_notes(author_member_id, body, created_at)";
const MAX_DEALS = 500;
const MAX_TASKS = 2000;

/** Every deal this person may see, with the follow-up task and the customer's last message that the board's quiet line needs. */
export async function loadBoardDeals(supabase: SupabaseClient, workspaceId: string, tz: string, now: number): Promise<BoardDeal[]> {
  const { data } = await supabase.from("deals").select(DEAL_COLUMNS).eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(MAX_DEALS);
  const rows = (data ?? []) as unknown as DealRow[];
  if (rows.length === 0) return [];

  const [{ data: tasks }, { data: convs }] = await Promise.all([
    supabase.from("tasks").select("text, deal_id, due_at").eq("workspace_id", workspaceId).is("done_at", null).not("deal_id", "is", null).order("due_at", { ascending: true, nullsFirst: false }).limit(MAX_TASKS),
    supabase.from("conversations").select("contact_id, last_customer_message_at").eq("workspace_id", workspaceId).not("last_customer_message_at", "is", null).order("last_customer_message_at", { ascending: false }).limit(MAX_TASKS),
  ]);
  const followUps = new Map<string, { text: string; due: string }>();
  for (const t of (tasks ?? []) as { text: string; deal_id: string; due_at: string | null }[]) {
    if (!followUps.has(t.deal_id)) followUps.set(t.deal_id, { text: t.text, due: dueWord(t.due_at ? Date.parse(t.due_at) : null, now, tz) });
  }
  const lastWrote = new Map<string, number>();
  for (const c of (convs ?? []) as { contact_id: string; last_customer_message_at: string }[]) {
    if (!lastWrote.has(c.contact_id)) lastWrote.set(c.contact_id, Date.parse(c.last_customer_message_at));
  }
  return rows.map((r) => toBoardDeal(r, { followUp: followUps.get(r.id), lastCustomerAt: r.contact_id ? lastWrote.get(r.contact_id) : undefined }));
}

/** Every task this person may see, open and recently done. */
export async function loadBoardTasks(supabase: SupabaseClient, workspaceId: string): Promise<BoardTask[]> {
  const [open, done] = await Promise.all([
    supabase.from("tasks").select(TASK_COLUMNS).eq("workspace_id", workspaceId).is("done_at", null).limit(MAX_TASKS),
    supabase.from("tasks").select(TASK_COLUMNS).eq("workspace_id", workspaceId).not("done_at", "is", null).order("done_at", { ascending: false }).limit(50),
  ]);
  return [...((open.data ?? []) as unknown as TaskRow[]), ...((done.data ?? []) as unknown as TaskRow[])].map(toBoardTask);
}

/** The customers a deal or task can be about: name and id, for the pickers. */
export async function loadCustomerChoices(supabase: SupabaseClient, workspaceId: string): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase
    .from("contacts")
    .select("id, name, profile_name, email, phone")
    .eq("workspace_id", workspaceId)
    .is("erased_at", null)
    .order("updated_at", { ascending: false })
    .limit(1000);
  return ((data ?? []) as { id: string; name: string | null; profile_name: string | null; email: string | null; phone: string | null }[]).map((c) => ({
    id: c.id,
    name: c.name ?? c.profile_name ?? c.email ?? c.phone ?? "Website visitor",
  }));
}

/**
 * Puts each customer's own deals and open tasks on them, for the Contacts screens (the list's stage column, the customer page's
 * cards, a company's open deals). Pass one customer's id to fetch only theirs.
 */
export async function attachCrm(supabase: SupabaseClient, workspaceId: string, customers: Customer[], tz: string, now: number, onlyContact?: string): Promise<void> {
  let deals = supabase.from("deals").select(DEAL_COLUMNS).eq("workspace_id", workspaceId).not("contact_id", "is", null).order("created_at", { ascending: false }).limit(MAX_DEALS);
  let tasks = supabase.from("tasks").select(TASK_COLUMNS).eq("workspace_id", workspaceId).is("done_at", null).not("contact_id", "is", null).order("due_at", { ascending: true, nullsFirst: false }).limit(MAX_TASKS);
  if (onlyContact) {
    deals = deals.eq("contact_id", onlyContact);
    tasks = tasks.eq("contact_id", onlyContact);
  }
  const [{ data: dealRows }, { data: taskRows }] = await Promise.all([deals, tasks]);
  const byContact = <T extends { contact_id: string | null }>(rows: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of rows) if (r.contact_id) m.set(r.contact_id, [...(m.get(r.contact_id) ?? []), r]);
    return m;
  };
  const dealsBy = byContact((dealRows ?? []) as unknown as DealRow[]);
  const tasksBy = byContact((taskRows ?? []) as unknown as TaskRow[]);
  for (const c of customers) {
    c.deals = (dealsBy.get(c.id) ?? []).map((r) => toBoardDeal(r)).map((d) => ({ id: d.id, title: d.title, fils: d.fils, stage: d.stage, ownerId: d.ownerId }));
    c.tasks = (tasksBy.get(c.id) ?? []).map(toBoardTask).map((t) => ({ id: t.id, text: t.text, ownerId: t.ownerId, due: dueWord(t.due, now, tz), done: false }));
  }
}
