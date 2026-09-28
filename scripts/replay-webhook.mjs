// Re-queue stored webhook events for the worker: `pnpm webhook:replay <event_id> [more ids]`.
// Safe to repeat: processing is idempotent (messages are deduplicated by WhatsApp message ID).
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const ids = process.argv.slice(2).map(Number).filter(Number.isInteger);
if (!ids.length) {
  console.error('Usage: pnpm webhook:replay <event_id> [event_id ...]');
  process.exit(1);
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
for (const id of ids) {
  const { data, error } = await db.rpc('replay_webhook', { p_event_id: id });
  console.log(error ? `event ${id}: ${error.message}` : data ? `event ${id}: queued as job ${data}` : `event ${id}: not found or unsigned`);
}
