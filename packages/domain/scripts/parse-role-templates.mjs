// Reads the permission catalogue and role templates from the foundations migration.
// Shared by the generator below and by roleTemplates.test.ts (drift check).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MIGRATION = fileURLToPath(new URL("../../../supabase/migrations/20260927000001_foundations.sql", import.meta.url));

export function parseMigration(sql = readFileSync(MIGRATION, "utf8")) {
  const catalogue = sql.slice(sql.indexOf("insert into public.permissions"), sql.indexOf("-- Columns: owner"));
  const templates = sql.slice(sql.indexOf("insert into public.role_template_permissions"), sql.indexOf(") as m(permission, scopes)"));
  const perms = [...catalogue.matchAll(/\('([a-z_.]+)',\s+'([^']+)',\s+(true|false)\)/g)].map((m) => ({ key: m[1], description: m[2], ownerOnly: m[3] === "true" }));
  const scopes = Object.fromEntries([...templates.matchAll(/\('([a-z_.]+)',\s+array\[([^\]]+)\]\)/g)].map((m) => [m[1], m[2].replace(/'/g, "").split(",").map((s) => s.trim())]));
  return perms.map((p) => ({ ...p, scopes: scopes[p.key] }));
}
