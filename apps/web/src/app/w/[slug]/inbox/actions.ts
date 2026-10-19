"use server";

import type { InboxAction } from "@/components/inbox/store";
import { createClient } from "@/lib/supabase/server";

/** Opening a real chat clears its unread count (the database checks the person may see it). */
export async function markConversationRead(conversationId: string) {
  const supabase = await createClient();
  await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
}

const STATUS = { resolve: "resolved", reopen: "reopened", spam: "spam", notSpam: "not_spam" } as const;

/**
 * Saves one inbox action (step 2a). The database functions check every permission again, so a refused action
 * returns "failed" and the inbox reloads the real state. Who did it always comes from the session, never the client.
 */
export async function saveInboxAction(a: InboxAction): Promise<string | null> {
  const supabase = await createClient();
  const call = (() => {
    switch (a.type) {
      case "claim":
        return supabase.rpc("claim_conversation", { p_conversation: a.id });
      case "handover":
        return supabase.rpc("hand_over_conversation", { p_conversation: a.id, p_to_member: a.toPerson, p_to_team: a.toTeam, p_note: a.note });
      case "resolve":
      case "reopen":
      case "spam":
      case "notSpam":
        return supabase.rpc("set_conversation_status", { p_conversation: a.id, p_action: STATUS[a.type] });
      case "note":
        return supabase.rpc("add_conversation_note", { p_conversation: a.id, p_body: a.text, p_mentions: a.mentions ?? [] });
      case "askCollab":
        return supabase.rpc("ask_to_collaborate", { p_conversation: a.id });
      default:
        return null;
    }
  })();
  if (!call) return null;
  const { error } = await call;
  return error ? "failed" : null;
}
