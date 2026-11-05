import { describe, expect, it } from "vitest";
import {
  canSeeDealValue,
  conversationActions,
  handoffNoteError,
  replyAccess,
  windowOpen,
  templateScopes,
  type RoleTemplateKey,
  type Viewer,
} from "./index";

function viewer(id: string, role: RoleTemplateKey, teamIds: string[]): Viewer {
  return { memberId: id, teamIds, scopes: templateScopes(role) };
}

// Qamar: Khalid owner (General); Sara sales + Hana agent (Deira); Omar support + Aisha viewer (Mall); Priya ops (both).
const khalid = viewer("khalid", "owner", ["general"]);
const sara = viewer("sara", "sales_manager", ["deira"]);
const omar = viewer("omar", "support_manager", ["mall"]);
const priya = viewer("priya", "ops_manager", ["deira", "mall"]);
const hana = viewer("hana", "agent", ["deira"]);
const aisha = viewer("aisha", "viewer", ["mall"]);

const mariam = { teamId: "deira", holderId: "priya" }; // handed Hana -> Sara -> Priya
const rahul = { teamId: "mall", holderId: null }; // unassigned

describe("reply access", () => {
  it("gives the holder the reply box", () => {
    expect(replyAccess(priya, mariam)).toBe("holder");
  });

  it("lets the owner and same-team managers reply without taking over", () => {
    expect(replyAccess(khalid, mariam)).toBe("override");
    expect(replyAccess(sara, mariam)).toBe("override");
  });

  it("keeps earlier handlers as read-only followers", () => {
    expect(replyAccess(hana, mariam)).toBe("follower");
  });

  it("hides other teams' chats from team-scoped roles", () => {
    expect(replyAccess(omar, mariam)).toBe("hidden");
    expect(replyAccess(aisha, mariam)).toBe("hidden");
  });

  it("offers claim on unassigned chats in the viewer's teams only", () => {
    expect(replyAccess(omar, rahul)).toBe("claim");
    expect(replyAccess(priya, rahul)).toBe("claim");
    expect(replyAccess(khalid, rahul)).toBe("claim");
    expect(replyAccess(sara, rahul)).toBe("hidden");
    expect(replyAccess(aisha, rahul)).toBe("follower"); // viewer: sees, can't claim
  });

  it("lets a collaborator reply", () => {
    expect(replyAccess(hana, { ...mariam, collaboratorIds: ["hana"] })).toBe("collaborator");
  });

  it("never gives a reply-less role the reply box, even as holder", () => {
    expect(replyAccess(aisha, { teamId: "mall", holderId: "aisha" })).toBe("follower");
  });
});

describe("conversation actions", () => {
  it("lets an agent hand over and resolve only what they hold", () => {
    expect(conversationActions(hana, mariam).canHandOver).toBe(false);
    expect(conversationActions(hana, { teamId: "deira", holderId: "hana" }).canHandOver).toBe(true);
    expect(conversationActions(hana, mariam).canResolve).toBe(false);
  });

  it("limits spam marking to managers and the owner", () => {
    expect(conversationActions(priya, mariam).canMarkSpam).toBe(false);
    expect(conversationActions(sara, mariam).canMarkSpam).toBe(true);
  });

  it("lets followers who can reply ask to collaborate, but not viewers", () => {
    expect(conversationActions(hana, mariam).canAskToCollaborate).toBe(true);
    expect(conversationActions(aisha, { teamId: "mall", holderId: "omar" }).canAskToCollaborate).toBe(false);
  });

  it("gives nothing on hidden chats", () => {
    const a = conversationActions(omar, mariam);
    expect([a.canHandOver, a.canResolve, a.canMarkSpam, a.canWriteNotes]).toEqual([false, false, false, false]);
  });
});

describe("deal values", () => {
  it("shows money to the owner and sales, and to agents on their own deals", () => {
    expect(canSeeDealValue(khalid, "sara")).toBe(true);
    expect(canSeeDealValue(sara, "hana")).toBe(true);
    expect(canSeeDealValue(hana, "hana")).toBe(true);
    expect(canSeeDealValue(hana, "sara")).toBe(false);
    expect(canSeeDealValue(omar, "sara")).toBe(false);
    expect(canSeeDealValue(priya, "sara")).toBe(false);
  });
});

describe("handoff note and service window", () => {
  it("requires at least 10 characters, ignoring spaces at the ends", () => {
    expect(handoffNoteError("   call her  ")).not.toBeNull();
    expect(handoffNoteError("Call her before 5")).toBeNull();
  });

  it("closes the window 24 hours after the customer's last message", () => {
    const now = Date.UTC(2026, 8, 29, 12);
    expect(windowOpen(now - 23 * 3600_000, now)).toBe(true);
    expect(windowOpen(now - 24 * 3600_000, now)).toBe(false);
    expect(windowOpen(null, now)).toBe(false);
  });
});
