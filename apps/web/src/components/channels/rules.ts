import type { ChannelKey } from "./catalog";

/**
 * When and how a business may reply on each channel (decided 2026-10-07: the demo follows each platform's
 * real rules). Only rules the platforms publish are encoded here; everything else replies freely.
 *
 * - WhatsApp: free-form replies for 24 hours after the customer's last message, then approved templates only.
 * - Messenger and Instagram: 24 hours of standard messaging, then up to 7 days with the Human Agent tag.
 * - WeChat: customer service messages for 48 hours after the customer's last message.
 * - Voice: there's nothing to type; you call back.
 */
export type ReplyRule =
  | { kind: "free" }
  | { kind: "template" }
  | { kind: "humanAgent"; closesAt: number }
  | { kind: "closed"; reason: "metaWeek" | "wechat" }
  | { kind: "call" };

const HOUR = 3_600_000;

export function replyRule(ch: ChannelKey, lastCustomerAt: number | null, now: number): ReplyRule {
  const since = lastCustomerAt === null ? Infinity : now - lastCustomerAt;
  switch (ch) {
    case "voice":
      return { kind: "call" };
    case "whatsapp":
      return since < 24 * HOUR ? { kind: "free" } : { kind: "template" };
    case "messenger":
    case "instagram":
      if (since < 24 * HOUR) return { kind: "free" };
      if (since < 7 * 24 * HOUR) return { kind: "humanAgent", closesAt: lastCustomerAt! + 7 * 24 * HOUR };
      return { kind: "closed", reason: "metaWeek" };
    case "wechat":
      return since < 48 * HOUR ? { kind: "free" } : { kind: "closed", reason: "wechat" };
    default:
      return { kind: "free" };
  }
}

/** SMS: 160 characters per part in plain text, 70 when the message needs Unicode (Arabic, emoji). */
export function smsParts(text: string) {
  const unicode = [...text].some((c) => c.charCodeAt(0) > 127);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const parts = text.length <= single ? 1 : Math.ceil(text.length / multi);
  return { parts, limit: parts === 1 ? single : multi * parts, unicode };
}

/** Channels where replies land in a thread under the customer's message. */
export const THREADED: ChannelKey[] = ["slack", "discord", "teams"];
