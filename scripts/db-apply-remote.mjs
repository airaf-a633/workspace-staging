// Applies the migrations a hosted database (staging) does not have yet, through a direct connection, and records each one in
// supabase_migrations.schema_migrations the way the Supabase CLI does. Needs SUPABASE_DB_URL in .env (Session pooler string).
//
//   node scripts/db-apply-remote.mjs                      lists what is missing; changes nothing
//   node scripts/db-apply-remote.mjs --from 20261019      treats everything before that version as already applied
//   node scripts/db-apply-remote.mjs --yes                applies what is missing, oldest first, each file in its own transaction
//
// Why --from: staging was set up before migrations were recorded this way, so its history table may be empty or incomplete.
// Read the list first. A file that fails stops the run and leaves that file unapplied (its transaction rolls back).
import 'dotenv/config';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Set SUPABASE_DB_URL in .env (Supabase dashboard > Connect > Session pooler).');
  process.exit(1);
}
const args = process.argv.slice(2);
const yes = args.includes('--yes');
const fromArg = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;
const dir = fileURLToPath(new URL('../supabase/migrations', import.meta.url));
const files = fs.readdirSync(dir).filter((n) => n.endsWith('.sql')).sort();

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
// The dry run only reads. The history table is created on --yes, if the database does not have it.
const hasTable = (await client.query("select to_regclass('supabase_migrations.schema_migrations') as t")).rows[0].t !== null;
const recorded = new Set(hasTable ? (await client.query('select version from supabase_migrations.schema_migrations')).rows.map((r) => r.version) : []);

const versionOf = (f) => f.split('_')[0];
const missing = files.filter((f) => !recorded.has(versionOf(f)) && (!fromArg || versionOf(f) >= fromArg));
console.log(`${files.length} migration files, ${recorded.size} recorded as applied${fromArg ? `, ignoring versions before ${fromArg}` : ''}.`);
console.log(missing.length ? `Not applied yet (${missing.length}):\n  ${missing.join('\n  ')}` : 'Nothing to apply.');
if (!yes || missing.length === 0) {
  if (missing.length) console.log('\nThis was a dry run. Check the list, then run again with --yes (and --from if the list includes migrations the database already has).');
  await client.end();
  process.exit(0);
}

await client.query('create schema if not exists supabase_migrations');
await client.query('create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text)');
for (const f of missing) {
  const sql = fs.readFileSync(`${dir}/${f}`, 'utf8');
  try {
    await client.query('begin');
    await client.query(sql);
    await client.query('insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)', [versionOf(f), [sql], f.replace(/^\d+_/, '').replace(/\.sql$/, '')]);
    await client.query('commit');
    console.log('applied', f);
  } catch (e) {
    await client.query('rollback').catch(() => {});
    console.error(`FAILED ${f}: ${e.message}\nStopped. Nothing after this file was applied.`);
    await client.end();
    process.exit(1);
  }
}
await client.end();
console.log('Done. Next: pnpm db:test:staging');
