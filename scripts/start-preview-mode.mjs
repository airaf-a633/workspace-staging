// Serves the production build the way the hosted partner preview runs it (SITE_MODE=preview), on port 3100.
// Build first: `pnpm --filter @app/web build`. The password here is a local test value only;
// the hosted preview's real password is set in Vercel's environment settings, never in the repo.
import { spawn } from "node:child_process";

const env = {
  ...process.env,
  SITE_MODE: "preview",
  PREVIEW_PASSWORD: process.env.PREVIEW_PASSWORD || "local-preview-test",
  VERCEL: "1", // skip the root .env, like on Vercel
};
const child = spawn("pnpm", ["--filter", "@app/web", "exec", "next", "start", "-p", "3100"], { env, stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));
