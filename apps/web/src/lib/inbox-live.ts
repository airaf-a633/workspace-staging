import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Conversation, InboxData, Media, MediaType, Message, Person, Team, ViewerInfo } from "@/components/inbox/types";

/**
 * The real inbox (M2.3): the conversations this person may see (row-level security decides), mapped
 * into the same shape the sample inbox uses, so the screen doesn't change when real data arrives.
 * Returns null while the workspace has no real conversation yet: the sample chats show until then
 * (decided 2026-10-02).
 */

const MEDIA_TYPE: Record<string, MediaType> = {
  image: "photo",
  video: "video",
  audio: "voice",
  document: "document",
  sticker: "sticker",
  location: "location",
  contacts: "contact",
  unsupported: "unsupported",
};
const MAX_MESSAGES = 2000;

interface Row {
  id: string;
  team_id: string | null;
  holder_member_id: string | null;
  status: Conversation["status"];
  unread_count: number;
  last_customer_message_at: string | null;
  imported: boolean;
  contacts: { name: string | null; profile_name: string | null; wa_id: string | null } | null;
}

interface MsgRow {
  id: string;
  conversation_id: string;
  wamid: string | null;
  direction: "in" | "out";
  source: string;
  type: string;
  body: string | null;
  caption: string | null;
  data: Record<string, unknown>;
  reply_to_wamid: string | null;
  reaction: string | null;
  status: Message["status"] | "queued" | null;
  error_text: string | null;
  sent_by_member: string | null;
  meta_timestamp: string;
  imported: boolean;
  media: { storage_path: string | null; mime: string | null; size: number | null; filename: string | null; error: string | null } | null;
}

export async function loadLiveInbox(
  supabase: SupabaseClient,
  workspaceId: string,
  people: Person[],
  teams: Team[],
  viewer: ViewerInfo,
): Promise<InboxData | null> {
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, team_id, holder_member_id, status, unread_count, last_customer_message_at, imported, contacts(name, profile_name, wa_id)")
    .eq("workspace_id", workspaceId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (!convs || convs.length === 0) return null;

  const ids = convs.map((c) => c.id);
  const { data: msgs } = await supabase
    .from("messages")
    .select("id, conversation_id, wamid, direction, source, type, body, caption, data, reply_to_wamid, reaction, status, error_text, sent_by_member, meta_timestamp, imported, media(storage_path, mime, size, filename, error)")
    .in("conversation_id", ids)
    .order("meta_timestamp", { ascending: false })
    .limit(MAX_MESSAGES);
  const rows = ((msgs ?? []) as unknown as MsgRow[]).reverse();

  // Signed links (1 hour) for downloaded media; the storage policy re-checks who may see each file.
  const paths = rows.map((m) => m.media?.storage_path).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("media").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const byWamid = new Map(rows.filter((m) => m.wamid).map((m) => [m.wamid!, m]));
  const name = (c: Row["contacts"]) => c?.name ?? c?.profile_name ?? (c?.wa_id ? `+${c.wa_id}` : "");

  const conversations: Conversation[] = (convs as unknown as Row[]).map((c) => {
    const contactName = name(c.contacts);
    const messages: Message[] = rows
      .filter((m) => m.conversation_id === c.id)
      .map((m) => {
        const mediaType = MEDIA_TYPE[m.type];
        const media: Media | undefined = mediaType
          ? {
              type: mediaType,
              name: m.media?.filename ?? (typeof m.data.name === "string" ? m.data.name : undefined),
              size: m.media?.size ?? undefined,
              caption: m.caption ?? undefined,
              url: m.media?.storage_path ? urls.get(m.media.storage_path) : undefined,
              failed: !!m.media?.error,
            }
          : undefined;
        const quoted = m.reply_to_wamid ? byWamid.get(m.reply_to_wamid) : undefined;
        return {
          id: m.id,
          kind: m.direction,
          at: new Date(m.meta_timestamp).getTime(),
          text: m.type === "text" || m.type === "button" || m.type === "interactive" ? (m.body ?? undefined) : undefined,
          media,
          authorId: m.sent_by_member ?? undefined,
          source: m.source === "phone_app" ? "phone" : m.direction === "out" ? "inbox" : undefined,
          status: m.status === "queued" ? "sent" : (m.status ?? undefined),
          error: undefined,
          errorText: m.error_text ?? undefined,
          imported: m.imported || undefined,
          reaction: m.reaction ?? undefined,
          replyTo: quoted ? { author: quoted.direction === "in" ? contactName : "", text: quoted.body ?? quoted.caption ?? "" } : undefined,
        } satisfies Message;
      });
    return {
      id: c.id,
      channel: "whatsapp",
      contact: {
        name: contactName,
        phone: c.contacts?.wa_id ? `+${c.contacts.wa_id}` : "",
        language: "English",
        tags: [],
        deals: [],
        tasks: [],
        orders: [],
      },
      teamId: c.team_id ?? "",
      holderId: c.holder_member_id,
      trail: c.holder_member_id ? [c.holder_member_id] : [],
      collaboratorIds: [],
      status: c.status,
      unread: c.unread_count,
      lastCustomerAt: c.last_customer_message_at ? new Date(c.last_customer_message_at).getTime() : null,
      imported: c.imported || undefined,
      messages,
      handoffs: [],
    };
  });

  return { now: Date.now(), people, teams, viewer, conversations, live: true };
}
