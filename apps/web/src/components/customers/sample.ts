import type { Conversation, Identity, InboxData } from "@/components/inbox/types";
import type { ChannelKey } from "@/components/channels/catalog";
import type { Line } from "@/i18n/labels";
import type { Company, Consent, CustomFieldDef, Customer, Lifecycle, TimelineItem } from "./types";
import { dayDiff } from "@/i18n/zone";

/**
 * Sample customers for the preview, built from the same sample chats as the inbox so every screen agrees,
 * plus a few customers who haven't written recently (and one likely duplicate, to show merging).
 */

const DAY = 86_400_000;

/** The fields Northwind Home defined for every contact (Settings › Contacts and privacy). */
export const CUSTOM_FIELDS: CustomFieldDef[] = [
  { key: "tier", label: "Loyalty tier", type: "select", options: ["Bronze", "Silver", "Gold"] },
  { key: "shopifyId", label: "Shopify customer ID", type: "text" },
  { key: "birthday", label: "Birthday", type: "date" },
];

/** Companies (one per person, decided 2026-10-07). People are linked by company name; a shared email domain only suggests a link. */
export const SAMPLE_COMPANIES = (now: number, ownerOf: (name: string) => string | null): Company[] => [
  { id: "co-haddad", name: "Haddad Interiors", domain: "haddadinteriors.co.uk", industry: "Interior design", size: "11–50", location: "London, UK", ownerId: ownerOf("Marcus"), tags: ["Wholesale"], createdAt: now - 70 * DAY },
  { id: "co-haus", name: "Haus & Licht GmbH", domain: "hausundlicht.de", industry: "Retail", size: "51–200", location: "Munich, Germany", ownerId: ownerOf("Kenji"), tags: ["Wholesale"], createdAt: now - 200 * DAY },
  { id: "co-hearth", name: "Hearth & Co", domain: "hearthandco.pt", industry: "Retail", size: "11–50", location: "Porto, Portugal", ownerId: ownerOf("Marcus"), tags: ["Wholesale", "VIP"], createdAt: now - 320 * DAY },
  { id: "co-bright", name: "Bright Dental Group", domain: "brightdental.ca", industry: "Healthcare", size: "201–500", location: "Toronto, Canada", ownerId: ownerOf("Leo"), tags: ["Wholesale"], createdAt: now - 120 * DAY },
  { id: "co-kinfolk", name: "Kinfolk Studios", domain: "kinfolkstudios.com", industry: "Design studio", size: "1–10", location: "Copenhagen, Denmark", ownerId: ownerOf("Marcus"), tags: [], createdAt: now - 21 * DAY },
];
const COMPANY_BY_NAME: Record<string, string> = {
  "Haddad Interiors": "co-haddad",
  "Haus & Licht GmbH": "co-haus",
  "Hearth & Co": "co-hearth",
  "Bright Dental Group Inc.": "co-bright",
};

function lifecycleOf(orders: number, wonDeal: boolean): Lifecycle {
  return orders > 1 ? "repeat" : orders === 1 || wonDeal ? "customer" : "lead";
}

/** Sample consent: opted in on the channels people bought through, unknown elsewhere. */
function consentOf(identities: Identity[], createdAt: number): Partial<Record<ChannelKey, Consent>> {
  const out: Partial<Record<ChannelKey, Consent>> = {};
  for (const i of identities) {
    out[i.ch] = i.ch === "email" || i.ch === "whatsapp" ? { status: "in", at: createdAt, source: "Checkout" } : { status: "unknown" };
  }
  return out;
}

const EXTRA_FIELDS: Record<string, Partial<Customer>> = {
  mariam: {
    type: "Business",
    source: "Instagram ad",
    duplicateOf: "m-haddad",
    fields: { tier: "Gold", shopifyId: "7781 0042" },
    pinned: { text: "Hotel opens on the 24th. Deliveries only on Thursdays, goods entrance at the back.", byId: "kenji", at: 0 },
  },
  lukas: { type: "Business", source: "Email", fields: { tier: "Silver" } },
  ines: { type: "VIP", source: "Trade fair", lifecycle: "repeat", fields: { tier: "Gold" } },
  george: { consent: { sms: { status: "out", at: 0, source: "Replied STOP" }, whatsapp: { status: "unknown" } } },
  tom: { doNotContact: true },
  sofia: { source: "Instagram" },
  omar: { source: "Telegram" },
  nils: { source: "Discord" },
  chloe: { source: "TikTok" },
  deepak: { source: "Website chat" },
  yousef: { source: "Imported from phone" },
};

