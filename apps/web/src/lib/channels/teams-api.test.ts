import { createSign, generateKeyPairSync } from "node:crypto";
import { inflateSync } from "node:zlib";
import { beforeEach, describe, expect, it } from "vitest";
import { checkBotCredentials, connectorKeys, forgetKeys, tokenKid, verifyConnectorToken, type SigningKey } from "./teams-api";
import { colorIcon, crc32, MANIFEST_VERSION, outlineIcon, teamsManifest, teamsPackage, zip } from "./teams-package";

const APP = "11111111-1111-1111-1111-111111111111";
const SERVICE = "https://smba.trafficmanager.net/emea/";
const NOW = 1_800_000_000_000;

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = (k: typeof publicKey, kid: string, endorsements?: string[]): SigningKey => ({ ...(k.export({ format: "jwk" }) as object), kid, ...(endorsements ? { endorsements } : {}) });
const KEY = jwk(publicKey, "k1", ["msteams", "webchat"]);

function token(claims: Record<string, unknown> = {}, opts: { kid?: string; alg?: string; signWith?: typeof privateKey } = {}) {
  const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b({ typ: "JWT", alg: opts.alg ?? "RS256", kid: opts.kid ?? "k1" });
  const body = b({ iss: "https://api.botframework.com", aud: APP, nbf: NOW / 1000 - 60, exp: NOW / 1000 + 3600, serviceUrl: SERVICE, ...claims });
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(opts.signWith ?? privateKey).toString("base64url");
  return `Bearer ${head}.${body}.${sig}`;
}
const check = (authorization: string | null, over: Partial<Parameters<typeof verifyConnectorToken>[0]> = {}) =>
  verifyConnectorToken({ authorization, appId: APP, serviceUrl: SERVICE, channelId: "msteams", keys: [KEY], nowMs: NOW, ...over });

describe("Microsoft's token checks", () => {
  it("accepts a correctly signed token for this bot", () => {
    expect(check(token())).toEqual({ ok: true });
  });

  it.each([
    ["no header", null, "no bearer token"],
    ["a basic login", "Basic abc", "no bearer token"],
    ["not a JWT", "Bearer abc", "not a JWT"],
    ["not JSON", "Bearer a.b.c", "not valid JSON"],
  ])("refuses %s", (_n, header, reason) => {
    expect(check(header)).toEqual({ ok: false, reason });
  });

  it("refuses the wrong issuer, audience, service address and algorithm", () => {
    expect(check(token({ iss: "https://evil.example" }))).toEqual({ ok: false, reason: "wrong issuer" });
    expect(check(token({ aud: "22222222-2222-2222-2222-222222222222" }))).toEqual({ ok: false, reason: "wrong audience" });
    expect(check(token({ serviceUrl: "https://elsewhere.example/" }))).toEqual({ ok: false, reason: "serviceUrl does not match" });
    expect(check(token({}, { alg: "HS256" }))).toEqual({ ok: false, reason: "unexpected algorithm" });
  });

  it("allows five minutes of clock skew and no more", () => {
    expect(check(token({ exp: NOW / 1000 - 299 }))).toEqual({ ok: true });
    expect(check(token({ exp: NOW / 1000 - 301 }))).toEqual({ ok: false, reason: "expired" });
    expect(check(token({ nbf: NOW / 1000 + 299 }))).toEqual({ ok: true });
    expect(check(token({ nbf: NOW / 1000 + 301 }))).toEqual({ ok: false, reason: "not yet valid" });
    expect(check(token({ exp: undefined }))).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses a token signed with another key, or by a key Microsoft doesn't list", () => {
    expect(check(token({}, { signWith: other.privateKey }))).toEqual({ ok: false, reason: "bad signature" });
    expect(check(token({}, { kid: "nope" }))).toEqual({ ok: false, reason: "unknown signing key" });
  });

  it("refuses a token whose body was changed after signing", () => {
    const [h, , s] = token().replace("Bearer ", "").split(".");
    const body = Buffer.from(JSON.stringify({ iss: "https://api.botframework.com", aud: APP, exp: NOW / 1000 + 99999, serviceUrl: SERVICE })).toString("base64url");
    expect(check(`Bearer ${h}.${body}.${s}`)).toEqual({ ok: false, reason: "bad signature" });
  });

  it("requires the key to endorse the channel when it lists any", () => {
    expect(check(token(), { channelId: "directline" })).toEqual({ ok: false, reason: "channel not endorsed" });
    expect(check(token(), { keys: [jwk(publicKey, "k1")] })).toEqual({ ok: true });
  });

  it("reads the key id from the header", () => {
    expect(tokenKid(token())).toBe("k1");
    expect(tokenKid("Bearer nope")).toBeUndefined();
    expect(tokenKid(null)).toBeUndefined();
  });
});

