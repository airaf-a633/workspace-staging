import { ROLE_TEMPLATES } from "@app/domain";
import type { Translator } from "./translate";

/**
 * Names that come from data but are really interface words. A role still called by its template name
 * ("Sales manager") shows in the reader's language; a role the owner renamed shows as they typed it.
 */
export function roleLabel(t: Translator, name: string | null | undefined) {
  if (!name) return "";
  const tpl = ROLE_TEMPLATES.find((r) => r.name === name);
  return tpl ? t(`roles.${tpl.key}`) : name;
}

type ValueGroup = "language" | "customerType" | "source" | "orderState" | "orderSource" | "due" | "lostReason" | "calendar";

/** A stored word the app knows ("Delivered", "Walk-in"), or the word as written when it doesn't. */
export function valueLabel(t: Translator, group: ValueGroup, value: string | null | undefined) {
  if (!value) return "";
  const key = `values.${group}.${value}`;
  return t.has(key) ? t(key) : value;
}

/** "conversations.reply" → its description. */
export function permissionLabel(t: Translator, key: string) {
  return t.has(`permissions.${key}`) ? t(`permissions.${key}`) : key;
}

/**
 * A line of interface text kept as data (a timeline title, say) and worded when shown. A var given as
 * { t: "some.key" } is itself translated first, so people's own words (which may start with anything) never are:
 * { key: "timeline.messages", vars: { channel: { t: "timeline.channel.whatsapp" }, count: 3 } }.
 */
export interface Line {
  key: string;
  vars?: Record<string, string | number | { t: string }>;
}

export function lineText(t: Translator, line: Line) {
  const vars = Object.fromEntries(Object.entries(line.vars ?? {}).map(([k, v]) => [k, typeof v === "object" ? t(v.t) : v]));
  return t(line.key, vars);
}

/** An error code from a URL (?error=…) in the reader's language; unknown codes get a generic line. */
export function errorText(t: Translator, ns: string, code: unknown, vars?: Record<string, string | number>) {
  if (typeof code !== "string") return null;
  return t.has(`${ns}.errors.${code}`) ? t(`${ns}.errors.${code}`, vars) : t("auth.errors.generic");
}
