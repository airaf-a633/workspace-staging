import type { Conversation, InboxData } from "@/components/inbox/types";
import type { Line } from "@/i18n/labels";
import type { Customer, TimelineItem } from "./types";

/**
 * Sample customers for the preview, built from the same sample chats as the inbox so every screen agrees,
 * plus a few customers who haven't written recently (and one likely duplicate, to show merging).
 */

const DAY = 86_400_000;
const DUBAI = 4 * 3600_000;
/** Same calendar day in Dubai (UTC+4, no daylight saving). */
const sameDay = (a: number, b: number) => Math.floor((a + DUBAI) / DAY) === Math.floor((b + DUBAI) / DAY);
const EXTRA_FIELDS: Record<string, Partial<Customer>> = {
  mariam: { area: "Business Bay", type: "Business", source: "WhatsApp ad", duplicateOf: "m-suwaidi" },
  ahmed: { area: "Al Quoz", type: "Business", source: "Email" },
  george: { area: "Deira", type: "Individual", source: "WhatsApp" },
  fatima: { area: "Deira", type: "Individual", source: "Walk-in" },
  rahul: { area: "Dubai Marina", type: "Individual", source: "Shopify" },
  noura: { area: "Mirdif", type: "Individual", source: "Shopify" },
  lina: { area: "Jumeirah", type: "Individual", source: "Shopify" },
  deepak: { area: "Karama", type: "Individual", source: "WhatsApp" },
  yousef: { area: "Al Barsha", type: "Individual", source: "Imported from phone" },
};

function fromConversation(c: Conversation, data: InboxData): Customer {
  const name = (id: string | undefined | null) => data.people.find((p) => p.id === id)?.name ?? "";
  const timeline: TimelineItem[] = [];
  const messages = (count: number): Line => ({ key: "timeline.messages", vars: { channel: { t: `timeline.channel.${c.channel}` }, count } });

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
    if (run && sameDay(run.last, m.at)) {
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
  return {
    id: c.id,
    name: c.contact.name,
    company: c.contact.company,
    phone: c.contact.phone,
    email: c.contact.email,
    language: c.contact.language,
    area: extra.area,
    type: extra.type ?? "Individual",
    tags: c.contact.tags,
    ownerId: c.holderId ?? c.contact.deals[0]?.ownerId ?? null,
    teamId: c.teamId,
    source: extra.source ?? "WhatsApp",
    createdAt: (real[0]?.at ?? data.now) - 20 * DAY,
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
      id: "m-suwaidi",
      name: "M. Suwaidi",
      company: "Suwaidi Trading LLC",
      email: "mariam@suwaidi-trading.ae",
      language: "English",
      type: "Business",
      tags: ["B2B"],
      ownerId: byName("Sara"),
      teamId: team("deira"),
      source: "Outlook",
      createdAt: now - 60 * DAY,
      lastContact: { at: now - 41 * DAY, channel: "email" },
      duplicateOf: "mariam",
      deals: [],
      tasks: [],
      orders: [],
      timeline: [
        { id: "ms-1", at: now - 41 * DAY, kind: "email", title: { key: "timeline.emailSubject", vars: { subject: "Request for laptop prices" } }, body: "Could you share your prices for business laptops? We may need 10 to 15 units next quarter." },
      ],
    },
    {
      id: "khalifa",
      name: "Khalifa Al Mazrouei",
      phone: "+971 50 900 1177",
      language: "Arabic",
      area: "Jumeirah",
      type: "VIP",
      tags: ["VIP", "Apple"],
      ownerId: byName("Sara"),
      teamId: team("mall"),
      source: "Walk-in",
      createdAt: now - 400 * DAY,
      lastContact: { at: now - 9 * DAY, channel: "whatsapp" },
      deals: [{ id: "k1", title: "MacBook Pro 16 x 2 for family", fils: 2_199_800, stage: "quoted", ownerId: byName("Sara") ?? "" }],
      tasks: [],
      orders: [{ no: "#QE-2011", fils: 649_900, state: "Delivered", source: "Shopify" }],
      timeline: [
        { id: "k-1", at: now - 9 * DAY, kind: "chat", title: { key: "timeline.messages", vars: { channel: { t: "timeline.channel.whatsapp" }, count: 4 } }, body: "هل يتوفر ماك بوك برو باللون الفضي؟" },
        { id: "k-2", at: now - 9 * DAY + 3600_000, kind: "deal", title: { key: "timeline.deal", vars: { title: "MacBook Pro 16 x 2 for family" } }, body: "quoted" },
        { id: "k-3", at: now - 70 * DAY, kind: "order", title: { key: "timeline.order", vars: { source: { t: "values.orderSource.Shopify" }, no: "#QE-2011" } }, body: "Delivered" },
      ],
    },
    {
      id: "clinics",
      name: "Emirates Family Clinics",
      company: "Emirates Family Clinics LLC",
      email: "procurement@efclinics.ae",
      phone: "+971 4 388 2200",
      language: "English",
      area: "Al Barsha",
      type: "Business",
      tags: ["B2B", "Healthcare"],
      ownerId: byName("Hana"),
      teamId: team("deira"),
      source: "Referral",
      createdAt: now - 120 * DAY,
      lastContact: { at: now - 16 * DAY, channel: "email" },
      deals: [{ id: "c1", title: "25 x Dell OptiPlex for reception desks", fils: 8_750_000, stage: "new", ownerId: byName("Hana") ?? "" }],
      tasks: [{ id: "ct1", text: "Call to confirm delivery sites", ownerId: byName("Hana") ?? "", due: "Tomorrow", done: false }],
      orders: [],
      timeline: [
        { id: "c-1", at: now - 16 * DAY, kind: "email", title: { key: "timeline.emailSubject", vars: { subject: "Tender: reception desktops" } }, body: "Please find attached our requirements for 25 desktops across 5 branches." },
        { id: "c-2", at: now - 15 * DAY, kind: "deal", title: { key: "timeline.deal", vars: { title: "25 x Dell OptiPlex for reception desks" } }, body: "new" },
      ],
    },
    {
      id: "sunita",
      name: "Sunita Rao",
      phone: "+971 55 301 6620",
      language: "English",
      area: "Karama",
      type: "Individual",
      tags: ["Repairs"],
      ownerId: null,
      teamId: team("deira"),
      source: "WhatsApp",
      createdAt: now - 45 * DAY,
      lastContact: { at: now - 38 * DAY, channel: "whatsapp" },
      deals: [],
      tasks: [],
      orders: [],
      timeline: [{ id: "s-1", at: now - 38 * DAY, kind: "chat", title: { key: "timeline.messages", vars: { channel: { t: "timeline.channel.whatsapp" }, count: 3 } }, body: "Thank you, the laptop works perfectly now." }],
    },
  ];

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
