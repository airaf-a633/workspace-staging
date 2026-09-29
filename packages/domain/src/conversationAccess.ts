/**
 * Who can do what in a conversation, from the viewer's permission scopes.
 * Mirrors the database's can_reply() and RLS so the UI never offers an action the server would refuse.
 *
 * Scopes (from ROLES_AND_PERMISSIONS.md):
 *   all  - every conversation in the workspace
 *   team - conversations routed to one of the viewer's teams, plus their own
 *   own  - conversations the viewer holds or collaborates on
 *   none - nothing
 */
export type Scope = "none" | "own" | "team" | "all";

export const CONVERSATION_PERMISSIONS = [
  "conversations.view",
  "conversations.reply",
  "conversations.override",
  "conversations.claim",
  "conversations.handover",
  "conversations.collaborators",
  "conversations.notes",
  "conversations.spam",
  "conversations.resolve",
  "deals.view",
  "deals.values",
  "tasks.manage",
] as const;
export type ConversationPermission = (typeof CONVERSATION_PERMISSIONS)[number];

export interface Viewer {
  memberId: string;
  teamIds: readonly string[];
  scopes: Partial<Record<ConversationPermission, Scope>>;
}

export interface ConversationRef {
  teamId: string | null;
  holderId: string | null;
  collaboratorIds?: readonly string[];
}

/** Does the viewer's scope for this permission reach this conversation? */
export function covers(viewer: Viewer, permission: ConversationPermission, c: ConversationRef): boolean {
  const scope = viewer.scopes[permission] ?? "none";
  const own = c.holderId === viewer.memberId || (c.collaboratorIds ?? []).includes(viewer.memberId);
  switch (scope) {
    case "all":
      return true;
    case "team":
      return own || (c.teamId !== null && viewer.teamIds.includes(c.teamId));
    case "own":
      return own;
    default:
      return false;
  }
}

/**
 * How the viewer may use the reply box:
 * - holder: they hold the chat and can reply;
 * - collaborator: added by the holder, can reply;
 * - override: a manager replying without taking over (the holder stays and is told);
 * - claim: nobody holds it and the viewer may claim it;
 * - follower: read-only (can still write notes if allowed);
 * - hidden: the viewer can't see this conversation at all.
 */
export type ReplyAccess = "holder" | "collaborator" | "override" | "claim" | "follower" | "hidden";

export function replyAccess(viewer: Viewer, c: ConversationRef): ReplyAccess {
  if (!covers(viewer, "conversations.view", c)) return "hidden";
  const canReply = (viewer.scopes["conversations.reply"] ?? "none") !== "none";
  if (c.holderId === viewer.memberId) return canReply ? "holder" : "follower";
  if ((c.collaboratorIds ?? []).includes(viewer.memberId)) return canReply ? "collaborator" : "follower";
  if (c.holderId === null) return covers(viewer, "conversations.claim", c) ? "claim" : "follower";
  return covers(viewer, "conversations.override", c) ? "override" : "follower";
}

export interface ConversationActions {
  access: ReplyAccess;
  canHandOver: boolean;
  canResolve: boolean;
  canMarkSpam: boolean;
  canWriteNotes: boolean;
  canAskToCollaborate: boolean;
}

export function conversationActions(viewer: Viewer, c: ConversationRef): ConversationActions {
  const access = replyAccess(viewer, c);
  const visible = access !== "hidden";
  return {
    access,
    canHandOver: visible && covers(viewer, "conversations.handover", c),
    canResolve: visible && covers(viewer, "conversations.resolve", c),
    canMarkSpam: visible && covers(viewer, "conversations.spam", c),
    canWriteNotes: visible && covers(viewer, "conversations.notes", c),
    // Only people who could reply are worth adding as collaborators.
    canAskToCollaborate: access === "follower" && c.holderId !== null && (viewer.scopes["conversations.reply"] ?? "none") !== "none",
  };
}

/** Deal values are money: shown only to roles that may see them (own = deals the viewer owns). */
export function canSeeDealValue(viewer: Viewer, dealOwnerId: string | null): boolean {
  const scope = viewer.scopes["deals.values"] ?? "none";
  if (scope === "all" || scope === "team") return true;
  return scope === "own" && dealOwnerId === viewer.memberId;
}

export const HANDOFF_NOTE_MIN = 10;

/** The handoff note is required so the next person knows what to do. Returns an error message or null. */
export function handoffNoteError(note: string): string | null {
  return note.trim().length < HANDOFF_NOTE_MIN
    ? `Write at least ${HANDOFF_NOTE_MIN} characters so the next person knows what to do.`
    : null;
}

/** WhatsApp's customer service window: free-form replies only within 24 hours of the customer's last message. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function windowOpen(lastCustomerMessageAt: number | null, now: number): boolean {
  return lastCustomerMessageAt !== null && now - lastCustomerMessageAt < SERVICE_WINDOW_MS;
}
