import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";

/**
 * Website chat, server side (decided 2026-10-19). The widget is public: it proves nothing but its key and the
 * visitor's own random secret. The secret travels in a header (never the URL) and only its SHA-256 fingerprint
 * reaches the database, through the service-role functions webchat_config / webchat_send / webchat_thread.
 */

export const KEY = /^[0-9a-f]{32}$/;
const SECRET = /^[A-Za-z0-9_-]{32,128}$/;
export const VISITOR_HEADER = "x-relay-visitor";

/** The visitor's fingerprint, or null when the header is missing or malformed. */
export function visitorFrom(request: Request): string | null {
  const secret = request.headers.get(VISITOR_HEADER) ?? "";
  return SECRET.test(secret) ? createHash("sha256").update(secret).digest("hex") : null;
}

export const outgoing = z.object({
  clientId: z.string().regex(/^[0-9a-zA-Z-]{8,64}$/),
  body: z.string().trim().min(1).max(4000),
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().max(320).optional(),
});

/** What the widget may show: its look, the business name, and whether it's switched on. */
export interface WidgetConfig {
  business: string;
  name: string;
  live: boolean;
  color: string;
  greeting: string;
  position: "left" | "right";
}

export function toConfig(row: { business: string; channel_name: string; settings: Record<string, unknown>; live: boolean }): WidgetConfig {
  const s = row.settings ?? {};
  const color = typeof s.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(s.color) ? s.color : "#006ACC";
  return {
    business: row.business,
    name: row.channel_name,
    live: row.live,
    color,
    greeting: typeof s.greeting === "string" ? s.greeting.slice(0, 280) : "",
    position: s.position === "left" ? "left" : "right",
  };
}

/** Database refusals → HTTP statuses the widget understands. */
export function statusFor(message: string) {
  if (message.includes("unknown_widget")) return 404;
  if (message.includes("rate_limited")) return 429;
  if (/bad_visitor|bad_client_id|empty|too_long|bad_email/.test(message)) return 400;
  return 500;
}

/** Same-origin JSON with no caching: every answer is per visitor. */
export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
