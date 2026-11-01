import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { crcResponse, exchangeXCode, getMe, registerWebhook, subscribeToDms, validXSignature, X_SCOPES, xAuthorizeUrl } from "./x-api";

const reply = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const down = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;

describe("logging in with X", () => {
  it("builds the authorize address with PKCE, the state and the DM scopes", () => {
    const u = new URL(xAuthorizeUrl("cid", "https://relay.example/api/oauth/x/callback", "st", "chal"));
    expect(u.origin + u.pathname).toBe("https://x.com/i/oauth2/authorize");
    expect(Object.fromEntries(u.searchParams)).toEqual({
      response_type: "code", client_id: "cid", redirect_uri: "https://relay.example/api/oauth/x/callback", scope: "dm.read dm.write tweet.read users.read offline.access",
      state: "st", code_challenge: "chal", code_challenge_method: "S256",
    });
    expect(X_SCOPES).toContain("offline.access");
  });

  it("swaps the code for tokens with Basic auth and the PKCE verifier", async () => {
    let seen: { url: string; auth: string; body: URLSearchParams } | null = null;
    const f = (async (url: string, init: RequestInit) => { seen = { url, auth: (init.headers as Record<string, string>).authorization!, body: init.body as URLSearchParams }; return new Response(JSON.stringify({ access_token: "a", refresh_token: "r", expires_in: 7200 })); }) as unknown as typeof fetch;
    expect(await exchangeXCode(f, "cid", "sec", "the-code", "https://relay.example/cb", "ver", 1_000)).toEqual({ ok: true, value: { accessToken: "a", refreshToken: "r", expiresAt: 1_000 + 7_200_000 } });
    expect(seen!.url).toBe("https://api.x.com/2/oauth2/token");
    expect(seen!.auth).toBe(`Basic ${Buffer.from("cid:sec").toString("base64")}`);
    expect(Object.fromEntries(seen!.body)).toEqual({ code: "the-code", grant_type: "authorization_code", client_id: "cid", redirect_uri: "https://relay.example/cb", code_verifier: "ver" });
  });

  it("defaults to two hours when X says nothing about expiry, and tolerates no refresh token", async () => {
    expect(await exchangeXCode(reply({ access_token: "a" }), "c", "s", "x", "u", "v", 0)).toEqual({ ok: true, value: { accessToken: "a", refreshToken: undefined, expiresAt: 7_200_000 } });
  });

  it("reports X's reason when it refuses, and an outage", async () => {
    expect(await exchangeXCode(reply({ error: "invalid_request", error_description: "Value passed for the authorization code was invalid." }, 400), "c", "s", "x", "u", "v")).toEqual({ ok: false, reason: "rejected", detail: "Value passed for the authorization code was invalid." });
    expect(await exchangeXCode(reply({}, 503), "c", "s", "x", "u", "v")).toEqual({ ok: false, reason: "unreachable" });
    expect(await exchangeXCode(down, "c", "s", "x", "u", "v")).toEqual({ ok: false, reason: "unreachable" });
  });
});

describe("who the login is", () => {
  it("reads the account's id and username", async () => {
    expect(await getMe(reply({ data: { id: "900", username: "acme", name: "Acme" } }), "tok")).toEqual({ ok: true, value: { id: "900", username: "acme" } });
    expect(await getMe(reply({ data: { id: "900" } }), "tok")).toEqual({ ok: true, value: { id: "900", username: undefined } });
  });
  it("reports a refusal", async () => {
    expect(await getMe(reply({ title: "Unauthorized", detail: "Unauthorized" }, 401), "tok")).toMatchObject({ ok: false, reason: "rejected" });
  });
});

describe("X's CRC check and signatures", () => {
  it("answers the CRC with sha256= and the base64 HMAC of the token under the client secret", () => {
    const expected = createHmac("sha256", "sec").update("crc-abc").digest("base64");
    expect(crcResponse("sec", "crc-abc")).toEqual({ response_token: `sha256=${expected}` });
  });

  it("accepts the signature of the exact body and refuses everything else", () => {
    const body = '{"event":"dm.received"}';
    const good = `sha256=${createHmac("sha256", "sec").update(body).digest("base64")}`;
    expect(validXSignature("sec", body, good)).toBe(true);
    expect(validXSignature("other", body, good)).toBe(false);
    expect(validXSignature("sec", body + " ", good)).toBe(false);
    expect(validXSignature("sec", body, good.slice(7))).toBe(false);
    expect(validXSignature("sec", body, null)).toBe(false);
    expect(validXSignature("", body, good)).toBe(false);
  });
});

describe("registering the webhook and subscribing", () => {
  it("posts the address with the app's bearer token and returns the webhook id", async () => {
    let seen: { url: string; auth: string; body: Record<string, unknown> } | null = null;
    const f = (async (url: string, init: RequestInit) => { seen = { url, auth: (init.headers as Record<string, string>).authorization!, body: JSON.parse(String(init.body)) }; return new Response(JSON.stringify({ data: { id: "1234", url: "https://relay.example/x", valid: true } }), { status: 200 }); }) as unknown as typeof fetch;
    expect(await registerWebhook(f, "bearer", "https://relay.example/api/webhooks/x/k")).toEqual({ ok: true, value: { id: "1234" } });
    expect(seen).toEqual({ url: "https://api.x.com/2/webhooks", auth: "Bearer bearer", body: { url: "https://relay.example/api/webhooks/x/k" } });
  });

  it("refuses a webhook X marked invalid, and reports X's reason", async () => {
    expect(await registerWebhook(reply({ data: { id: "1", valid: false } }), "b", "https://x")).toMatchObject({ ok: false, reason: "rejected" });
    expect(await registerWebhook(reply({ title: "Forbidden", detail: "Not allowed" }, 403), "b", "https://x")).toEqual({ ok: false, reason: "rejected", detail: "Forbidden: Not allowed" });
    expect(await registerWebhook(down, "b", "https://x")).toEqual({ ok: false, reason: "unreachable" });
  });

  it("subscribes the account to dm.received on that webhook with the account's own token", async () => {
    let seen: { url: string; auth: string; body: Record<string, unknown> } | null = null;
    const f = (async (url: string, init: RequestInit) => { seen = { url, auth: (init.headers as Record<string, string>).authorization!, body: JSON.parse(String(init.body)) }; return new Response(JSON.stringify({ data: { subscription: { subscription_id: "s1" } } }), { status: 200 }); }) as unknown as typeof fetch;
    expect(await subscribeToDms(f, "usertok", "900", "1234")).toEqual({ ok: true, value: true });
    expect(seen).toEqual({ url: "https://api.x.com/2/activity/subscriptions", auth: "Bearer usertok", body: { event_type: "dm.received", filter: { user_id: "900" }, webhook_id: "1234" } });
    expect(await subscribeToDms(reply({ title: "Forbidden" }, 403), "t", "1", "2")).toMatchObject({ ok: false, reason: "rejected" });
  });
});
