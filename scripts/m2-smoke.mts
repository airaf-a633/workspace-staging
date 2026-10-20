// End-to-end check of M2.3 receiving on staging, without Meta: a stand-in number, a webhook stored
// through record_webhook (as the route does), the worker's handler, then the results. Everything it
// creates is deleted at the end. Run: apps/worker/node_modules/.bin/tsx scripts/m2-smoke.mts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { processWhatsappEvent } from "../apps/worker/src/handlers.ts";

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const PHONE_ID = "999000111222";
const WABA = "999000333444";
const ok = (cond: unknown, label: string) => {
  console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) process.exitCode = 1;
};

const { data: ws } = await db.from("workspaces").select("id, slug").order("created_at").limit(1).single();
if (!ws) throw new Error("no workspace on staging");
const { data: team } = await db.from("teams").select("id").eq("workspace_id", ws.id).eq("is_default", true).single();
const { data: acc, error: accErr } = await db
  .from("whatsapp_accounts")
  .insert({ workspace_id: ws.id, waba_id: WABA, phone_number_id: PHONE_ID, display_phone: "+1 555 000 1112", is_test: true, team_id: team?.id })
  .select("id")
  .single();
if (accErr) throw new Error(accErr.message);

const ts = Math.floor(Date.now() / 1000);
const payload = (msgs: object[], statuses: object[] = []) => ({
  object: "whatsapp_business_account",
  entry: [{ id: WABA, changes: [{ field: "messages", value: {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: "15550001112", phone_number_id: PHONE_ID },
    contacts: [{ profile: { name: "Smoke Test" }, wa_id: "971500000001" }],
    messages: msgs,
    statuses,
  } }] }],
});
const ctx = { db, apiVersion: "v25.0", log: () => {} };
const run = async (p: object) => {
  const { data: id } = await db.rpc("record_webhook", { p_provider: "whatsapp", p_payload: p, p_signature_valid: true });
  await db.from("jobs").update({ status: "done" }).eq("queue", "whatsapp_event").contains("payload", { event_id: id }); // keep a running worker from taking it
  return processWhatsappEvent(ctx, id as number);
};

try {
  const first = { from: "971500000001", id: "wamid.SMOKE1", timestamp: String(ts), type: "text", text: { body: "Hello from the smoke test" } };
  const r1 = await run(payload([first]));
  ok(r1.note.includes("1 new"), `first webhook stored a message (${r1.note})`);
  const r2 = await run(payload([first]));
  ok(r2.note.includes("1 repeat"), "the same webhook again changes nothing");
  await run(payload([{ from: "971500000001", id: "wamid.SMOKE2", timestamp: String(ts + 1), type: "reaction", reaction: { message_id: "wamid.SMOKE1", emoji: "❤️" } }]));

  const { data: conv } = await db.from("conversations").select("id, unread_count, status, team_id").eq("whatsapp_account_id", acc!.id).single();
  ok(conv?.unread_count === 1 && conv.status === "open" && conv.team_id === team?.id, "one open conversation in the default team, 1 unread");
  const { data: msgs } = await db.from("messages").select("wamid, body, reaction").eq("conversation_id", conv!.id);
  ok(msgs?.length === 1 && msgs[0]!.reaction === "❤️", "the reaction attached to the message instead of a new bubble");
  const { data: contact } = await db.from("contacts").select("profile_name").eq("workspace_id", ws.id).eq("wa_id", "971500000001").single();
  ok(contact?.profile_name === "Smoke Test", "the contact took the WhatsApp profile name");

  const unknown = await run({ ...payload([first]), entry: [{ id: "1", changes: [{ field: "messages", value: { metadata: { phone_number_id: "123456789" }, messages: [first] } }] }] });
  ok(unknown.note.includes("unlinked number"), "a message for a number nobody connected is stored but never shown");
} finally {
  await db.from("whatsapp_accounts").delete().eq("id", acc!.id); // cascades to conversations and messages
  await db.from("contacts").delete().eq("workspace_id", ws.id).eq("wa_id", "971500000001");
  console.log("cleaned up");
}
