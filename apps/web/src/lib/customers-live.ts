import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChannelKey } from "@/components/channels/catalog";
import type { Company, CustomFieldDef, Customer, Lifecycle } from "@/components/customers/types";
import { identity } from "@/lib/inbox-live";

/**
 * Real customers and companies (step 2b, decided 2026-10-20), in the same shapes the preview uses so the Contacts
 * screens don't change. Row-level security decides which customers each person sees. Deals, tasks, orders and
 * marketing consent arrive in later steps; until then they're empty, never invented.
 */

interface ContactRow {
  id: string;
  name: string | null;
  profile_name: string | null;
  email: string | null;
  phone: string | null;
  lifecycle: Lifecycle;
  owner_member_id: string | null;
  company_id: string | null;
  tags: string[];
  language: string | null;
  area: string | null;
  fields: Record<string, string>;
  pinned_note: string | null;
  pinned_by: string | null;
  pinned_at: string | null;
  created_at: string;
  created_from: "channel" | "import" | "manual";
  do_not_contact: boolean;
  erased_at: string | null;
  contact_consent: { channel: ChannelKey; status: "in" | "out"; source: string; set_at: string }[];
  contact_identities: { kind: string; address: string; display: string | null }[];
}

interface ConvRow {
  id: string;
  contact_id: string;
  team_id: string | null;
  status: string;
  last_message_at: string | null;
  created_at: string;
  channels: { type: ChannelKey } | null;
}

const CONTACT_COLUMNS =
  "id, name, profile_name, email, phone, lifecycle, owner_member_id, company_id, tags, language, area, fields, pinned_note, pinned_by, pinned_at, created_at, created_from, do_not_contact, erased_at, contact_identities(kind, address, display), contact_consent(channel, status, source, set_at)";
const MAX = 1000;

function toCustomer(c: ContactRow, convs: ConvRow[], companies: Map<string, Company>): Customer {
  const mine = convs.filter((v) => v.contact_id === c.id);
  const latest = mine.find((v) => v.status !== "spam") ?? mine[0];
  const first = [...mine].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  const company = c.company_id ? companies.get(c.company_id) : undefined;
  return {
    id: c.id,
    name: c.name ?? c.profile_name ?? c.email ?? c.phone ?? "Website visitor",
    company: company?.name,
    companyId: company?.id,
    phone: c.phone ?? undefined,
    email: c.email ?? undefined,
    language: c.language ?? "",
    area: c.area ?? undefined,
    type: c.tags.includes("VIP") ? "VIP" : company ? "Business" : "Individual",
    lifecycle: c.lifecycle,
    tags: c.tags,
    ownerId: c.owner_member_id,
    teamId: latest?.team_id ?? "",
    // Where they first came from, as the list shows it.
    source: c.created_from === "manual" ? "Added by hand" : c.created_from === "import" ? "Imported" : first?.channels?.type ?? "",
    createdAt: Date.parse(c.created_at),
    identities: c.contact_identities.map(identity),
    consent: Object.fromEntries((c.contact_consent ?? []).map((x) => [x.channel, { status: x.status, at: Date.parse(x.set_at), source: x.source }])),
    doNotContact: c.do_not_contact || undefined,
    fields: c.fields ?? {},
    pinned: c.pinned_note && c.pinned_by && c.pinned_at ? { text: c.pinned_note, byId: c.pinned_by, at: Date.parse(c.pinned_at) } : undefined,
    lastContact: latest?.last_message_at && latest.channels ? { at: Date.parse(latest.last_message_at), channel: latest.channels.type } : null,
    conversationId: latest && latest.status !== "spam" ? latest.id : undefined,
    deals: [],
    tasks: [],
    orders: [],
    timeline: [],
  };
}

async function loadCompanies(supabase: SupabaseClient, workspaceId: string) {
  const { data } = await supabase
    .from("companies")
    .select("id, name, domain, industry, size, location, owner_member_id, tags, created_at")
    .eq("workspace_id", workspaceId)
    .order("name");
  return new Map(
    (data ?? []).map((r) => [
      r.id as string,
      {
        id: r.id, name: r.name, domain: r.domain ?? undefined, industry: r.industry ?? undefined, size: r.size ?? undefined,
        location: r.location ?? undefined, ownerId: r.owner_member_id, tags: r.tags ?? [], createdAt: Date.parse(r.created_at),
      } satisfies Company,
    ]),
  );
}

async function loadConversations(supabase: SupabaseClient, workspaceId: string, contactIds?: string[]) {
  let q = supabase
    .from("conversations")
    .select("id, contact_id, team_id, status, last_message_at, created_at, channels(type)")
    .eq("workspace_id", workspaceId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(MAX * 2);
  if (contactIds) q = q.in("contact_id", contactIds);
  const { data } = await q;
  return (data ?? []) as unknown as ConvRow[];
}

export async function loadFieldDefs(supabase: SupabaseClient, workspaceId: string): Promise<CustomFieldDef[]> {
  const { data } = await supabase.from("contact_field_defs").select("key, label, type, options").eq("workspace_id", workspaceId).order("position");
  return (data ?? []).map((d) => ({ key: d.key, label: d.label, type: d.type, options: d.options?.length ? d.options : undefined }));
}

/** Every customer this person may see, newest contact first, with their companies. */
export async function loadCustomers(supabase: SupabaseClient, workspaceId: string) {
  const [{ data }, companies, convs] = await Promise.all([
    // Erased customers stay only as anonymous placeholders for reports; the list never shows them.
    supabase.from("contacts").select(CONTACT_COLUMNS).eq("workspace_id", workspaceId).is("erased_at", null).order("updated_at", { ascending: false }).limit(MAX),
    loadCompanies(supabase, workspaceId),
    loadConversations(supabase, workspaceId),
  ]);
  const customers = ((data ?? []) as unknown as ContactRow[])
    .map((c) => toCustomer(c, convs, companies))
    .sort((a, b) => (b.lastContact?.at ?? b.createdAt) - (a.lastContact?.at ?? a.createdAt));
  const withPeople = [...companies.values()].map((co) => ({ ...co, people: customers.filter((c) => c.companyId === co.id) }));
  return { customers, companies: withPeople };
}

/** One customer, their company, and a company that shares their email domain (to suggest a link). */
export async function loadCustomer(supabase: SupabaseClient, workspaceId: string, id: string) {
  const [{ data }, companies, convs] = await Promise.all([
    supabase.from("contacts").select(CONTACT_COLUMNS).eq("workspace_id", workspaceId).eq("id", id).is("erased_at", null).maybeSingle(),
    loadCompanies(supabase, workspaceId),
    loadConversations(supabase, workspaceId, [id]),
  ]);
  if (!data) return null;
  const customer = toCustomer(data as unknown as ContactRow, convs, companies);
  const domain = customer.email?.split("@")[1];
  const suggested = !customer.companyId && domain ? [...companies.values()].find((co) => co.domain === domain) ?? null : null;
  // A likely duplicate: another customer with exactly the same name (merging is always a person's choice).
  const { data: twin } = await supabase
    .from("contacts").select(CONTACT_COLUMNS).eq("workspace_id", workspaceId).is("erased_at", null).neq("id", id).ilike("name", customer.name).limit(1).maybeSingle();
  const duplicate = twin && customer.name !== "Website visitor" ? toCustomer(twin as unknown as ContactRow, [], companies) : null;
  return { customer, company: customer.companyId ? companies.get(customer.companyId) ?? null : null, suggested, duplicate, companies: [...companies.values()] };
}
