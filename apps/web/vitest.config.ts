import { defineConfig } from "vitest/config";

// Unit tests live next to the code (src/**/*.test.ts). The browser tests in e2e/ belong to Playwright.
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
