import { z } from "zod";

/**
 * The outer shape of a WhatsApp Business Account webhook. Only the envelope is validated
 * strictly here; each change's `value` is parsed by its own handler (added from M2.3), so
 * new or unknown Meta fields never make us drop an event.
 */
export const WEBHOOK_FIELDS = [
  "messages",
  "smb_message_echoes",
  "history",
  "smb_app_state_sync",
  "account_update",
  "phone_number_quality_update",
  "message_template_status_update",
] as const;
export type WebhookField = (typeof WEBHOOK_FIELDS)[number];

const change = z.object({
  field: z.string(),
  value: z.record(z.string(), z.unknown()),
});

export const webhookEnvelope = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z
    .array(
      z.object({
        id: z.string(), // WhatsApp Business Account ID
        changes: z.array(change),
      }),
    )
    .min(1),
});
export type WebhookEnvelope = z.infer<typeof webhookEnvelope>;

export interface RoutedChange {
  wabaId: string;
  field: string;
  known: boolean;
  /** Present on message-related changes; routes the event to a workspace's number. */
  phoneNumberId: string | null;
  value: Record<string, unknown>;
}

/** Splits one webhook into its changes, each tagged with the number it belongs to. */
export function routeChanges(envelope: WebhookEnvelope): RoutedChange[] {
  return envelope.entry.flatMap((e) =>
    e.changes.map((c) => {
      const metadata = c.value["metadata"] as { phone_number_id?: unknown } | undefined;
      return {
        wabaId: e.id,
        field: c.field,
        known: (WEBHOOK_FIELDS as readonly string[]).includes(c.field),
        phoneNumberId: typeof metadata?.phone_number_id === "string" ? metadata.phone_number_id : null,
        value: c.value,
      };
    }),
  );
}

/** GET verification handshake: echo hub.challenge only when the verify token matches. */
export function verifySubscription(params: URLSearchParams, verifyToken: string): string | null {
  if (!verifyToken) return null;
  const ok = params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === verifyToken;
  return ok ? params.get("hub.challenge") : null;
}
