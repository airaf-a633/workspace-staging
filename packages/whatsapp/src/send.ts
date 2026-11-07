import { GraphError } from "./graph";

/**
 * M2.4: sending a text message, and what to do when WhatsApp says no. Temporary problems (rate limits, Meta
 * being down) are retried by the queue; permanent ones fail the message at once with a reason in plain words.
 * Codes from Meta's Cloud API error reference.
 */

export interface SendResult {
  /** WhatsApp's id for the message (wamid): status webhooks refer to it. */
  externalId: string;
}

export async function sendText(version: string, phoneNumberId: string, token: string, to: string, body: string, fetchImpl: typeof fetch = fetch): Promise<SendResult> {
  const res = await fetchImpl(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body, preview_url: true } }),
  });
  const json = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { message?: string; code?: number } };
  if (!res.ok) throw new GraphError(json.error?.message ?? `Graph API ${res.status}`, res.status, json.error?.code ?? null);
  const id = json.messages?.[0]?.id;
  if (!id) throw new GraphError("WhatsApp accepted the request but returned no message id", 502, null);
  return { externalId: id };
}

/** Codes worth retrying: rate limits and Meta-side trouble. */
const TEMPORARY = new Set([4, 80007, 130429, 131016, 131048, 131056, 133004]);

/** Plain-words reasons for permanent failures, shown on the message in the inbox. */
const REASONS: Record<number, string> = {
  131047: "More than 24 hours have passed since the customer last wrote. WhatsApp only allows an approved message now.",
  131026: "WhatsApp couldn't deliver this. The customer may have blocked this number or no longer uses WhatsApp.",
  131021: "This is the business's own number, so the message can't be sent to it.",
  131051: "WhatsApp doesn't support this kind of message.",
  131052: "The customer's media couldn't be downloaded.",
  131053: "The file couldn't be sent. It may be too large or an unsupported type.",
  131042: "There's a billing problem on the WhatsApp account. Check payment in Meta Business Suite.",
  131031: "This WhatsApp account is locked or restricted by Meta.",
  190: "The WhatsApp connection expired. Reconnect the number in Settings › Channels.",
  10: "Relay no longer has permission to send from this number. Reconnect it in Settings › Channels.",
  100: "WhatsApp rejected the message as invalid.",
};

export function classifySendError(e: unknown): { temporary: boolean; code: string; reason: string } {
  if (e instanceof GraphError) {
    const code = e.code ?? 0;
    const temporary = TEMPORARY.has(code) || e.status >= 500 || e.status === 429;
    return {
      temporary,
      code: String(e.code ?? e.status),
      reason: REASONS[code] ?? (temporary ? "WhatsApp is busy right now. Relay kept trying but couldn't send it." : "WhatsApp didn't accept this message."),
    };
  }
  // Network errors and timeouts: try again.
  return { temporary: true, code: "network", reason: "Relay couldn't reach WhatsApp. Check that the number is still connected." };
}
