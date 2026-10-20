// Reads the permission catalogue and role templates from the foundations migration.
// Shared by the generator below and by roleTemplates.test.ts (drift check).
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MIGRATION = fileURLToPath(new URL("../../../supabase/migrations/20260927000001_foundations.sql", import.meta.url));

const MIGRATIONS = fileURLToPath(new URL("../../../supabase/migrations/", import.meta.url));
const ORDER = ["owner", "sales_manager", "support_manager", "ops_manager", "agent", "viewer"];

/**
 * Later migrations may change a template's scope with
 *   update public.role_template_permissions set scope = 'all' where template_key = 'agent' and permission = 'contacts.edit';
 * Those are applied in file order, so this copy follows the database as it is today.
 */
function laterChanges(scopes) {
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) {
    if (f === "20260927000001_foundations.sql") continue;
    const sql = readFileSync(MIGRATIONS + f, "utf8");
    for (const m of sql.matchAll(/update public\.role_template_permissions set scope = '([a-z]+)' where template_key = '([a-z_]+)' and permission = '([a-z_.]+)'/g)) {
      const col = ORDER.indexOf(m[2]);
      if (col >= 0 && scopes[m[3]]) scopes[m[3]][col] = m[1];
    }
  }
  return scopes;
}

export function parseMigration(sql = readFileSync(MIGRATION, "utf8")) {
  const catalogue = sql.slice(sql.indexOf("insert into public.permissions"), sql.indexOf("-- Columns: owner"));
  const templates = sql.slice(sql.indexOf("insert into public.role_template_permissions"), sql.indexOf(") as m(permission, scopes)"));
  const perms = [...catalogue.matchAll(/\('([a-z_.]+)',\s+'([^']+)',\s+(true|false)\)/g)].map((m) => ({ key: m[1], description: m[2], ownerOnly: m[3] === "true" }));
  const scopes = Object.fromEntries([...templates.matchAll(/\('([a-z_.]+)',\s+array\[([^\]]+)\]\)/g)].map((m) => [m[1], m[2].replace(/'/g, "").split(",").map((s) => s.trim())]));
  laterChanges(scopes);
  return perms.map((p) => ({ ...p, scopes: scopes[p.key] }));
}
