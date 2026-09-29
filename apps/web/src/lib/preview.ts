import { notFound } from "next/navigation";
import { ROLE_TEMPLATES, templateScopes, type RoleTemplateKey, type Scope } from "@app/domain";
import { buildSampleInbox } from "@/components/inbox/sample-data";
import { buildCustomers } from "@/components/customers/sample";
import { buildDeals } from "@/components/deals/sample";

/**
 * The made-up Qamar Electronics workspace behind /preview (public, no login, no database).
 * Same people, teams and role templates as supabase/seed.sql, so the preview behaves like
 * signing in as each seed user. Nothing here is saved.
 */

export const PREVIEW_WORKSPACE = { name: "Qamar Electronics" };

export const PREVIEW_TEAMS = [
  { id: "t-general", name: "General", isDefault: true, isBranch: false },
  { id: "t-deira", name: "Deira shop", isDefault: false, isBranch: true },
  { id: "t-mall", name: "Dubai Mall shop", isDefault: false, isBranch: true },
];

export const PREVIEW_PEOPLE = [
  { key: "khalid", name: "Khalid", template: "owner", teams: ["t-general"], sees: "The whole business: money, every team, every chat." },
  { key: "sara", name: "Sara", template: "sales_manager", teams: ["t-deira"], sees: "Pipeline and deals. Replies in her team without taking over." },
  { key: "omar", name: "Omar", template: "support_manager", teams: ["t-mall"], sees: "Who's waiting and reply times at the mall. No deal values." },
  { key: "priya", name: "Priya", template: "ops_manager", teams: ["t-deira", "t-mall"], sees: "Today's tasks and orders in both shops. Holds Mariam's chat." },
  { key: "hana", name: "Hana", template: "agent", teams: ["t-deira"], sees: "Her own chats and deals. Follows chats she handed over." },
  { key: "aisha", name: "Aisha", template: "viewer", teams: ["t-mall"], sees: "Reads the mall's chats and reports. Can't reply." },
] as const satisfies readonly { key: string; name: string; template: RoleTemplateKey; teams: string[]; sees: string }[];

export type PreviewKey = (typeof PREVIEW_PEOPLE)[number]["key"];

const roleName = (t: RoleTemplateKey) => ROLE_TEMPLATES.find((r) => r.key === t)!.name;

export function previewMembers() {
  return PREVIEW_PEOPLE.map((p) => {
    const scopes = templateScopes(p.template);
    return { id: `m-${p.key}`, key: p.key, name: p.name, role: roleName(p.template), template: p.template, teams: [...p.teams] as string[], scopes, canReply: scopes["conversations.reply"] !== "none" };
  });
}

/** The person the preview is "viewing as", or a 404 for an unknown name. */
export function previewPerson(key: string) {
  const m = previewMembers().find((x) => x.key === key);
  if (!m) notFound();
  return m;
}

export function previewScope(key: string, permission: string): Scope {
  return (previewPerson(key).scopes[permission] ?? "none") as Scope;
}

export function previewInbox(key: string) {
  const me = previewPerson(key);
  return buildSampleInbox(
    previewMembers(),
    PREVIEW_TEAMS.map(({ id, name, isDefault }) => ({ id, name, isDefault })),
    { memberId: me.id, teamIds: me.teams, scopes: me.scopes },
  );
}

/** Customers the viewer may see (contacts.view: the viewer role sees its own teams only). */
export function previewCustomers(key: string) {
  const me = previewPerson(key);
  const data = previewInbox(key);
  const scope = me.scopes["contacts.view"] ?? "none";
  const all = buildCustomers(data);
  const customers = scope === "all" ? all : scope === "team" ? all.filter((c) => me.teams.includes(c.teamId)) : [];
  return { data, customers };
}

/** The preview's clock, per request. */
export function previewNow() {
  return Date.now();
}

/** Every sample deal; the board filters by the viewer's deals.view scope itself. */
export function previewDeals(key: string) {
  const data = previewInbox(key);
  return { data, deals: buildDeals(data, buildCustomers(data)) };
}
