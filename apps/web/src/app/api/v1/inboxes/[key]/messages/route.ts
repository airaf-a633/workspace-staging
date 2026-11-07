import { createHash } from "node:crypto";
import { z } from "zod";
import { handleChannelWebhook } from "@/lib/channels/intake";
import { same } from "@/lib/channels/signatures";

/**
 * Relay API, inbound (decided 2026-11-01): a customer's system pushes a message into one of its API inboxes.
 *
 *   POST /api/v1/inboxes/<inbox key>/messages
 *   Authorization: Bearer <the inbox's API key>
 *   { "id": "msg-123", "customer": { "id": "user-42", "name": "Ana" }, "text": "Hi",
 *     "sent_at": "2026-11-01T10:00:00Z", "conversation": "order-9",
 *     "attachments": [{ "url": "https://…", "name": "a.png", "type": "image/png" }] }
 *
 * The message id is the idempotency key: sending the same id again files nothing new, so a retry is always safe.
 */
export const dynamic = "force-dynamic";

const message = z
  .object({
    id: z.string().trim().min(1).max(200),
    customer: z.object({ id: z.union([z.string().trim().min(1).max(200), z.number()]), name: z.string().max(120).optional() }),
    text: z.string().max(4096).optional(),
    sent_at: z.iso.datetime({ offset: true }).optional(),
    conversation: z.string().max(200).optional(),
    attachments: z.array(z.object({ url: z.url({ protocol: /^https$/ }).max(2000), name: z.string().max(200).optional(), type: z.string().max(100).optional() })).max(10).optional(),
  })
  .refine((m) => (m.text && m.text.trim()) || m.attachments?.length, { message: "Send some text or at least one attachment." });

export async function POST(request: Request, ctx: RouteContext<"/api/v1/inboxes/[key]/messages">) {
  const { key } = await ctx.params;
  return handleChannelWebhook(request, "api", key, {
    verify: ({ headers, channel }) => {
      const token = /^Bearer (\S+)$/.exec(headers.get("authorization") ?? "")?.[1];
      const stored = channel.secrets.api_key_hash;
      return !!token && !!stored && same(createHash("sha256").update(token).digest("hex"), stored);
    },
    validate: (body) => {
      const parsed = message.safeParse(body);
      if (parsed.success) return null;
      const issue = parsed.error.issues[0]!;
      return `${issue.path.join(".") || "body"}: ${issue.message}`;
    },
    accepted: () => Response.json({ status: "accepted" }, { status: 202 }),
  });
}
