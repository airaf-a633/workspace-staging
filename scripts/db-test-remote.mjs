// Runs the pgTAP tests against a hosted database (staging) through a direct connection.
// Needs SUPABASE_DB_URL in .env (the Session pooler connection string, with your password).
// Every test file runs inside begin ... rollback, so it leaves no data behind.
import 'dotenv/config';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Set SUPABASE_DB_URL in .env (Supabase dashboard > Connect > Session pooler).');
  process.exit(1);
}
const dir = fileURLToPath(new URL('../supabase/tests', import.meta.url));
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query('create extension if not exists pgtap with schema extensions');
let failed = 0;
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
  try {
    const res = await client.query(`set search_path = public, extensions;\n${fs.readFileSync(`${dir}/${f}`, 'utf8')}`);
    const lines = [res].flat().flatMap((r) => r.rows ?? []).map((row) => Object.values(row)[0]).filter((v) => typeof v === 'string');
    const bad = lines.filter((l) => /^not ok|^# Looks like/m.test(l));
    failed += bad.length;
    console.log(`\n== ${f}\n${lines.join('\n')}\n${bad.length ? `FAILED: ${bad.length}` : 'ALL PASSED'}`);
  } catch (e) {
    failed++;
    console.log(`\n== ${f} ERROR: ${e.message}`);
    await client.query('rollback').catch(() => {});
  }
}
await client.end();
process.exitCode = failed ? 1 : 0;
