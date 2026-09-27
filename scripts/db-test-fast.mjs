// Fast database tests without Docker: runs migrations + pgTAP in PGlite with a minimal
// stand-in for Supabase's auth schema. CI still runs the real Supabase stack (`pnpm db:test`).
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pgtap } from '@electric-sql/pglite/pgtap';
import fs from 'fs';
import { fileURLToPath } from 'url';
const repo = fileURLToPath(new URL('../supabase', import.meta.url));
const db = new PGlite({ extensions: { pgcrypto, pgtap } });
// Minimal stand-in for what Supabase provides
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema extensions; create extension pgcrypto schema extensions; create extension pgtap;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth, extensions, public to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
  grant execute on all functions in schema extensions to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
for (const f of fs.readdirSync(repo + '/migrations').sort()) {
  await db.exec(fs.readFileSync(`${repo}/migrations/${f}`, 'utf8'));
  console.log('migration ok:', f);
}
for (const f of fs.readdirSync(repo + '/tests').sort()) {
  const sql = fs.readFileSync(`${repo}/tests/${f}`, 'utf8');
  try {
    const res = await db.exec(sql);
    const lines = res.flatMap(r => r.rows.map(row => Object.values(row)[0])).filter(v => typeof v === 'string');
    const fails = lines.filter(l => /^not ok/m.test(l));
    console.log(`\n== ${f}\n` + lines.join('\n'));
    console.log(fails.length ? `FAILED: ${fails.length}` : 'ALL PASSED'); if (fails.length) process.exitCode = 1;
  } catch (e) { console.log(`\n== ${f} ERROR: ${e.message}`); await db.exec('rollback').catch(() => {}); }
}
