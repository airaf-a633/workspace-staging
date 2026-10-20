import "server-only";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/public-env";

/** The app's public address: the configured site URL, else the address this request came in on. */
export async function appOrigin() {
  const configured = publicEnv().siteUrl;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}
