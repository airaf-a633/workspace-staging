import { register } from "./registry";
import { ChannelSendError, type ChannelModule, type Creds, type InboundItem } from "./types";

/**
 * X (Twitter) direct messages, through the business's own X developer app (decided 2026-11-02): they pay X directly
 * (pay per use) and Relay carries no cost. Built from docs.x.com, read on 2 November 2026:
 *  - New DMs reach the webhook as the `dm.received` event, only for unencrypted (legacy) chats. The payload holds a
 *    `direct_message_events` array (id, created_timestamp, message_create { sender_id, target.recipient_id,
 *    message_data { text, entities } }) and a `users` map. The page does not show the envelope around it, so the
 *    events are looked for anywhere in the body.
 *  - A reply is POST /2/dm_conversations/with/:participant_id/messages with { text } and a user access token that has
 *    the dm.write scope. It creates the conversation if there isn't one.
 *  - Access tokens last two hours; the refresh token comes only with the offline.access scope. A refresh is a POST to
 *    https://api.x.com/2/oauth2/token with grant_type refresh_token and the app's client id and secret as Basic auth.
 */

const API = "https://api.x.com";
const REFRESH_MARGIN_MS = 2 * 60_000;
const MAX_TEXT = 10_000;

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : typeof v === "number" ? String(v) : undefined);

interface Found {
  events: Record<string, unknown>[];
  users: Record<string, unknown>;
}

/** Every `direct_message_events` array in the body, with the `users` map next to it. */
function findEvents(node: unknown, depth = 0): Found[] {
  if (depth > 6 || !node || typeof node !== "object") return [];
  const o = node as Record<string, unknown>;
  const here = Array.isArray(o.direct_message_events) ? [{ events: (o.direct_message_events as unknown[]).map(obj), users: obj(o.users) }] : [];
  return [...here, ...Object.values(o).flatMap((v) => findEvents(v, depth + 1))];
}

/** One DM event to a Relay message. DMs the account sent itself and anything without an id or sender are skipped. */
export function parseX(body: unknown, channel: { settings: Record<string, unknown> }): InboundItem[] {
  const me = str(channel.settings.user_id);
  const out: InboundItem[] = [];
  for (const { events, users } of findEvents(body)) {
    for (const event of events) {
      const id = str(event.id);
      const create = obj(event.message_create);
      const sender = str(create.sender_id);
      if (!id || !sender || sender === me) continue;
      const data = obj(create.message_data);
      const text = str(data.text);
      const who = obj(users[sender]);
      const display = str(who.name) ?? str(who.screen_name) ?? str(who.username);
      const stamp = Number(str(event.created_timestamp));
      const base = {
        kind: "x",
        address: sender,
        ...(display ? { display } : {}),
        externalId: id,
        sentAt: Number.isFinite(stamp) && stamp > 0 ? new Date(stamp) : new Date(),
        replyTo: null,
        threadKey: "",
        data: {},
      };
      // A message with no words (a picture or a card) can't be shown yet; saying so is better than losing it.
      out.push(text ? { ...base, type: "text", body: text } : { ...base, type: "unsupported", body: null });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------

const basic = (id: string, secret: string) => `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;

interface TokenAnswer {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

const RECONNECT = "X no longer accepts the saved login for this account. Open the channel in Settings > Channels and connect the X account again.";

/**
 * A user access token that is good for at least two more minutes. The saved one is used while it lasts; after that it is
 * renewed with the refresh token, and the new pair is saved (X may issue a new refresh token every time, so the old one
 * must not be kept).
 */
export async function accessToken(
  f: typeof fetch,
  creds: Creds,
  settings: Record<string, unknown>,
  save: ((secrets: Creds) => Promise<void>) | undefined,
  now = Date.now(),
  force = false,
): Promise<string> {
  const expires = Number(creds.expires_at ?? 0);
  if (!force && creds.access_token && expires - now > REFRESH_MARGIN_MS) return creds.access_token;
  if (!creds.refresh_token) throw new ChannelSendError(RECONNECT, "bad_credentials");

  let res: Response;
  try {
    res = await f(`${API}/2/oauth2/token`, {
      method: "POST",
      headers: { authorization: basic(str(settings.client_id) ?? "", creds.client_secret ?? ""), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: creds.refresh_token }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ChannelSendError("Relay couldn't reach X. It will try again.", "unreachable", true);
  }
  const body = (await res.json().catch(() => ({}))) as TokenAnswer;
  if (res.status >= 500 || res.status === 429) throw new ChannelSendError("X had a problem renewing the login. Relay will try again.", `token_${res.status}`, true);
  if (!res.ok || !body.access_token) throw new ChannelSendError(`${RECONNECT}${body.error_description ? ` X says: ${body.error_description.slice(0, 200)}` : ""}`, "bad_credentials");

  const renewed: Creds = {
    access_token: body.access_token,
    expires_at: String(now + Math.max(60, body.expires_in ?? 7200) * 1000),
    ...(body.refresh_token ? { refresh_token: body.refresh_token } : {}),
  };
  Object.assign(creds, renewed);
  await save?.(renewed);
  return body.access_token;
}

interface Problem {
  title?: string;
  detail?: string;
  type?: string;
  data?: { dm_event_id?: string; dm_conversation_id?: string };
}

/** X's refusal as a sentence a person can act on; X's own words are passed on. */
export function explainXError(status: number, body: Problem): ChannelSendError {
  const said = [body.title, body.detail].filter(Boolean).join(": ");
  const tail = said ? ` X says: ${said.slice(0, 250)}` : "";
  if (status === 429) return new ChannelSendError("X asked Relay to slow down. It will try again.", "rate_limited", true);
  if (status >= 500) return new ChannelSendError("X had a problem. Relay will try again.", `http_${status}`, true);
  if (status === 401) return new ChannelSendError(RECONNECT, "bad_credentials");
  if (status === 403) return new ChannelSendError(`X wouldn't let this account message this person. They may not accept messages from accounts like yours, or may have blocked it.${tail}`, "forbidden");
  if (status === 402) return new ChannelSendError(`X says the developer app has no credits left. Add credits in the X Developer Console, then send again.${tail}`, "no_credits");
  return new ChannelSendError(`X refused the message (${status}).${tail}`, `http_${status}`);
}

const x: ChannelModule = {
  type: "x",
  parse: (body, channel) => parseX(body, channel),

  async send(f, creds, req) {
    const post = async (token: string) => {
      let res: Response;
      try {
        res = await f(`${API}/2/dm_conversations/with/${encodeURIComponent(req.to)}/messages`, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ text: req.body.slice(0, MAX_TEXT) }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        throw new ChannelSendError("Relay couldn't reach X. It will try again.", "unreachable", true);
      }
      return { status: res.status, body: (await res.json().catch(() => ({}))) as Problem };
    };

    let answer = await post(await accessToken(f, creds, req.settings, req.saveSecrets));
    // A token X has just retired is renewed once and the message tried again.
    if (answer.status === 401) answer = await post(await accessToken(f, creds, req.settings, req.saveSecrets, Date.now(), true));
    const id = str(answer.body.data?.dm_event_id);
    if (answer.status >= 200 && answer.status < 300 && id) return { externalId: id };
    throw explainXError(answer.status, answer.body);
  },
};

register(x);
export default x;
