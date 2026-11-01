import { beforeEach, describe, expect, it } from "vitest";
import teams, { botToken, explainTeamsError, forgetTokens, parseTeams, safeServiceUrl } from "./teams";
import type { ChannelRow } from "./types";

const settings = { app_id: "11111111-1111-1111-1111-111111111111", tenant_id: "72f988bf-86f1-41af-91ab-2d7cd011db47", greeting: "Hi, how can IT help?" };
const channel: ChannelRow = { id: "ch1", workspace_id: "w", type: "teams", settings };
const creds = { client_secret: "s3cret-value-123456" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const activity = (over: Record<string, unknown> = {}) => ({
  type: "message", id: "1485983408511", timestamp: "2026-11-02T10:00:00.000Z", serviceUrl: "https://smba.trafficmanager.net/emea/", channelId: "msteams",
  from: { id: "29:abc", name: "Megan Bowen", aadObjectId: "7faf8ab2-3d56-4244-b585-20c8a42ed2b8" },
  conversation: { conversationType: "personal", id: "a:17I0kl9", tenantId: settings.tenant_id },
  recipient: { id: "28:bot", name: "Help desk" }, text: "My laptop won't start", channelData: { tenant: { id: settings.tenant_id } }, ...over,
});

describe("reading a Teams message", () => {
  it("files a personal-chat message as a chat per conversation, keyed by the person in the directory", () => {
    const [m] = parseTeams(activity(), channel);
    expect(m).toMatchObject({
      kind: "teams", address: "7faf8ab2-3d56-4244-b585-20c8a42ed2b8", display: "Megan Bowen", externalId: "a:17I0kl9|1485983408511",
      type: "text", body: "My laptop won't start", threadKey: "a:17I0kl9",
      data: { conversation_id: "a:17I0kl9", service_url: "https://smba.trafficmanager.net/emea/", activity_id: "1485983408511" },
    });
    expect(m!.sentAt.toISOString()).toBe("2026-11-02T10:00:00.000Z");
  });

  it("gives two people who message in the same millisecond different message ids", () => {
    const a = parseTeams(activity(), channel)[0]!;
    const b = parseTeams(activity({ conversation: { conversationType: "personal", id: "a:OTHER" } }), channel)[0]!;
    expect(a.externalId).not.toBe(b.externalId);
  });

  it("falls back to the bot-scoped id when there is no directory id", () => {
    expect(parseTeams(activity({ from: { id: "29:abc", name: "Megan" } }), channel)[0]!.address).toBe("29:abc");
  });

  it("removes mention tags and tidies spaces", () => {
    expect(parseTeams(activity({ text: "<at>Help desk</at>   hello   there" }), channel)[0]!.body).toBe("hello there");
  });

  it("files a file with its download address, keeping the words as the caption", () => {
    const [m] = parseTeams(activity({ text: "Error log", attachments: [{ contentType: "application/vnd.microsoft.teams.file.download.info", name: "log.txt", contentUrl: "https://c.sharepoint.com/x", content: { downloadUrl: "https://download.link/x", uniqueId: "U1", fileType: "txt" } }, { contentType: "text/html", content: "<p>Error log</p>" }] }), channel);
    expect(m).toMatchObject({ type: "document", body: null, caption: "Error log" });
    expect(m!.media).toEqual([{ ref: { id: "U1", url: "https://download.link/x" }, filename: "log.txt" }]);
  });

  it("files something it can't download as an unsupported message, so it isn't silently lost", () => {
    const [m] = parseTeams(activity({ text: "", attachments: [{ contentType: "image/png", contentUrl: "https://x/y.png" }] }), channel);
    expect(m).toMatchObject({ type: "unsupported", body: null, data: { other_attachments: 1 } });
  });

  it.each([
    ["a channel message", { conversation: { conversationType: "channel", id: "19:x" } }],
    ["a group chat", { conversation: { conversationType: "groupChat", id: "19:x" } }],
    ["another company's tenant", { channelData: { tenant: { id: "00000000-0000-0000-0000-000000000000" } } }],
    ["the bot itself", { from: { id: "28:bot", role: "bot" } }],
    ["a typing notice", { type: "typing" }],
    ["an empty message", { text: "" }],
    ["no service address", { serviceUrl: undefined }],
    ["a plain http service address", { serviceUrl: "http://smba.trafficmanager.net/emea/" }],
  ])("skips %s", (_n, over) => {
    expect(parseTeams(activity(over), channel)).toEqual([]);
  });

  it("compares tenants without caring about case", () => {
    expect(parseTeams(activity({ channelData: { tenant: { id: settings.tenant_id.toUpperCase() } } }), channel)).toHaveLength(1);
  });

  it("skips junk", () => {
    expect(parseTeams(null, channel)).toEqual([]);
  });
});

describe("the service address", () => {
  it("accepts https and adds the trailing slash", () => {
    expect(safeServiceUrl("https://smba.trafficmanager.net/emea")).toBe("https://smba.trafficmanager.net/emea/");
    expect(safeServiceUrl("http://x.example/")).toBeUndefined();
    expect(safeServiceUrl("not a url")).toBeUndefined();
    expect(safeServiceUrl(undefined)).toBeUndefined();
  });
});

describe("the bot's token", () => {
  beforeEach(() => forgetTokens());

  it("asks the company's own tenant with client credentials and the Bot Framework scope, and keeps the token", async () => {
    const calls: { url: string; body: URLSearchParams }[] = [];
    const f = (async (url: string, init: RequestInit) => { calls.push({ url, body: init.body as URLSearchParams }); return json({ access_token: "tok-1", expires_in: 3600 }); }) as unknown as typeof fetch;
    expect(await botToken(f, creds, settings, 1_000)).toBe("tok-1");
    expect(await botToken(f, creds, settings, 2_000)).toBe("tok-1");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`https://login.microsoftonline.com/${settings.tenant_id}/oauth2/v2.0/token`);
    expect(Object.fromEntries(calls[0]!.body)).toEqual({ grant_type: "client_credentials", client_id: settings.app_id, client_secret: creds.client_secret, scope: "https://api.botframework.com/.default" });
    await botToken(f, creds, settings, 1_000 + 3600 * 1000);
    expect(calls).toHaveLength(2);
  });

  it("explains a refused secret with Microsoft's own first line, and retries an outage", async () => {
    const refuse = (async () => json({ error: "invalid_client", error_description: "AADSTS7000222: The provided client secret keys are expired.\r\nTrace ID: x" }, 401)) as unknown as typeof fetch;
    await expect(botToken(refuse, creds, settings)).rejects.toMatchObject({ code: "bad_credentials", temporary: false, message: expect.stringContaining("AADSTS7000222") });
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    await expect(botToken(down, creds, settings)).rejects.toMatchObject({ temporary: true });
    const broken = (async () => json({}, 503)) as unknown as typeof fetch;
    await expect(botToken(broken, creds, settings)).rejects.toMatchObject({ temporary: true });
  });
});

