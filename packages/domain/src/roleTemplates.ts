import type { Scope } from "./conversationAccess";

/**
 * The permission catalogue and the built-in role templates, copied from
 * supabase/migrations/20260927000001_foundations.sql (the source of truth).
 * roleTemplates.test.ts fails if this copy drifts from the migration.
 *
 * Admin (supabase/migrations/20261007000001_admin_role.sql) holds exactly the owner's scopes, so it has no
 * column of its own: what an admin can't do is about owners themselves, enforced by the database.
 */

export const ROLE_TEMPLATES = [
  { key: "owner", name: "Owner" },
  { key: "admin", name: "Admin" },
  { key: "sales_manager", name: "Sales manager" },
  { key: "support_manager", name: "Support manager" },
  { key: "ops_manager", name: "Operations manager" },
  { key: "agent", name: "Agent" },
  { key: "viewer", name: "Viewer" },
] as const;
export type RoleTemplateKey = (typeof ROLE_TEMPLATES)[number]["key"];

export interface PermissionInfo {
  key: string;
  description: string;
  ownerOnly: boolean;
  /** Scope per template column: owner (and admin), sales, support, operations, agent, viewer. */
  scopes: readonly [Scope, Scope, Scope, Scope, Scope, Scope];
}

export const PERMISSIONS: readonly PermissionInfo[] = [
  { key: "conversations.view", description: "See conversations", ownerOnly: false, scopes: ["all", "team", "team", "team", "team", "team"] },
  { key: "conversations.reply", description: "Reply as holder", ownerOnly: false, scopes: ["all", "own", "own", "own", "own", "none"] },
  { key: "conversations.override", description: "Reply without taking over", ownerOnly: false, scopes: ["all", "team", "team", "none", "none", "none"] },
  { key: "conversations.claim", description: "Claim unassigned conversations", ownerOnly: false, scopes: ["all", "team", "team", "team", "team", "none"] },
  { key: "conversations.handover", description: "Hand over (note required)", ownerOnly: false, scopes: ["all", "team", "team", "own", "own", "none"] },
  { key: "conversations.collaborators", description: "Add collaborators", ownerOnly: false, scopes: ["all", "own", "own", "own", "own", "none"] },
  { key: "conversations.notes", description: "Write internal notes, mentions, staff chat", ownerOnly: false, scopes: ["all", "team", "team", "team", "team", "none"] },
  { key: "conversations.spam", description: "Mark spam and block numbers", ownerOnly: false, scopes: ["all", "team", "team", "none", "none", "none"] },
  { key: "conversations.resolve", description: "Resolve and reopen", ownerOnly: false, scopes: ["all", "team", "team", "own", "own", "none"] },
  { key: "contacts.view", description: "See contacts", ownerOnly: false, scopes: ["all", "all", "all", "all", "all", "team"] },
  { key: "contacts.edit", description: "Create and edit contacts", ownerOnly: false, scopes: ["all", "all", "all", "all", "own", "none"] },
  { key: "contacts.merge", description: "Merge contacts", ownerOnly: false, scopes: ["all", "all", "all", "none", "none", "none"] },
  { key: "contacts.erase", description: "Erase a contact (PDPL)", ownerOnly: true, scopes: ["all", "none", "none", "none", "none", "none"] },
  { key: "deals.view", description: "See deals and stages", ownerOnly: false, scopes: ["all", "all", "all", "all", "own", "none"] },
  { key: "deals.values", description: "See deal values and revenue", ownerOnly: false, scopes: ["all", "all", "none", "none", "own", "none"] },
  { key: "deals.edit", description: "Create and edit deals", ownerOnly: false, scopes: ["all", "all", "none", "none", "own", "none"] },
  { key: "deals.close", description: "Mark deals Won or Lost", ownerOnly: false, scopes: ["all", "all", "none", "none", "own", "none"] },
  { key: "deals.approve", description: "Approve discount requests", ownerOnly: false, scopes: ["all", "team", "none", "none", "none", "none"] },
  { key: "tasks.manage", description: "Create and edit tasks", ownerOnly: false, scopes: ["all", "team", "team", "all", "own", "none"] },
  { key: "crm.settings", description: "Manage pipelines, fields, tags", ownerOnly: false, scopes: ["all", "team", "none", "none", "none", "none"] },
  { key: "templates.manage", description: "Create and submit templates", ownerOnly: false, scopes: ["all", "team", "team", "none", "none", "none"] },
  { key: "templates.send", description: "Send templates in chats", ownerOnly: false, scopes: ["all", "team", "team", "team", "own", "none"] },
  { key: "campaigns.manage", description: "Create campaigns", ownerOnly: false, scopes: ["all", "team", "none", "none", "none", "none"] },
  { key: "campaigns.send_segments", description: "Send campaigns to segments", ownerOnly: false, scopes: ["all", "team", "none", "none", "none", "none"] },
  { key: "campaigns.request_imported", description: "Request a campaign to an imported list", ownerOnly: false, scopes: ["all", "team", "none", "none", "none", "none"] },
  { key: "campaigns.send_imported", description: "Approve and send to imported lists", ownerOnly: true, scopes: ["all", "none", "none", "none", "none", "none"] },
  { key: "automations.manage", description: "Manage automations", ownerOnly: false, scopes: ["all", "team", "team", "team", "none", "none"] },
  { key: "canned.manage", description: "Manage canned replies", ownerOnly: false, scopes: ["all", "team", "team", "team", "none", "none"] },
  { key: "canned.use", description: "Use canned replies", ownerOnly: false, scopes: ["all", "team", "team", "team", "team", "none"] },
  { key: "reports.view", description: "See reports", ownerOnly: false, scopes: ["all", "team", "team", "team", "none", "team"] },
  { key: "reports.export", description: "Export a report", ownerOnly: false, scopes: ["all", "team", "team", "team", "none", "none"] },
  { key: "data.bulk_export", description: "Bulk export contacts and chats", ownerOnly: true, scopes: ["all", "none", "none", "none", "none", "none"] },
  { key: "members.manage", description: "Invite, remove, change roles", ownerOnly: true, scopes: ["all", "none", "none", "none", "none", "none"] },
  { key: "teams.manage", description: "Teams, hours, routing rules", ownerOnly: false, scopes: ["all", "team", "team", "team", "none", "none"] },
  { key: "numbers.manage", description: "Connect WhatsApp numbers, Meta billing", ownerOnly: true, scopes: ["all", "none", "none", "none", "none", "none"] },
  { key: "connections.own", description: "Connect own mailbox and calendar", ownerOnly: false, scopes: ["all", "own", "own", "own", "own", "none"] },
  { key: "billing.manage", description: "Billing and plan", ownerOnly: true, scopes: ["all", "none", "none", "none", "none", "none"] },
  { key: "api.manage", description: "API keys", ownerOnly: true, scopes: ["all", "none", "none", "none", "none", "none"] },
  { key: "audit.read", description: "Read the audit log", ownerOnly: true, scopes: ["all", "none", "none", "none", "none", "none"] },
  { key: "orders.dispatch", description: "Dispatch, riders and cash (Orders pack)", ownerOnly: false, scopes: ["all", "none", "none", "all", "none", "none"] },
  { key: "orders.create", description: "Create orders from chat (Orders pack)", ownerOnly: false, scopes: ["all", "none", "none", "all", "own", "none"] },
];

const COLUMN: Record<RoleTemplateKey, number> = { owner: 0, admin: 0, sales_manager: 1, support_manager: 2, ops_manager: 3, agent: 4, viewer: 5 };

/** One permission's scope for one template. */
export function scopeFor(p: PermissionInfo, template: RoleTemplateKey): Scope {
  return p.scopes[COLUMN[template]] ?? "none";
}

export function templateScopes(template: RoleTemplateKey): Record<string, Scope> {
  return Object.fromEntries(PERMISSIONS.map((p) => [p.key, scopeFor(p, template)]));
}
