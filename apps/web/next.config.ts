import path from "node:path";
import { config } from "dotenv";
import type { NextConfig } from "next";

// One .env at the repository root serves the web app, the worker and the Supabase CLI.
// Loaded here, before Next.js starts its workers, so every route sees the same values.
// (Next's own loadEnvConfig caches the app folder's env and would skip this file.)
// On Vercel the values come from the project's environment settings instead.
if (!process.env.VERCEL) config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  reactCompiler: true,
};

export default nextConfig;
