// Queue consumer. M2.1: claims whatsapp_event jobs, validates and routes each stored webhook.
// Message handling itself (contacts, conversations, messages) is added in M2.3.
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { routeChanges, webhookEnvelope } from "@app/whatsapp";
import { loadEnv } from "./env";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
const env = loadEnv();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const POLL_MS = 1000;
const BATCH = 20;
let running = true;

interface Job { id: number; payload: { event_id: number }; attempts: number }

async function processWhatsappEvent(job: Job): Promise<void> {
  const { data: event, error } = await db.from("webhook_events").select("id, payload").eq("id", job.payload.event_id).single();
  if (error || !event) throw new Error(`event ${job.payload.event_id} not found: ${error?.message}`);

  const parsed = webhookEnvelope.safeParse(event.payload);
  if (!parsed.success) {
    await markEvent(event.id, "ignored", "Not a WhatsApp Business Account webhook");
    return;
  }
  const changes = routeChanges(parsed.data);
  const unknown = changes.filter((c) => !c.known).map((c) => c.field);
  // M2.3 adds a handler per field here. Until then, record what arrived.
  await markEvent(event.id, "processed", `fields: ${changes.map((c) => c.field).join(", ")}${unknown.length ? ` (unhandled: ${unknown.join(", ")})` : ""}`);
}

async function markEvent(id: number, outcome: "processed" | "ignored" | "failed", note: string) {
  const { error } = await db.from("webhook_events").update({ processed_at: new Date().toISOString(), outcome, note }).eq("id", id);
  if (error) throw new Error(`could not mark event ${id}: ${error.message}`);
}

async function tick(): Promise<number> {
  const { data: jobs, error } = await db.rpc("claim_jobs", { p_queue: "whatsapp_event", p_limit: BATCH, p_lease: "60 seconds" });
  if (error) throw new Error(`claim_jobs: ${error.message}`);
  for (const job of (jobs ?? []) as Job[]) {
    try {
      await processWhatsappEvent(job);
      await db.rpc("complete_job", { p_id: job.id });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const { data: outcome } = await db.rpc("fail_job", { p_id: job.id, p_error: message });
      console.error(`job ${job.id} failed (${outcome}): ${message}`);
    }
  }
  return jobs?.length ?? 0;
}

async function main() {
  console.log(`worker started against ${new URL(env.SUPABASE_URL).host}`);
  while (running) {
    try {
      const n = await tick();
      if (n === BATCH) continue; // more waiting: go again immediately
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  console.log("worker stopped");
}

const stop = () => { running = false; };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
void main();
