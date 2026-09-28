import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// One .env at the repository root serves the web app, the worker and the Supabase CLI.
loadEnvConfig(path.resolve(__dirname, "../.."));

const nextConfig: NextConfig = {
  reactCompiler: true,
};

export default nextConfig;
