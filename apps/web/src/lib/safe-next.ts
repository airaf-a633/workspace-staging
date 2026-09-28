/** Only allow redirects to paths on this site, never to another domain. */
export function safeNext(value: FormDataEntryValue | string | null | undefined, fallback = "/app"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
