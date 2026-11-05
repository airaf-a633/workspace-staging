import { describe, expect, it } from "vitest";
import x, { accessToken, explainXError, parseX } from "./x";
import type { Creds } from "./types";

const channel = { settings: { user_id: "900", client_id: "cid" } };
const dm = (over: Record<string, unknown> = {}) => ({ id: "1111", created_timestamp: "1800000000000", message_create: { target: { recipient_id: "900" }, sender_id: "U1", message_data: { text: "Hello", entities: {} } }, ...over });
const payload = (events: unknown[], users: Record<string, unknown> = { U1: { id: "U1", name: "Ana Ruiz", screen_name: "ana" } }) => ({ direct_message_events: events, users });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("reading an X direct message", () => {
  it("files text as one chat per person, named from the users map", () => {
    const [m] = parseX(payload([dm()]), channel);
    expect(m).toMatchObject({ kind: "x", address: "U1", display: "Ana Ruiz", externalId: "1111", type: "text", body: "Hello", threadKey: "", replyTo: null });
    expect(m!.sentAt.getTime()).toBe(1_800_000_000_000);
  });

  it("finds the events however deep X's envelope puts them", () => {
    expect(parseX({ data: { event_type: "dm.received", filter: { user_id: "900" }, payload: payload([dm()]) } }, channel)).toHaveLength(1);
    expect(parseX({ a: { b: { c: payload([dm({ id: "2" })]) } } }, channel)[0]!.externalId).toBe("2");
    expect(parseX([payload([dm()]), payload([dm({ id: "3" })])], channel)).toHaveLength(2);
  });

  it("falls back to the screen name, and to no name", () => {
    expect(parseX(payload([dm()], { U1: { screen_name: "ana" } }), channel)[0]!.display).toBe("ana");
    expect(parseX(payload([dm()], {}), channel)[0]!.display).toBeUndefined();
  });

  it("skips messages the account sent itself, and events without an id or sender", () => {
    const own = dm({ message_create: { sender_id: "900", message_data: { text: "mine" } } });
    expect(parseX(payload([own]), channel)).toEqual([]);
    expect(parseX(payload([dm({ id: undefined })]), channel)).toEqual([]);
    expect(parseX(payload([dm({ message_create: { message_data: { text: "x" } } })]), channel)).toEqual([]);
  });

  it("files a message with no words as unsupported so it isn't lost", () => {
    expect(parseX(payload([dm({ message_create: { sender_id: "U1", message_data: { entities: {} } } })]), channel)[0]).toMatchObject({ type: "unsupported", body: null });
  });

  it("skips junk", () => {
    expect(parseX(null, channel)).toEqual([]);
    expect(parseX({ direct_message_events: "no" }, channel)).toEqual([]);
  });
});

describe("the user access token", () => {
  const settings = { client_id: "cid" };
  const NOW = 1_800_000_000_000;
  const fresh = (): Creds => ({ client_secret: "sec", access_token: "a1", refresh_token: "r1", expires_at: String(NOW + 3600_000) });

  it("uses the saved token while it has more than two minutes left", async () => {
    let asked = 0;
    const f = (async () => { asked++; return json({}); }) as unknown as typeof fetch;
    expect(await accessToken(f, fresh(), settings, undefined, NOW)).toBe("a1");
    expect(asked).toBe(0);
  });

  it("renews it with the refresh token, Basic auth and no client id in the body, and saves the new pair", async () => {
    const creds: Creds = { ...fresh(), expires_at: String(NOW + 60_000) };
    const saved: Creds[] = [];
    let seen: { url: string; auth: string; body: URLSearchParams } | null = null;
    const f = (async (url: string, init: RequestInit) => { seen = { url, auth: (init.headers as Record<string, string>).authorization!, body: init.body as URLSearchParams }; return json({ access_token: "a2", refresh_token: "r2", expires_in: 7200 }); }) as unknown as typeof fetch;
    expect(await accessToken(f, creds, settings, async (s) => { saved.push(s); }, NOW)).toBe("a2");
    expect(seen!.url).toBe("https://api.x.com/2/oauth2/token");
    expect(seen!.auth).toBe(`Basic ${Buffer.from("cid:sec").toString("base64")}`);
    expect(Object.fromEntries(seen!.body)).toEqual({ grant_type: "refresh_token", refresh_token: "r1" });
    expect(saved).toEqual([{ access_token: "a2", refresh_token: "r2", expires_at: String(NOW + 7200_000) }]);
    expect(creds.access_token).toBe("a2");
  });

  it("keeps the old refresh token when X sends no new one", async () => {
    const saved: Creds[] = [];
    const f = (async () => json({ access_token: "a3", expires_in: 3600 })) as unknown as typeof fetch;
    await accessToken(f, { ...fresh(), expires_at: "0" }, settings, async (s) => { saved.push(s); }, NOW);
    expect(saved[0]).not.toHaveProperty("refresh_token");
  });

  it("asks the user to connect again when X refuses the refresh or there is no refresh token", async () => {
    const refuse = (async () => json({ error: "invalid_request", error_description: "Value passed for the token was invalid." }, 400)) as unknown as typeof fetch;
    await expect(accessToken(refuse, { ...fresh(), expires_at: "0" }, settings, undefined, NOW)).rejects.toMatchObject({ code: "bad_credentials", temporary: false, message: expect.stringContaining("connect the X account again") });
    await expect(accessToken(refuse, { client_secret: "s" }, settings, undefined, NOW)).rejects.toMatchObject({ code: "bad_credentials" });
  });

  it("retries when X is down or busy", async () => {
    const busy = (async () => json({}, 503)) as unknown as typeof fetch;
    await expect(accessToken(busy, { ...fresh(), expires_at: "0" }, settings, undefined, NOW)).rejects.toMatchObject({ temporary: true });
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    await expect(accessToken(down, { ...fresh(), expires_at: "0" }, settings, undefined, NOW)).rejects.toMatchObject({ temporary: true });
  });
});