describe("Microsoft's signing keys", () => {
  beforeEach(() => forgetKeys());
  const served = (keys: SigningKey[]) => {
    const asked: string[] = [];
    const f = (async (url: string) => {
      asked.push(url);
      return new Response(JSON.stringify(url.endsWith("openidconfiguration") ? { jwks_uri: "https://login.botframework.com/v1/.well-known/keys" } : { keys }));
    }) as unknown as typeof fetch;
    return { f, asked };
  };

  it("fetches the static OpenID document, then the key list, and keeps it", async () => {
    const { f, asked } = served([KEY]);
    expect(await connectorKeys(f, 1_000)).toEqual([KEY]);
    expect(await connectorKeys(f, 2_000)).toEqual([KEY]);
    expect(asked).toEqual(["https://login.botframework.com/v1/.well-known/openidconfiguration", "https://login.botframework.com/v1/.well-known/keys"]);
  });

  it("asks again after twelve hours, and at once (at most once a minute) for a key id it has not seen", async () => {
    const { f, asked } = served([KEY]);
    await connectorKeys(f, 0);
    await connectorKeys(f, 30_000, "new-kid");
    expect(asked).toHaveLength(2);
    await connectorKeys(f, 61_000, "new-kid");
    expect(asked).toHaveLength(4);
    await connectorKeys(f, 13 * 3600_000);
    expect(asked).toHaveLength(6);
  });

  it("keeps using the old keys when Microsoft can't be reached, but fails if it never had any", async () => {
    const { f } = served([KEY]);
    await connectorKeys(f, 0);
    const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    expect(await connectorKeys(down, 13 * 3600_000)).toEqual([KEY]);
    forgetKeys();
    await expect(connectorKeys(down, 0)).rejects.toThrow();
  });
});

describe("checking a pasted App ID, secret and tenant", () => {
  const reply = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("accepts them when Microsoft gives a token, asking the company's own tenant", async () => {
    let seen: { url: string; body: URLSearchParams } | null = null;
    const f = (async (url: string, init: RequestInit) => { seen = { url, body: init.body as URLSearchParams }; return new Response(JSON.stringify({ access_token: "t" })); }) as unknown as typeof fetch;
    expect(await checkBotCredentials(f, APP, "secret", "tenant-1")).toEqual({ ok: true, value: true });
    expect(seen!.url).toBe("https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token");
    expect(Object.fromEntries(seen!.body)).toEqual({ grant_type: "client_credentials", client_id: APP, client_secret: "secret", scope: "https://api.botframework.com/.default" });
  });

  it("reports Microsoft's first line when it refuses, and an outage", async () => {
    expect(await checkBotCredentials(reply({ error_description: "AADSTS7000215: Invalid client secret provided.\r\nTrace ID: x" }, 401), APP, "bad", "t")).toEqual({ ok: false, reason: "rejected", description: "AADSTS7000215: Invalid client secret provided." });
    expect(await checkBotCredentials(reply({}, 503), APP, "s", "t")).toEqual({ ok: false, reason: "unreachable" });
    expect(await checkBotCredentials((async () => { throw new Error("offline"); }) as unknown as typeof fetch, APP, "s", "t")).toEqual({ ok: false, reason: "unreachable" });
  });
});

