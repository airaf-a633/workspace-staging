import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

describe("worker env", () => {
  it("accepts a complete environment and applies defaults", () => {
    const env = loadEnv({ SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "key" });
    expect(env.WHATSAPP_API_VERSION).toBe("v25.0");
  });

  it("names every missing variable", () => {
    expect(() => loadEnv({})).toThrow(/SUPABASE_URL.*SUPABASE_SERVICE_ROLE_KEY/);
  });
});
