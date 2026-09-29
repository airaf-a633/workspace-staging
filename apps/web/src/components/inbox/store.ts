import type { Conversation, Message, Person, Team } from "./types";

/**
 * Session-only inbox state (sample chats, reset on reload). Each action matches a server call M2 will make,
 * so swapping this reducer for real mutations doesn't change the screen.
 */
export type InboxAction =
  | { type: "open"; id: string }
  | { type: "claim"; id: string; by: string; at: number }
  | { type: "handover"; id: string; by: string; toPerson: string | null; toTeam: string | null; note: string; at: number }
  | { type: "resolve"; id: string; by: string; at: number }
  | { type: "reopen"; id: string; by: string; at: number }
  | { type: "spam"; id: string; by: string; at: number }
  | { type: "notSpam"; id: string; by: string; at: number }
  | { type: "note"; id: string; by: string; text: string; at: number }
  | { type: "askCollab"; id: string; by: string; at: number }
  | { type: "dismissPhoneReply"; id: string }
  | { type: "addTask"; id: string; by: string; text: string; at: number }
  | { type: "toggleTask"; id: string; taskId: string };

export interface Ctx {
  people: Person[];
  teams: Team[];
}

let n = 0;
const nextId = () => `local-${++n}`;
const event = (text: string, at: number): Message => ({ id: nextId(), kind: "event", text, at });

export function reducer(ctx: Ctx) {
  const name = (id: string | null) => ctx.people.find((p) => p.id === id)?.name ?? "Someone";
  const who = (id: string) => {
    const p = ctx.people.find((x) => x.id === id);
    return p ? `${p.name} (${p.role})` : "Someone";
  };
  const teamName = (id: string) => ctx.teams.find((t) => t.id === id)?.name ?? "a team";

  return (state: Conversation[], a: InboxAction): Conversation[] =>
    state.map((c) => {
      if (c.id !== a.id) return c;
      switch (a.type) {
        case "open":
          return c.unread ? { ...c, unread: 0 } : c;
        case "claim":
          return { ...c, holderId: a.by, trail: [...c.trail, a.by], status: "open", messages: [...c.messages, event(`${name(a.by)} claimed this chat`, a.at)] };
        case "handover": {
          const text = a.toPerson
            ? `${name(a.by)} handed this chat to ${who(a.toPerson)}`
            : `${name(a.by)} handed this chat to ${teamName(a.toTeam!)}. The first person to claim it takes over.`;
          return {
            ...c,
            holderId: a.toPerson,
            teamId: a.toTeam ?? c.teamId,
            trail: a.toPerson ? [...c.trail, a.toPerson] : c.trail,
            collaboratorIds: [],
            status: "open",
            phoneReply: undefined,
            handoffs: [...c.handoffs, { fromId: a.by, toId: a.toPerson, toTeamId: a.toTeam, note: a.note.trim(), at: a.at }],
            messages: [...c.messages, event(text, a.at)],
          };
        }
        case "resolve":
          return { ...c, status: "resolved", phoneReply: undefined, messages: [...c.messages, event(`${name(a.by)} resolved this chat`, a.at)] };
        case "reopen":
          return { ...c, status: "open", messages: [...c.messages, event(`${name(a.by)} reopened this chat`, a.at)] };
        case "spam":
          return { ...c, status: "spam", messages: [...c.messages, event(`${name(a.by)} marked this chat as spam`, a.at)] };
        case "notSpam":
          return { ...c, status: "open", messages: [...c.messages, event(`${name(a.by)} moved this chat out of spam`, a.at)] };
        case "note":
          return { ...c, messages: [...c.messages, { id: nextId(), kind: "note", authorId: a.by, text: a.text.trim(), at: a.at }] };
        case "askCollab":
          return { ...c, messages: [...c.messages, event(`${name(a.by)} asked ${name(c.holderId)} to add them as a collaborator`, a.at)] };
        case "dismissPhoneReply":
          return { ...c, phoneReply: undefined };
        case "addTask":
          return { ...c, contact: { ...c.contact, tasks: [...c.contact.tasks, { id: nextId(), text: a.text.trim(), ownerId: a.by, due: "No date", done: false }] } };
        case "toggleTask":
          return { ...c, contact: { ...c.contact, tasks: c.contact.tasks.map((t) => (t.id === a.taskId ? { ...t, done: !t.done } : t)) } };
      }
    });
}

/** The last thing that happened, for sorting and the row snippet (internal events don't count). */
export function lastActivity(c: Conversation) {
  const real = c.messages.filter((m) => m.kind !== "event");
  return (real[real.length - 1] ?? c.messages[c.messages.length - 1])?.at ?? 0;
}

/** Timestamp for a user action. Called from event handlers only. */
export const stamp = () => Date.now();