interface Manifest { accentColor: string; developer: { name: string }; name: { short: string; full: string }; description: { short: string; full: string } }

describe("the Teams app file", () => {
  const input = { appId: "33333333-3333-3333-3333-333333333333", botId: APP, name: "Help desk", company: "Acme", origin: "https://relay.example/" };

  it("fills the manifest's required fields within Microsoft's limits", () => {
    const m = teamsManifest(input) as unknown as Manifest;
    expect(m).toMatchObject({
      manifestVersion: MANIFEST_VERSION, version: "1.0.0", id: input.appId, accentColor: "#0A5670",
      developer: { name: "Acme", websiteUrl: "https://relay.example/", privacyUrl: "https://relay.example/privacy", termsOfUseUrl: "https://relay.example/terms" },
      name: { short: "Help desk", full: "Help desk" }, icons: { outline: "outline.png", color: "color.png" },
      bots: [{ botId: APP, scopes: ["personal"], supportsFiles: true }],
    });
    expect(m.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(m.description.short.length).toBeLessThanOrEqual(80);
    expect(m.description.full.length).toBeLessThanOrEqual(4000);
  });

  it("cuts long names to Microsoft's limits", () => {
    const m = teamsManifest({ ...input, name: "N".repeat(200), company: "C".repeat(100) }) as unknown as Manifest;
    expect(m.name.short.length).toBeLessThanOrEqual(30);
    expect(m.name.full.length).toBeLessThanOrEqual(100);
    expect(m.developer.name.length).toBeLessThanOrEqual(32);
    expect(m.description.short.length).toBeLessThanOrEqual(80);
  });

  it("draws icons of the required sizes", () => {
    const dims = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];
    expect(colorIcon().subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    expect(dims(colorIcon())).toEqual([192, 192]);
    expect(dims(outlineIcon())).toEqual([32, 32]);
  });

  it("makes the colour icon opaque and the outline icon transparent around its ring", () => {
    const pixels = (b: Buffer) => {
      const idat = b.indexOf("IDAT");
      const len = b.readUInt32BE(idat - 4);
      return inflateSync(b.subarray(idat + 4, idat + 4 + len));
    };
    const size = 32;
    const raw = pixels(outlineIcon());
    expect(raw).toHaveLength((size * 4 + 1) * size);
    expect(raw[1 + 3]).toBe(0); // top-left corner: fully transparent
    const color = pixels(colorIcon());
    expect(color[1 + 3]).toBe(255); // top-left corner: opaque
  });

  it("writes a valid zip: names, sizes and checksums match", () => {
    const data = teamsPackage(input);
    const end = data.length - 22;
    expect(data.readUInt32LE(end)).toBe(0x06054b50);
    const count = data.readUInt16LE(end + 10);
    expect(count).toBe(3);
    let at = data.readUInt32LE(end + 16);
    const seen: string[] = [];
    for (let i = 0; i < count; i++) {
      expect(data.readUInt32LE(at)).toBe(0x02014b50);
      const crc = data.readUInt32LE(at + 16);
      const size = data.readUInt32LE(at + 24);
      const nameLen = data.readUInt16LE(at + 28);
      const offset = data.readUInt32LE(at + 42);
      const name = data.subarray(at + 46, at + 46 + nameLen).toString();
      seen.push(name);
      expect(data.readUInt32LE(offset)).toBe(0x04034b50);
      const start = offset + 30 + data.readUInt16LE(offset + 26);
      expect(crc32(data.subarray(start, start + size))).toBe(crc);
      if (name === "manifest.json") expect(JSON.parse(data.subarray(start, start + size).toString()).bots[0].botId).toBe(APP);
      at += 46 + nameLen;
    }
    expect(seen).toEqual(["manifest.json", "color.png", "outline.png"]);
  });

  it("computes the standard CRC-32", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
    expect(zip([]).length).toBe(22);
  });
});
