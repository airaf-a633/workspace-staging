import { notFound } from "next/navigation";
import { ROLE_TEMPLATES, templateScopes, type RoleTemplateKey, type Scope } from "@app/domain";
import { buildSampleInbox } from "@/components/inbox/sample-data";
import { buildCustomers } from "@/components/customers/sample";
import { buildDeals } from "@/components/deals/sample";
import { buildTasks } from "@/components/tasks/sample";

/**
 * The made-up Northwind Home workspace behind /preview (public, no login, no database): a global online
 * brand with Sales and Support teams and thirteen connected channels (decided 2026-10-07). Nothing here is saved.
 */

export const PREVIEW_WORKSPACE = { name: "Northwind Home" };

export const PREVIEW_TEAMS = [
  { id: "t-general", name: "General", isDefault: true, isBranch: false },
  { id: "t-sales", name: "Sales", isDefault: false, isBranch: false },
  { id: "t-support", name: "Support", isDefault: false, isBranch: false },
];

/** What each person sees is described in the language files (preview.people.<key>). */
export const PREVIEW_PEOPLE = [
  { key: "elena", name: "Elena", template: "owner", teams: ["t-general"] },
  { key: "marcus", name: "Marcus", template: "sales_manager", teams: ["t-sales"] },
  { key: "priya", name: "Priya", template: "support_manager", teams: ["t-support"] },
  { key: "kenji", name: "Kenji", template: "ops_manager", teams: ["t-sales", "t-support"] },
  { key: "leo", name: "Leo", template: "agent", teams: ["t-sales", "t-support"] },
  { key: "amara", name: "Amara", template: "viewer", teams: ["t-support"] },
] as const satisfies readonly { key: string; name: string; template: RoleTemplateKey; teams: string[] }[];

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

/** Every sample task; the list filters by the viewer's tasks.manage scope itself. */
export function previewTasks(key: string) {
  const data = previewInbox(key);
  const customers = buildCustomers(data);
  return { data, tasks: buildTasks(data, customers), customers: previewCustomers(key).customers.map((c) => ({ id: c.id, name: c.name })) };
}
