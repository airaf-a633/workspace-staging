import type { Conversation, InboxData } from "@/components/inbox/types";
import { slaClock, type Target } from "@/components/sla/sla";

/**
 * What the bell shows (decided 2026-10-19): things that need *this* person, never a feed of everything.
 * - handover: a chat was handed to you
 * - mention: someone wrote @you in a note
 * - collabRequest: someone asked to help on a chat you hold
 * - slaWarn / slaBreach: a chat has used most of, or passed, a reply target (the holder; at breach also the team's managers)
 * - channelBroken: a channel can't send (owners and admins only)
 * - discountAsked / discountApproved / discountDeclined: a discount waiting for you, or the answer to yours
 * - taskAssigned / taskLate: a task someone gave you, or yours that has passed its time
 * The preview builds them from the sample inbox. The real app stores them (decided 2026-11-04, migration
 * 20261104000001_notifications) and lib/notices-live.ts reads them.
 */
export type NoticeKind =
  | "handover" | "mention" | "collabRequest" | "slaWarn" | "slaBreach" | "channelBroken"
  | "discountAsked" | "discountApproved" | "discountDeclined" | "taskAssigned" | "taskLate";

export interface AppNotice {
  id: string;
  kind: NoticeKind;
  at: number;
  /** Who did it (a teammate's name), when there is one. */
  actor?: string;
  /** The customer or channel it's about. */
  subject: string;
  /** A short quote: the handoff note or the note that mentioned you. */
  quote?: string;
  /** The discount asked for, on the discount notices. Never an amount: amounts are not stored here. */
  percent?: number;
  /** Which reply target, on the reply-target notices. */
  target?: Target;
  href: string;
  read: boolean;
}

export function buildNotices(data: InboxData, base: string, canManageChannels: boolean): AppNotice[] {
  const me = data.viewer.memberId;
  const myName = data.people.find((p) => p.id === me)?.name;
  const name = (id: string | null | undefined) => data.people.find((p) => p.id === id)?.name;
  const link = (c: Conversation) => `${base}/inbox?c=${c.id}`;
  const out: AppNotice[] = [];

  for (const c of data.conversations) {
    for (const h of c.handoffs) {
      if (h.toId === me && h.fromId !== me) {
        out.push({ id: `h-${c.id}-${h.at}`, kind: "handover", at: h.at, actor: name(h.fromId), subject: c.contact.name, quote: h.note, href: link(c), read: false });
      }
    }
    for (const m of c.messages) {
      if (m.kind === "note" && myName && m.authorId !== me && m.text?.includes(`@${myName}`)) {
        out.push({ id: `m-${m.id}`, kind: "mention", at: m.at, actor: name(m.authorId), subject: c.contact.name, quote: m.text, href: link(c), read: false });
      }
      if (m.event?.key === "askedCollab" && c.holderId === me && m.event.by !== me && !c.collaboratorIds.includes(m.event.by ?? "")) {
        out.push({ id: `a-${m.id}`, kind: "collabRequest", at: m.at, actor: name(m.event.by), subject: c.contact.name, href: link(c), read: false });
      }
    }
    if (data.sla && c.holderId === me && c.status === "open") {
      const clock = slaClock(c, data.sla, data.now);
      if (clock?.state === "breach") out.push({ id: `s-${c.id}`, kind: "slaBreach", at: data.now - 60_000, subject: c.contact.name, target: clock.target, href: link(c), read: false });
      else if (clock?.state === "warn") out.push({ id: `w-${c.id}`, kind: "slaWarn", at: data.now - 120_000, subject: c.contact.name, target: clock.target, href: link(c), read: false });
    }
  }
  if (canManageChannels) {
    for (const i of data.inboxes) {
      if (i.broken) out.push({ id: `b-${i.id}`, kind: "channelBroken", at: data.now - 3 * 3_600_000, subject: i.name, href: `${base}/channels`, read: true });
    }
  }
  // Newest first; anything older than a day starts as read so the count stays meaningful.
  return out
    .sort((a, b) => b.at - a.at)
    .map((n) => (data.now - n.at > 24 * 3_600_000 ? { ...n, read: true } : n));
}
