import { describe, expect, it } from "vitest";
import { setupSteps } from "./setup";

// Translators that return the key, so the test checks which step is which, not the wording.
const t = ((key: string) => key) as never;
const common = ((key: string) => key) as never;

describe("the setup checklist", () => {
  it("links website chat, contact import and reply targets in a real workspace, and keeps Try AI as coming soon", () => {
    const steps = setupSteps(t, common, { shape: "small", memberCount: 1, connected: false, base: "/w/acme" });
    const by = (title: string) => steps.find((s) => s.title === title)!;
    expect(by("connect.title").href).toBe("/w/acme/channels");
    expect(by("widget.title")).toMatchObject({ href: "/w/acme/channels/new/webchat", soon: null });
    expect(by("import.title")).toMatchObject({ href: "/w/acme/customers/import", soon: null });
    expect(by("targets.title")).toMatchObject({ href: "/w/acme/sla", soon: null });
    expect(by("ai.title")).toMatchObject({ href: null, soon: "comingSoon" });
  });

  it("ticks what the workspace has already done", () => {
    const steps = setupSteps(t, common, { shape: "small", memberCount: 3, connected: true, done: ["widget", "targets"], base: "/w/acme" });
    const done = Object.fromEntries(steps.map((s) => [s.title, s.done]));
    expect(done["connect.title"]).toBe(true);
    expect(done["widget.title"]).toBe(true);
    expect(done["targets.title"]).toBe(true);
    expect(done["import.title"]).toBe(false);
    expect(steps.find((s) => s.title.startsWith("invite"))!.done).toBe(true);
  });

  it("keeps every step linked in the preview, where all the screens exist", () => {
    const steps = setupSteps(t, common, { shape: null, memberCount: 1, connected: false, base: "/preview/elena" });
    expect(steps.every((s) => s.href !== null && s.soon === null)).toBe(true);
  });
});
