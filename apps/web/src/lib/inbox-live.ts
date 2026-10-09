import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChannelKey } from "@/components/channels/catalog";
import type { ChannelInbox, Conversation, Identity, InboxData, Media, MediaType, Message, Person, Team, ViewerInfo } from "@/components/inbox/types";

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
  contact_id: string;
  channel_id: string;
  subject: string | null;
  channels: { type: ChannelKey } | null;
  team_id: string | null;
  holder_member_id: string | null;
  status: Conversation["status"];
  unread_count: number;
  last_customer_message_at: string | null;
  imported: boolean;
  contacts: {
    name: string | null;
    profile_name: string | null;
    email: string | null;
    phone: string | null;
    contact_identities: { kind: string; address: string; display: string | null }[];
  } | null;
}

interface MsgRow {
  id: string;
  conversation_id: string;
  external_id: string | null;
  direction: "in" | "out";
  source: string;
  type: string;
  body: string | null;
  caption: string | null;
  data: Record<string, unknown>;
  reply_to_external_id: string | null;
  reaction: string | null;
  status: Message["status"] | "queued" | null;
  error_text: string | null;
  sent_by_member: string | null;
  sent_at: string;
  imported: boolean;
  media: { storage_path: string | null; mime: string | null; size: number | null; filename: string | null; error: string | null } | null;
}

/** How an identity shows on the customer card: phone numbers get their "+", handles show as the provider names them. */
function identity(i: { kind: string; address: string; display: string | null }): Identity {
  const ch: ChannelKey = i.kind === "phone" ? "sms" : (i.kind as ChannelKey);
  const handle = i.kind === "whatsapp" || i.kind === "phone" ? `+${i.address}` : (i.display ?? i.address);
  return { ch, handle };
}

const BROKEN = { disconnected: "tokenExpired" } as const;

/** Every connected channel in the workspace, as inboxes. WhatsApp shows its number; others their name. */
export async function loadChannelInboxes(supabase: SupabaseClient, workspaceId: string): Promise<ChannelInbox[]> {
  const { data } = await supabase
    .from("channels")
    .select("id, type, name, external_id, status, whatsapp_accounts(display_phone)")
    .eq("workspace_id", workspaceId)
    .order("created_at");
  const rows = (data ?? []) as unknown as {
    id: string; type: ChannelKey; name: string; external_id: string | null; status: string;
    whatsapp_accounts: { display_phone: string } | null;
  }[];
  return rows.map((c) => ({
    id: c.id,
    channel: c.type,
    name: c.name,
    address: c.whatsapp_accounts?.display_phone ?? c.external_id ?? "",
    broken: BROKEN[c.status as keyof typeof BROKEN],
  }));
}

export async function loadLiveInbox(
  supabase: SupabaseClient,
  workspaceId: string,
  people: Person[],
  teams: Team[],
  viewer: ViewerInfo,
  tz: string,
): Promise<InboxData | null> {
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, contact_id, channel_id, subject, team_id, holder_member_id, status, unread_count, last_customer_message_at, imported, channels(type), contacts(name, profile_name, email, phone, contact_identities(kind, address, display))")
    .eq("workspace_id", workspaceId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (!convs || convs.length === 0) return null;

  // Each connected channel is one inbox in the sidebar.
  const inboxes = await loadChannelInboxes(supabase, workspaceId);

  const ids = convs.map((c) => c.id);
  const { data: msgs } = await supabase
    .from("messages")
    .select("id, conversation_id, external_id, direction, source, type, body, caption, data, reply_to_external_id, reaction, status, error_text, sent_by_member, sent_at, imported, media(storage_path, mime, size, filename, error)")
    .in("conversation_id", ids)
    .order("sent_at", { ascending: false })
    .limit(MAX_MESSAGES);
  const rows = ((msgs ?? []) as unknown as MsgRow[]).reverse();

  // Signed links (1 hour) for downloaded media; the storage policy re-checks who may see each file.
  const paths = rows.map((m) => m.media?.storage_path).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("media").createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const byExternalId = new Map(rows.filter((m) => m.external_id).map((m) => [m.external_id!, m]));
  const name = (c: Row["contacts"]) => c?.name ?? c?.profile_name ?? c?.email ?? c?.phone ?? "";

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
        const quoted = m.reply_to_external_id ? byExternalId.get(m.reply_to_external_id) : undefined;
        return {
          id: m.id,
          kind: m.direction,
          at: new Date(m.sent_at).getTime(),
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
      channel: c.channels?.type ?? "whatsapp",
      inboxId: c.channel_id,
      subject: c.subject ?? undefined,
      contact: {
        id: c.contact_id,
        name: contactName,
        phone: c.contacts?.phone ?? "",
        email: c.contacts?.email ?? undefined,
        identities: (c.contacts?.contact_identities ?? []).map(identity),
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

  return { now: Date.now(), tz, people, teams, viewer, conversations, inboxes, labels: [], live: true };
}
