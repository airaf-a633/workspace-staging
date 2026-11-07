// Checks supabase/ops/purge_seed_data.sql: after the migrations and the seed, running it leaves no seed account or business, the guards
// switched back on, and every real-looking account and business untouched. Runs in PGlite (no Docker).
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
  create schema vault;
  create table vault.secrets (id uuid primary key default gen_random_uuid(), name text, description text, secret text);
  create view vault.decrypted_secrets as select id, name, description, secret, secret as decrypted_secret from vault.secrets;
  create function vault.create_secret(new_secret text, new_name text default null, new_description text default '') returns uuid
    language sql as $$ insert into vault.secrets (name, description, secret) values (new_name, new_description, new_secret) returning id $$;
  create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text unique, encrypted_password text,
    email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
    confirmation_token text, recovery_token text, email_change text, email_change_token_new text);
  create table auth.identities (id uuid primary key, user_id uuid references auth.users, provider_id text, provider text,
    identity_data jsonb, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
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
await db.exec(fs.readFileSync(`${repo}/seed.sql`, 'utf8'));
console.log('seed ok');

// One statement block: the sign-in claim only lasts within a transaction.
await db.exec(`
  insert into auth.users (id, email) values ('20000000-0000-0000-0000-000000000001', 'owner@realpilot.example');
  select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  select public.create_workspace('Real Pilot Co', 'real-pilot', 'Real Owner');
`);
const before = await db.query(`select (select count(*) from auth.users) as users, (select count(*) from public.workspaces) as workspaces`);
console.log('before purge', JSON.stringify(before.rows[0]));
await db.exec(fs.readFileSync('D:/WORKK/AbdulWA/supabase/ops/purge_seed_data.sql', 'utf8'));
const after = await db.query(`
  select (select count(*) from auth.users) as users, (select count(*) from public.workspaces) as workspaces,
         (select count(*) from auth.users where email like '%.test') as seed_users,
         (select count(*) from public.workspaces where slug in ('qamar','noor')) as seed_workspaces,
         (select count(*) from public.members) as members,
         (select count(*) from pg_trigger where tgname in ('members_last_owner','members_owner_changes','audit_log_append_only','audit_members','audit_roles','audit_role_permissions','audit_team_members','audit_invites') and tgenabled = 'O') as guards_on,
         (select count(*) from public.workspaces where slug = 'real-pilot') as real_workspace`);
const a = after.rows[0];
console.log('after purge ', JSON.stringify(a));
const ok = Number(a.seed_users) === 0 && Number(a.seed_workspaces) === 0 && Number(a.guards_on) === 8 && Number(a.real_workspace) === 1 && Number(a.users) === 1 && Number(a.workspaces) === 1;
console.log(ok ? 'PURGE OK: seed gone, real pilot untouched, guards back on' : 'PURGE FAILED');
process.exitCode = ok ? 0 : 1;
