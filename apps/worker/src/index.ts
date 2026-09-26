// Queue consumer entry point. Phase 2 adds: webhook processing, outbound sends, media download.
import { businessDate } from "@orderdesk/domain";

const shutdown = () => {
  console.log("worker stopping");
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`worker started, business date ${businessDate(new Date())}`);
