import "server-only";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/public-env";

/**
 * The app's public address: the configured NEXT_PUBLIC_SITE_URL. Sign-in emails, invitation links and channel webhooks are
 * built from it, so in production a missing value stops the request loudly instead of sending people links to localhost.
 * Only in development, with nothing configured, the address this request came in on is used.
 */
export async function appOrigin() {
  const configured = publicEnv().siteUrl;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("Set NEXT_PUBLIC_SITE_URL to the app's public address (for example https://app.example.com).");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const local = host.startsWith("localhost") || host.startsWith("127.");
  return `${h.get("x-forwarded-proto") ?? (local ? "http" : "https")}://${host}`;
}
