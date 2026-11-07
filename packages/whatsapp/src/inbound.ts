/**
 * Reading the `messages` webhook value: inbound messages, the senders' profiles and delivery statuses.
 * Parsing is lenient on purpose: a message type we don't know yet becomes "unsupported" (and is shown as
 * such) instead of being dropped. Shapes follow Meta's Cloud API webhook reference.
 */

export interface InboundMessage {
  wamid: string;
  from: string;
  profileName: string | null;
  /** Meta's send time (seconds since epoch, as a Date). Threads are ordered by this, never by arrival. */
  at: Date;
  type: string;
  body: string | null;
  caption: string | null;
  /** Media to download later: Meta's media ID, plus what Meta told us about it. */
  media: { id: string; mime: string | null; sha256: string | null; filename: string | null; voice: boolean } | null;
  /** Structured parts: location, shared contacts, the button or list reply, Meta's error for unsupported types. */
  data: Record<string, unknown>;
  replyTo: string | null;
  /** For reactions: the message reacted to, and the emoji ("" removes it). */
  reaction: { to: string; emoji: string } | null;
}

export interface InboundStatus {
  wamid: string;
  status: "sent" | "delivered" | "read" | "failed";
  at: Date;
  recipient: string | null;
  error: { code: string; title: string; details: string | null } | null;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const when = (v: unknown) => new Date(Number(v ?? 0) * 1000);

const MEDIA_TYPES = ["image", "video", "audio", "document", "sticker"] as const;

export function parseMessagesValue(value: Obj): { messages: InboundMessage[]; statuses: InboundStatus[] } {
  const names = new Map<string, string>();
  for (const c of arr(value.contacts)) {
    const id = str(obj(c).wa_id);
    const name = str(obj(obj(c).profile).name);
    if (id && name) names.set(id, name);
  }

  const messages = arr(value.messages).flatMap((raw): InboundMessage[] => {
    const m = obj(raw);
    const wamid = str(m.id);
    const from = str(m.from);
    if (!wamid || !from) return [];
    const type = str(m.type) ?? "unsupported";
    const base: InboundMessage = {
      wamid,
      from,
      profileName: names.get(from) ?? null,
      at: when(m.timestamp),
      type,
      body: null,
      caption: null,
      media: null,
      data: {},
      replyTo: str(obj(m.context).id),
      reaction: null,
    };

    if (type === "text") return [{ ...base, body: str(obj(m.text).body) }];
    if ((MEDIA_TYPES as readonly string[]).includes(type)) {
      const media = obj(m[type]);
      const id = str(media.id);
      return [{
        ...base,
        caption: str(media.caption),
        media: id ? { id, mime: str(media.mime_type), sha256: str(media.sha256), filename: str(media.filename), voice: media.voice === true } : null,
      }];
    }
    if (type === "location") {
      const l = obj(m.location);
      return [{ ...base, body: str(l.name) ?? str(l.address), data: { latitude: l.latitude, longitude: l.longitude, name: l.name ?? null, address: l.address ?? null } }];
    }
    if (type === "contacts") {
      const shared = arr(m.contacts).map((c) => {
        const o = obj(c);
        return { name: str(obj(o.name).formatted_name), phones: arr(o.phones).map((p) => str(obj(p).phone)).filter(Boolean) };
      });
      return [{ ...base, body: shared.map((s) => s.name).filter(Boolean).join(", ") || null, data: { contacts: shared } }];
    }
    if (type === "reaction") {
      const r = obj(m.reaction);
      const to = str(r.message_id);
      return to ? [{ ...base, reaction: { to, emoji: typeof r.emoji === "string" ? r.emoji : "" } }] : [];
    }
    if (type === "button") return [{ ...base, body: str(obj(m.button).text) }];
    if (type === "interactive") {
      const i = obj(m.interactive);
      const reply = obj(i.button_reply ?? i.list_reply);
      return [{ ...base, body: str(reply.title), data: { reply_id: reply.id ?? null, description: reply.description ?? null } }];
    }
    // Unknown or unsupported: keep it, show "This message type isn't supported yet".
    return [{ ...base, type: "unsupported", data: { original_type: type, errors: m.errors ?? null } }];
  });

  const statuses = arr(value.statuses).flatMap((raw): InboundStatus[] => {
    const s = obj(raw);
    const wamid = str(s.id);
    const status = str(s.status);
    if (!wamid || !status || !["sent", "delivered", "read", "failed"].includes(status)) return [];
    const e = obj(arr(s.errors)[0]);
    return [{
      wamid,
      status: status as InboundStatus["status"],
      at: when(s.timestamp),
      recipient: str(s.recipient_id),
      error: status === "failed" ? { code: String(e.code ?? ""), title: str(e.title) ?? "Not delivered", details: str(obj(e.error_data).details) } : null,
    }];
  });

  return { messages, statuses };
}