describe("sending", () => {
  beforeEach(() => forgetTokens());
  const req = (over: Record<string, unknown> = {}) => ({ messageId: "m1", body: "Try holding the power button.", to: "7faf", threadKey: "a:17I0kl9", settings, lastInbound: { service_url: "https://smba.trafficmanager.net/emea/", conversation_id: "a:17I0kl9" }, lastInboundAt: new Date(), ...over });

  function pipe(connector: (url: string, init: RequestInit) => Response) {
    const seen: { url: string; auth: string; body: Record<string, unknown> }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      if (url.includes("login.microsoftonline.com")) return json({ access_token: "tok", expires_in: 3600 });
      seen.push({ url, auth: (init.headers as Record<string, string>).authorization!, body: JSON.parse(String(init.body)) });
      return connector(url, init);
    }) as unknown as typeof fetch;
    return { f, seen };
  }

  it("posts into the conversation at the latest service address, with the bot's token", async () => {
    const { f, seen } = pipe(() => json({ id: "act-9" }));
    expect(await teams.send(f, creds, req())).toEqual({ externalId: "act-9" });
    expect(seen[0]).toEqual({ url: "https://smba.trafficmanager.net/emea/v3/conversations/a%3A17I0kl9/activities", auth: "Bearer tok", body: { type: "message", text: "Try holding the power button." } });
  });

  it("still succeeds when Teams answers without an id", async () => {
    const { f } = pipe(() => new Response("", { status: 201 }));
    expect(await teams.send(f, creds, req())).toEqual({ externalId: "sent-m1" });
  });

  it("waits for the person to write when it has no service address", async () => {
    await expect(teams.send(fetch, creds, req({ lastInbound: {} }))).rejects.toMatchObject({ code: "no_conversation" });
    await expect(teams.send(fetch, creds, req({ lastInbound: { service_url: "http://insecure.example/" } }))).rejects.toMatchObject({ code: "no_conversation" });
  });

  it("explains Teams' refusals in plain words", async () => {
    await expect(teams.send(pipe(() => new Response('{"errorCode":209,"message":"{\\"subCode\\":\\"MessageWritesBlocked\\"}"}', { status: 403 })).f, creds, req())).rejects.toMatchObject({ code: "blocked", message: expect.stringContaining("blocked or removed") });
    await expect(teams.send(pipe(() => new Response("", { status: 403 })).f, creds, req())).rejects.toMatchObject({ code: "forbidden" });
    await expect(teams.send(pipe(() => new Response("", { status: 404 })).f, creds, req())).rejects.toMatchObject({ code: "conversation_gone" });
    await expect(teams.send(pipe(() => new Response("", { status: 401 })).f, creds, req())).rejects.toMatchObject({ code: "bad_credentials" });
  });

  it.each([429, 412, 502, 504, 500])("retries on %i", (status) => {
    expect(explainTeamsError(status, "")).toMatchObject({ temporary: true });
  });
  it("does not retry a plain bad request", () => {
    expect(explainTeamsError(400, "")).toMatchObject({ temporary: false, code: "http_400" });
  });
});

