// The Discord Gateway process: keeps one connection online for every connected Discord bot and queues their
// messages for the normal worker. Run exactly one copy, always on (not serverless): Discord delivers messages only
// over a connection that stays open. See src/gateway/supervisor.ts.
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./env";
import type { SocketLike } from "./gateway/connection";
import { Supervisor } from "./gateway/supervisor";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
const env = loadEnv();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const supervisor = new Supervisor({
  db,
  fetch,
  socket: (url) => new WebSocket(url) as unknown as SocketLike,
  log: (m) => console.log(m),
  appUrl: env.APP_URL,
});

console.log(`gateway started against ${new URL(env.SUPABASE_URL).host}`);
supervisor.start();

const stop = () => {
  supervisor.stop();
  console.log("gateway stopped");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
