import dns from "node:dns";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

/**
 * Fetching an address a customer gave us (an API inbox's webhook, a file link) without letting them reach our own
 * network (decided 2026-11-01). Rules: https only; the name must resolve only to public addresses, checked again
 * at the moment of connecting (so a name can't change its answer in between); no redirects; a time limit; a size
 * limit on what we read back.
 */

export class BlockedAddress extends Error {}

function v4Private(a: number, b: number): boolean {
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 || // this network, private, loopback, multicast and reserved
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, including cloud metadata addresses
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** True for any address that is not a normal public internet address. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return v4Private(a!, b!);
  }
  if (isIP(ip) === 6) {
    const s = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (mapped) return isPrivateAddress(mapped[1]!);
    if (s === "::" || s === "::1") return true;
    if (/^f[cd]/.test(s)) return true; // unique local fc00::/7
    if (/^fe[89ab]/.test(s)) return true; // link-local fe80::/10
    if (s.startsWith("ff")) return true; // multicast
    if (s.startsWith("64:ff9b:")) return true; // translation prefixes can hide a private v4
    return false;
  }
  return true; // not an address we understand
}

const agent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
        if (error) return callback(error, "", 4);
        const list = addresses as dns.LookupAddress[];
        if (!list.length || list.some((a) => isPrivateAddress(a.address))) return callback(new BlockedAddress("That address isn't public."), "", 4);
        if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
        return callback(null, list[0]!.address, list[0]!.family);
      });
    },
  },
});

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

/** Throws BlockedAddress for a non-public destination. Never follows redirects (a 3xx comes back as-is). */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<Response> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedAddress("That isn't a web address.");
  }
  if (url.protocol !== "https:") throw new BlockedAddress("Only https addresses are allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivateAddress(host)) throw new BlockedAddress("That address isn't public.");
  try {
    const init = {
      method: options.method ?? "GET",
      ...(options.headers ? { headers: options.headers } : {}),
      ...(options.body !== undefined ? { body: options.body } : {}),
      redirect: "manual" as const,
      dispatcher: agent,
      signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
    };
    return (await undiciFetch(url, init)) as unknown as Response;
  } catch (e) {
    // undici wraps the lookup failure; surface our own error so callers can word it plainly.
    const cause = (e as { cause?: unknown }).cause;
    if (cause instanceof BlockedAddress) throw cause;
    throw e;
  }
}

/** Reads a response body but stops (and throws) past `maxBytes`. */
export async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("That file is too large.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}