/** Sample consent overrides carry "at: 0"; give them a date a little in the past. */
function withTime(c: Partial<Record<ChannelKey, Consent>> | undefined, now: number) {
  return Object.fromEntries(Object.entries(c ?? {}).map(([k, v]) => [k, v.at === 0 ? { ...v, at: now - 12 * DAY } : v]));
}

function fromConversation(c: Conversation, data: InboxData): Customer {
  const name = (id: string | undefined | null) => data.people.find((p) => p.id === id)?.name ?? "";
  const timeline: TimelineItem[] = [];
  const messages = (count: number): Line => ({ key: "timeline.messages", vars: { channel: { t: `channels.${c.channel}` }, count } });

  // One timeline entry per day of chat: how many messages, and the last one.
  let run: { first: number; last: number; count: number; text?: string; line?: Line } | null = null;
  const flush = () => {
    if (!run) return;
    timeline.push({
      id: `${c.id}-chat-${run.first}`,
      at: run.last,
      kind: c.channel === "email" ? "email" : "chat",
      title: messages(run.count),
      body: run.text,
      bodyLine: run.line,
      href: `inbox?c=${c.id}`,
    });
    run = null;
  };
  for (const m of c.messages) {
    if (m.kind === "note") {
      timeline.push({ id: m.id, at: m.at, kind: "note", title: { key: "timeline.note" }, body: m.text, by: name(m.authorId) });
      continue;
    }
    if (m.kind !== "in" && m.kind !== "out") continue;
    const text = m.deleted ? undefined : m.subject ?? m.text;
    const line: Line | undefined = m.deleted ? { key: "inbox.snippet.deleted" } : !text && m.media ? { key: `message.media.${m.media.type}` } : undefined;
    if (run && dayDiff(run.last, m.at, data.tz) === 0) {
      run.last = m.at;
      run.count++;
      run.text = text;
      run.line = line;
    } else {
      flush();
      run = { first: m.at, last: m.at, count: 1, text, line };
    }
  }
  flush();
  for (const h of c.handoffs) {
    timeline.push({ id: `${c.id}-ho-${h.at}`, at: h.at, kind: "handoff", title: { key: "timeline.handoff", vars: { from: name(h.fromId), to: h.toId ? name(h.toId) : { t: "events.aTeam" } } }, body: h.note });
  }
  for (const d of c.contact.deals) {
    timeline.push({ id: `${c.id}-deal-${d.id}`, at: c.messages[Math.min(5, c.messages.length - 1)]?.at ?? data.now, kind: "deal", title: { key: "timeline.deal", vars: { title: d.title } }, body: d.stage, by: name(d.ownerId) });
  }
  for (const o of c.contact.orders) {
    timeline.push({ id: `${c.id}-order-${o.no}`, at: (c.messages[0]?.at ?? data.now) - 3 * DAY, kind: "order", title: { key: "timeline.order", vars: { source: { t: `values.orderSource.${o.source}` }, no: o.no } }, body: o.state });
  }
  for (const t of c.contact.tasks) {
    timeline.push({ id: `${c.id}-task-${t.id}`, at: c.messages[c.messages.length - 1]?.at ?? data.now, kind: "task", title: { key: "timeline.task", vars: { text: t.text } }, body: t.due, by: name(t.ownerId) });
  }

  const real = c.messages.filter((m) => m.kind === "in" || m.kind === "out");
  const last = real[real.length - 1];
  const extra = EXTRA_FIELDS[c.id] ?? {};
  const createdAt = (real[0]?.at ?? data.now) - 20 * DAY;
  // Who did what to the contact itself: created, and later changes (the full log lives in the audit trail).
  timeline.push({ id: `${c.id}-created`, at: createdAt, kind: "activity", title: { key: "timeline.created", vars: { channel: { t: `channels.${c.channel}` } } } });
  return {
    id: c.id,
    name: c.contact.name,
    company: c.contact.company,
    phone: c.contact.phone,
    email: c.contact.email,
    language: c.contact.language,
    area: c.contact.location,
    type: extra.type ?? "Individual",
    lifecycle: extra.lifecycle ?? lifecycleOf(c.contact.orders.length, c.contact.deals.some((d) => d.stage === "won")),
    companyId: c.contact.company ? COMPANY_BY_NAME[c.contact.company] : undefined,
    identities: c.contact.identities,
    consent: { ...consentOf(c.contact.identities, createdAt), ...withTime(extra.consent, data.now) },
    doNotContact: extra.doNotContact,
    fields: extra.fields ?? {},
    pinned: extra.pinned ? { ...extra.pinned, byId: data.people.find((p) => p.name.toLowerCase() === extra.pinned!.byId)?.id ?? "", at: data.now - 2 * DAY } : undefined,
    tags: c.contact.tags,
    ownerId: c.holderId ?? c.contact.deals[0]?.ownerId ?? null,
    teamId: c.teamId,
    source: extra.source ?? "Shopify",
    createdAt,
    lastContact: last ? { at: last.at, channel: c.channel } : null,
    conversationId: c.status === "spam" ? undefined : c.id,
    duplicateOf: extra.duplicateOf,
    deals: c.contact.deals,
    tasks: c.contact.tasks,
    orders: c.contact.orders,
    timeline: timeline.sort((a, b) => b.at - a.at),
  };
}

