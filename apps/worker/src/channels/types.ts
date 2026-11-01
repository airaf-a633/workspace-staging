/**
 * What every credential-based channel provides (decided 2026-11-01). A channel is one small module: it turns the
 * provider's webhook body into messages, sends a reply, and (if it has files) downloads one. The shared code
 * around it does the rest: dedupe, customers, conversations, storage, retries and plain-words errors.
 */

export type Creds = Record<string, string>;

export interface ChannelRow {
  id: string;
  workspace_id: string;
  type: string;
  settings: Record<string, unknown>;
}

/** A file the provider told us about. `ref` is whatever the module needs later to fetch it. */
export interface MediaRef {
  ref: Record<string, unknown>;
  mime?: string | undefined;
  filename?: string | undefined;
}

/** One inbound message, in Relay's own shape. */
export interface InboundItem {
  /** The customer's identity kind ('telegram', 'line', 'phone', 'api'…) and their address on it. */
  kind: string;
  address: string;
  display?: string | undefined;
  /** The provider's id for this message: the dedupe key. */
  externalId: string;
  type: string;
  body?: string | null | undefined;
  caption?: string | null | undefined;
  /** Anything a later reply needs (a LINE reply token, a Slack thread), kept on the message. */
  data?: Record<string, unknown> | undefined;
  replyTo?: string | null | undefined;
  sentAt: Date;
  threadKey?: string | undefined;
  subject?: string | null | undefined;
  /** The first file becomes the message's media; the rest are only counted in `data`. */
  media?: MediaRef[] | undefined;
}

export interface SendRequest {
  messageId: string;
  body: string;
  /** The customer's address on this channel. */
  to: string;
  threadKey: string;
  settings: Record<string, unknown>;
  /** The customer's latest inbound message's `data` and time (a reply token lives there). */
  lastInbound: Record<string, unknown> | null;
  lastInboundAt: Date | null;
}

/**
 * A send that failed, with what to tell the person in plain words. Temporary failures (a rate limit, a server
 * error) are retried by the queue; the rest fail the message at once.
 */
export class ChannelSendError extends Error {
  constructor(
    reason: string,
    readonly code: string,
    readonly temporary = false,
  ) {
    super(reason);
  }
}

export interface ChannelModule {
  type: string;
  /** Provider webhook body to messages. Events that aren't messages (typing, read receipts) return []. */
  parse(body: unknown, channel: ChannelRow, creds: Creds): InboundItem[];
  /**
   * Optional: something to do for a webhook that is not a message (Telegram's Start button sends a greeting).
   * It runs after the messages are filed. A failure is logged and never fails the event, so a retry can't double-file.
   */
  welcome?(f: typeof fetch, creds: Creds, body: unknown, channel: ChannelRow): Promise<void>;
  send(f: typeof fetch, creds: Creds, req: SendRequest): Promise<{ externalId: string }>;
  download?(f: typeof fetch, creds: Creds, ref: Record<string, unknown>): Promise<{ bytes: Uint8Array; mime?: string | undefined; filename?: string | undefined }>;
}