describe("sending", () => {
  const req = (over: Record<string, unknown> = {}) => ({ messageId: "m", body: "On it!", to: "U1", threadKey: "", settings: { client_id: "cid", user_id: "900" }, lastInbound: null, lastInboundAt: null, ...over });
  const creds = (): Creds => ({ client_secret: "sec", access_token: "a1", refresh_token: "r1", expires_at: String(Date.now() + 3600_000) });

  it("posts the text to the person with the user token and returns the DM event id", async () => {
    let seen: { url: string; auth: string; body: Record<string, unknown> } | null = null;
    const f = (async (url: string, init: RequestInit) => { seen = { url, auth: (init.headers as Record<string, string>).authorization!, body: JSON.parse(String(init.body)) }; return json({ data: { dm_conversation_id: "c", dm_event_id: "999" } }, 201); }) as unknown as typeof fetch;
    expect(await x.send(f, creds(), req())).toEqual({ externalId: "999" });
    expect(seen).toEqual({ url: "https://api.x.com/2/dm_conversations/with/U1/messages", auth: "Bearer a1", body: { text: "On it!" } });
  });

  it("renews the token once and tries again after a 401", async () => {
    const calls: string[] = [];
    const saved: Creds[] = [];
    const f = (async (url: string, init: RequestInit) => {
      if (url.endsWith("/oauth2/token")) { calls.push("refresh"); return json({ access_token: "a2", refresh_token: "r2", expires_in: 7200 }); }
      const auth = (init.headers as Record<string, string>).authorization;
      calls.push(auth!);
      return auth === "Bearer a2" ? json({ data: { dm_event_id: "5" } }) : json({ title: "Unauthorized" }, 401);
    }) as unknown as typeof fetch;
    expect(await x.send(f, creds(), req({ saveSecrets: async (s: Creds) => { saved.push(s); } }))).toEqual({ externalId: "5" });
    expect(calls).toEqual(["Bearer a1", "refresh", "Bearer a2"]);
    expect(saved).toHaveLength(1);
  });

  it("explains X's refusals in plain words, passing on X's own", async () => {
    const refuse = (status: number, body: unknown = {}) => (async () => json(body, status)) as unknown as typeof fetch;
    await expect(x.send(refuse(403, { title: "Forbidden", detail: "You cannot send messages to this user." }), creds(), req())).rejects.toMatchObject({ code: "forbidden", message: expect.stringContaining("You cannot send messages to this user.") });
    await expect(x.send(refuse(429), creds(), req())).rejects.toMatchObject({ temporary: true, code: "rate_limited" });
    await expect(x.send(refuse(503), creds(), req())).rejects.toMatchObject({ temporary: true });
    await expect(x.send(refuse(402, { title: "CreditsDepleted" }), creds(), req())).rejects.toMatchObject({ code: "no_credits" });
    await expect(x.send(refuse(400, { title: "Invalid Request" }), creds(), req())).rejects.toMatchObject({ code: "http_400" });
  });

  it("cuts a message at 10,000 characters", async () => {
    let body!: { text: string };
    const f = (async (_u: string, init: RequestInit) => { body = JSON.parse(String(init.body)); return json({ data: { dm_event_id: "1" } }); }) as unknown as typeof fetch;
    await x.send(f, creds(), req({ body: "a".repeat(12_000) }));
    expect(body.text).toHaveLength(10_000);
  });

  it("retries when X can't be reached", async () => {
    await expect(x.send((async () => { throw new Error("offline"); }) as unknown as typeof fetch, creds(), req())).rejects.toMatchObject({ temporary: true });
  });

  it("says what X said for an error it doesn't know", () => {
    expect(explainXError(418, { title: "Teapot" })).toMatchObject({ code: "http_418", message: "X refused the message (418). X says: Teapot" });
  });
});
