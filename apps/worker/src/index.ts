// Queue consumer. Claims jobs, runs them, and retries with backoff (dead-letter after max attempts).
// Queues: whatsapp_event (stored webhooks, M2.1/2.3) and media_download (customer media, M2.3).
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env";
import { processMediaDownload, processWhatsappEvent, type Ctx } from "./handlers";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
const env = loadEnv();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ctx: Ctx = { db, apiVersion: env.WHATSAPP_API_VERSION, log: (m) => console.log(m) };

const POLL_MS = 1000;
const BATCH = 20;
let running = true;

interface Job { id: number; queue: string; payload: Record<string, unknown>; attempts: number; max_attempts: number }

async function markEvent(id: number, outcome: "processed" | "ignored" | "failed", note: string) {
  const { error } = await db.from("webhook_events").update({ processed_at: new Date().toISOString(), outcome, note: note.slice(0, 2000) }).eq("id", id);
  if (error) throw new Error(`could not mark event ${id}: ${error.message}`);
}

const HANDLERS: Record<string, (job: Job) => Promise<void>> = {
  whatsapp_event: async (job) => {
    const id = Number(job.payload.event_id);
    const result = await processWhatsappEvent(ctx, id);
    await markEvent(id, result.outcome, result.note);
  },
  media_download: (job) =>
    processMediaDownload(ctx, job.payload as Parameters<typeof processMediaDownload>[1], job.attempts >= job.max_attempts),
};

async function tick(queue: string): Promise<number> {
  const { data: jobs, error } = await db.rpc("claim_jobs", { p_queue: queue, p_limit: BATCH, p_lease: "120 seconds" });
  if (error) throw new Error(`claim_jobs(${queue}): ${error.message}`);
  for (const job of (jobs ?? []) as Job[]) {
    try {
      await HANDLERS[queue]!(job);
      await db.rpc("complete_job", { p_id: job.id });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const { data: outcome } = await db.rpc("fail_job", { p_id: job.id, p_error: message });
      console.error(`${queue} job ${job.id} failed (${outcome}): ${message}`);
      if (outcome === "dead" && queue === "whatsapp_event") await markEvent(Number(job.payload.event_id), "failed", message).catch(() => {});
    }
  }
  return jobs?.length ?? 0;
}

async function main() {
  console.log(`worker started against ${new URL(env.SUPABASE_URL).host}`);
  while (running) {
    let busy = false;
    for (const queue of Object.keys(HANDLERS)) {
      try {
        if ((await tick(queue)) === BATCH) busy = true;
      } catch (e) {
        console.error(e instanceof Error ? e.message : e);
      }
    }
    if (!busy) await new Promise((r) => setTimeout(r, POLL_MS));
  }
  console.log("worker stopped");
}

const stop = () => { running = false; };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
void main();
