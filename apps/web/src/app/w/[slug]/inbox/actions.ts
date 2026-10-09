"use server";

import { createClient } from "@/lib/supabase/server";

/** Opening a real chat clears its unread count (the database checks the person may see it). */
export async function markConversationRead(conversationId: string) {
  const supabase = await createClient();
  await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
}