export function buildCustomers(data: InboxData): Customer[] {
  const { now, teams, people } = data;
  const byName = (n: string) => people.find((p) => p.name === n)?.id ?? null;
  const team = (needle: string) => teams.find((t) => t.name.toLowerCase().includes(needle))?.id ?? teams[0]?.id ?? "";

  const fromChats = data.conversations.filter((c) => c.status !== "spam").map((c) => fromConversation(c, data));

  const quiet: Customer[] = [
    {
      id: "m-haddad",
      name: "M. Haddad",
      company: "Haddad Interiors",
      email: "m.haddad@haddadinteriors.co.uk",
      language: "English",
      area: "London, UK",
      type: "Business",
      lifecycle: "lead",
      companyId: "co-haddad",
      identities: [{ ch: "email", handle: "m.haddad@haddadinteriors.co.uk" }],
      consent: { email: { status: "unknown" } },
      fields: {},
      tags: ["Wholesale"],
      ownerId: byName("Marcus"),
      teamId: team("sales"),
      source: "Email",
      createdAt: now - 60 * DAY,
      lastContact: { at: now - 41 * DAY, channel: "email" },
      duplicateOf: "mariam",
      deals: [],
      tasks: [],
      orders: [],
      timeline: [
        { id: "mh-1", at: now - 41 * DAY, kind: "email", title: { key: "timeline.emailSubject", vars: { subject: "Trade prices for a hotel project" } }, body: "Could you share trade prices for floor and table lamps? We may need 10 to 15 units next quarter." },
      ],
    },
    {
      id: "olivia",
      name: "Olivia Bennett",
      phone: "+44 7700 900877",
      language: "English",
      area: "Edinburgh, UK",
      type: "VIP",
      lifecycle: "repeat",
      identities: [{ ch: "whatsapp", handle: "+44 7700 900877" }, { ch: "instagram", handle: "@olivia.bennett" }],
      consent: { whatsapp: { status: "in", at: now - 400 * DAY, source: "Checkout" }, instagram: { status: "unknown" } },
      fields: { tier: "Gold", birthday: "1988-11-03" },
      tags: ["VIP"],
      ownerId: byName("Marcus"),
      teamId: team("sales"),
      source: "Instagram",
      createdAt: now - 400 * DAY,
      lastContact: { at: now - 9 * DAY, channel: "whatsapp" },
      deals: [{ id: "k1", title: "Living room: 3 Aura lamps and 2 Pebble speakers", fils: 90_800, stage: "quoted", ownerId: byName("Marcus") ?? "" }],
      tasks: [],
      orders: [{ no: "#NW-4011", fils: 64_900, state: "Delivered", source: "Shopify" }],
      timeline: [
        { id: "o-1", at: now - 9 * DAY, kind: "chat", title: { key: "timeline.messages", vars: { channel: { t: "channels.whatsapp" }, count: 4 } }, body: "Does the Aura lamp come in brushed brass?" },
        { id: "o-2", at: now - 9 * DAY + 3600_000, kind: "deal", title: { key: "timeline.deal", vars: { title: "Living room: 3 Aura lamps and 2 Pebble speakers" } }, body: "quoted" },
        { id: "o-3", at: now - 70 * DAY, kind: "order", title: { key: "timeline.order", vars: { source: { t: "values.orderSource.Shopify" }, no: "#NW-4011" } }, body: "Delivered" },
      ],
    },
    {
      id: "amelia",
      name: "Amelia Ross",
      company: "Bright Dental Group Inc.",
      email: "purchasing@brightdental.ca",
      phone: "+1 416 555 0122",
      language: "English",
      area: "Toronto, Canada",
      type: "Business",
      lifecycle: "lead",
      companyId: "co-bright",
      identities: [{ ch: "email", handle: "purchasing@brightdental.ca" }, { ch: "voice", handle: "+1 416 555 0122" }],
      consent: { email: { status: "in", at: now - 120 * DAY, source: "Website form" } },
      fields: {},
      tags: ["Wholesale"],
      ownerId: byName("Leo"),
      teamId: team("sales"),
      source: "Referral",
      createdAt: now - 120 * DAY,
      lastContact: { at: now - 16 * DAY, channel: "email" },
      deals: [{ id: "c1", title: "40 x Breeze purifier for clinic waiting rooms", fils: 875_000, stage: "new", ownerId: byName("Leo") ?? "" }],
      tasks: [{ id: "ct1", text: "Call to confirm delivery sites", ownerId: byName("Leo") ?? "", due: "Tomorrow", done: false }],
      orders: [],
      timeline: [
        { id: "b-1", at: now - 16 * DAY, kind: "email", title: { key: "timeline.emailSubject", vars: { subject: "Air purifiers for 8 clinics" } }, body: "Please find attached our requirements for 40 purifiers across 8 clinics." },
        { id: "b-2", at: now - 15 * DAY, kind: "deal", title: { key: "timeline.deal", vars: { title: "40 x Breeze purifier for clinic waiting rooms" } }, body: "new" },
      ],
    },
    {
      id: "sunita",
      name: "Sunita Rao",
      phone: "+91 98201 33456",
      language: "English",
      area: "Pune, India",
      type: "Individual",
      lifecycle: "churned",
      identities: [{ ch: "whatsapp", handle: "+91 98201 33456" }],
      consent: { whatsapp: { status: "out", at: now - 30 * DAY, source: "Asked to stop" } },
      fields: { tier: "Bronze" },
      tags: ["Warranty"],
      ownerId: null,
      teamId: team("support"),
      source: "Shopify",
      createdAt: now - 45 * DAY,
      lastContact: { at: now - 38 * DAY, channel: "whatsapp" },
      deals: [],
      tasks: [],
      orders: [],
      timeline: [{ id: "s-1", at: now - 38 * DAY, kind: "chat", title: { key: "timeline.messages", vars: { channel: { t: "channels.whatsapp" }, count: 3 } }, body: "Thank you, the speaker works perfectly now." }],
    },
  ];

  // Same email domain as a company, not yet linked: a person confirms (decided 2026-10-07).
  quiet.push({
    id: "tomas",
    name: "Tomás Silva",
    email: "tomas@hearthandco.pt",
    language: "English",
    area: "Porto, Portugal",
    type: "Individual",
    lifecycle: "lead",
    companySuggestion: "co-hearth",
    identities: [{ ch: "email", handle: "tomas@hearthandco.pt" }],
    consent: { email: { status: "unknown" } },
    fields: {},
    tags: [],
    ownerId: null,
    teamId: team("sales"),
    source: "Website form",
    createdAt: now - 3 * DAY,
    lastContact: { at: now - 3 * DAY, channel: "email" },
    deals: [],
    tasks: [],
    orders: [],
    timeline: [{ id: "ts-1", at: now - 3 * DAY, kind: "email", title: { key: "timeline.emailSubject", vars: { subject: "Catalogue for our new store" } }, body: "Could you send your trade catalogue? We open a second store in Lisbon in spring." }],
  });

  return [...fromChats, ...quiet].sort((a, b) => (b.lastContact?.at ?? 0) - (a.lastContact?.at ?? 0));
}

/** Saved segments (decided 2026-09-30): point-and-click filters that update themselves. Names: customers.segments.<key>. */
export const SEGMENTS = [
  { key: "all", test: () => true },
  { key: "b2b", test: (c: Customer) => c.type === "Business" },
  { key: "vip", test: (c: Customer) => c.type === "VIP" },
  { key: "open-deal", test: (c: Customer) => c.deals.some((d) => d.stage === "new" || d.stage === "quoted" || d.stage === "negotiating") },
  { key: "quiet", test: (c: Customer, now: number) => !c.lastContact || now - c.lastContact.at > 30 * DAY },
] as const;

/** Companies with their people, built from the same sample customers. */
export function buildCompanies(data: InboxData, customers: Customer[]) {
  const ownerOf = (name: string) => data.people.find((p) => p.name === name)?.id ?? null;
  return SAMPLE_COMPANIES(data.now, ownerOf).map((co) => ({ ...co, people: customers.filter((c) => c.companyId === co.id) }));
}
