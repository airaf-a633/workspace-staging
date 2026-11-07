import "server-only";
import { serverEnv } from "@/env";

/**
 * Verifying a business's email domain with Postmark (decided 2026-10-19), so replies can come from their own
 * address. Needs Postmark's account-level token. The business adds the DKIM TXT record (and, for bounces, the
 * Return-Path CNAME) we show them; "Check again" asks Postmark to look.
 */

export interface DomainState {
  id: number;
  name: string;
  dkimHost: string;
  dkimValue: string;
  returnPathHost: string;
  returnPathTarget: string;
  verified: boolean;
  returnPathVerified: boolean;
}

interface PostmarkDomain {
  ID: number;
  Name: string;
  DKIMHost?: string;
  DKIMTextValue?: string;
  DKIMPendingHost?: string;
  DKIMPendingTextValue?: string;
  DKIMVerified?: boolean;
  ReturnPathDomain?: string;
  ReturnPathDomainCNAMEValue?: string;
  ReturnPathDomainVerified?: boolean;
}

export class DomainError extends Error {}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = serverEnv().POSTMARK_ACCOUNT_TOKEN;
  if (!token) throw new DomainError("notConfigured");
  const res = await fetch(`https://api.postmarkapp.com${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Account-Token": token },
  });
  const json = (await res.json().catch(() => ({}))) as T & { ErrorCode?: number; Message?: string };
  if (!res.ok) throw new DomainError(json.Message ?? `Postmark ${res.status}`);
  return json;
}

const toState = (d: PostmarkDomain): DomainState => ({
  id: d.ID,
  name: d.Name,
  dkimHost: d.DKIMPendingHost || d.DKIMHost || "",
  dkimValue: d.DKIMPendingTextValue || d.DKIMTextValue || "",
  returnPathHost: d.ReturnPathDomain || `pm-bounces.${d.Name}`,
  returnPathTarget: d.ReturnPathDomainCNAMEValue || "pm.mtasv.net",
  verified: !!d.DKIMVerified,
  returnPathVerified: !!d.ReturnPathDomainVerified,
});

/** Starts verification for a domain: Postmark creates its DKIM key and tells us the records to show. */
export async function startDomain(name: string): Promise<DomainState> {
  const created = await call<PostmarkDomain>("/domains", {
    method: "POST",
    body: JSON.stringify({ Name: name, ReturnPathDomain: `pm-bounces.${name}` }),
  });
  return toState(created);
}

/** Asks Postmark to look for the records now. */
export async function checkDomain(id: number): Promise<DomainState> {
  await call<PostmarkDomain>(`/domains/${id}/verifyReturnPath`, { method: "PUT" }).catch(() => null);
  return toState(await call<PostmarkDomain>(`/domains/${id}/verifyDkim`, { method: "PUT" }));
}
