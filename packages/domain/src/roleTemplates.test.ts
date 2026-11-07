import { describe, expect, it } from "vitest";
// @ts-expect-error: plain .mjs helper shared with the generator, no types needed
import { parseMigration } from "../scripts/parse-role-templates.mjs";
import { PERMISSIONS } from "./index";

describe("role templates", () => {
  it("match the migrations exactly (foundations plus later template changes)", () => {
    const fromSql = parseMigration();
    expect(PERMISSIONS.map((p) => ({ ...p, scopes: [...p.scopes] }))).toEqual(fromSql);
  });
});