describe("the greeting", () => {
  beforeEach(() => forgetTokens());
  const update = (over: Record<string, unknown> = {}) => ({ type: "conversationUpdate", serviceUrl: "https://smba.trafficmanager.net/emea/", conversation: { conversationType: "personal", id: "a:17I0kl9" }, recipient: { id: "28:bot" }, membersAdded: [{ id: "29:abc" }, { id: "28:bot" }], ...over });
  function watch() {
    const posts: { url: string; body: Record<string, unknown> }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      if (url.includes("login.microsoftonline.com")) return json({ access_token: "tok", expires_in: 3600 });
      posts.push({ url, body: JSON.parse(String(init.body)) });
      return json({ id: "g1" });
    }) as unknown as typeof fetch;
    return { f, posts };
  }

  it("greets someone who first opens the bot", async () => {
    const { f, posts } = watch();
    await teams.welcome!(f, creds, update(), channel);
    expect(posts).toEqual([{ url: "https://smba.trafficmanager.net/emea/v3/conversations/a%3A17I0kl9/activities", body: { type: "message", text: "Hi, how can IT help?" } }]);
  });

  it("says nothing when no greeting is set, when only the bot was added, or outside a personal chat", async () => {
    const quiet = watch();
    await teams.welcome!(quiet.f, creds, update(), { ...channel, settings: { ...settings, greeting: "" } });
    await teams.welcome!(quiet.f, creds, update({ membersAdded: [{ id: "28:bot" }] }), channel);
    await teams.welcome!(quiet.f, creds, update({ conversation: { conversationType: "channel", id: "19:x" } }), channel);
    await teams.welcome!(quiet.f, creds, activity(), channel);
    expect(quiet.posts).toEqual([]);
  });
});

describe("downloading a file", () => {
  it("never fetches a private or non-https address", async () => {
    for (const url of ["http://download.link/x", "https://127.0.0.1/x", "https://169.254.169.254/x", "not a url", ""]) {
      await expect(teams.download!(fetch, creds, { id: "U1", url })).rejects.toThrow();
    }
  });
});
