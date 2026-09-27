// Queue consumer entry point. M2 adds: webhook processing, outbound sends, media download.
import { businessDate } from "@app/domain";
import { loadEnv } from "./env";

const env = loadEnv();

const shutdown = () => {
  console.log("worker stopping");
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`worker started against ${new URL(env.SUPABASE_URL).host}, business date ${businessDate(new Date())}`);
