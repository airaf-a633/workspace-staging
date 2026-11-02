import type { AppNotice, NoticeKind } from "../components/notifications/notifications";

/** A stored notice as the database returns it (notifications joined to the person who did it). */
export interface NoticeRow {
  id: string;
  kind: string;
  subject: string;
  quote: string | null;
  percent: number | string | null;
  conversation_id: string | null;
  deal_id: string | null;
  task_id: string | null;
  channel_id: string | null;
  created_at: string;
  read_at: string | null;
  actor: { display_name: string } | { display_name: string }[] | null;
}

const KIND: Record<string, NoticeKind> = {
  handover: "handover",
  mention: "mention",
  collab_request: "collabRequest",
  channel_broken: "channelBroken",
  discount_asked: "discountAsked",
  discount_approved: "discountApproved",
  discount_declined: "discountDeclined",
  task_assigned: "taskAssigned",
  task_late: "taskLate",
};

/** Where a notice leads: the chat, the deal, the task list, or the channels. */
function link(r: NoticeRow, base: string): string {
  if (r.conversation_id) return `${base}/inbox?c=${r.conversation_id}`;
  if (r.deal_id) return `${base}/deals?deal=${r.deal_id}`;
  if (r.task_id) return `${base}/tasks`;
  if (r.channel_id) return `${base}/channels`;
  return base;
}

/** Stored notices to what the bell shows. A kind this version doesn't know is skipped rather than shown wrongly. */
export function toNotices(rows: NoticeRow[], base: string): AppNotice[] {
  const out: AppNotice[] = [];
  for (const r of rows) {
    const kind = KIND[r.kind];
    if (!kind) continue;
    const actor = Array.isArray(r.actor) ? r.actor[0] : r.actor;
    out.push({
      id: r.id,
      kind,
      at: Date.parse(r.created_at),
      ...(actor?.display_name ? { actor: actor.display_name } : {}),
      subject: r.subject,
      ...(r.quote ? { quote: r.quote } : {}),
      ...(r.percent !== null && r.percent !== undefined ? { percent: Number(r.percent) } : {}),
      href: link(r, base),
      read: r.read_at !== null,
    });
  }
  return out;
}
