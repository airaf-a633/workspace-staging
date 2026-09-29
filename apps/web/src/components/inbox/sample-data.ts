import type { Conversation, InboxData, Message, Person, Team, ViewerInfo } from "./types";

/**
 * Sample chats for Qamar Electronics, shown until a WhatsApp number is connected.
 *
 * They're bound to the real workspace: sample people match real members by first name (the seed
 * has Khalid, Sara, Omar, Priya, Hana and Aisha), and sample teams match real teams by name. Anyone
 * missing becomes a "sample teammate" who exists only here, so every workspace sees the full story.
 */

const SAMPLE_PEOPLE = [
  { key: "khalid", name: "Khalid", role: "Owner" },
  { key: "sara", name: "Sara", role: "Sales manager" },
  { key: "omar", name: "Omar", role: "Support manager" },
  { key: "priya", name: "Priya", role: "Operations manager" },
  { key: "hana", name: "Hana", role: "Sales agent" },
] as const;
type PersonKey = (typeof SAMPLE_PEOPLE)[number]["key"];
type TeamKey = "deira" | "mall" | "general";

export interface RealMember {
  id: string;
  name: string;
  role: string;
  canReply: boolean;
}
export interface RealTeam {
  id: string;
  name: string;
  isDefault: boolean;
}

const MIN = 60_000;

export function buildSampleInbox(members: RealMember[], realTeams: RealTeam[], viewer: ViewerInfo, now = Date.now()): InboxData {
  const people: Person[] = members.map((m) => ({ id: m.id, name: m.name, role: m.role, canReply: m.canReply }));
  const ids = {} as Record<PersonKey, string>;
  for (const s of SAMPLE_PEOPLE) {
    const match = members.find((m) => m.name.trim().split(/\s+/)[0].toLowerCase() === s.key);
    if (match) ids[s.key] = match.id;
    else {
      ids[s.key] = `sample-${s.key}`;
      people.push({ id: ids[s.key], name: s.name, role: s.role, canReply: true, sample: true });
    }
  }

  const fallback = realTeams.find((t) => t.isDefault) ?? realTeams[0];
  const team = (key: TeamKey) =>
    (key === "general" ? fallback : realTeams.find((t) => t.name.toLowerCase().includes(key === "deira" ? "deira" : "mall")) ?? fallback).id;
  const teams: Team[] = realTeams.map((t) => ({ id: t.id, name: t.name }));

  const P = (k: PersonKey) => people.find((p) => p.id === ids[k])!;
  const who = (k: PersonKey) => `${P(k).name} (${P(k).role})`;
  const at = (minutesAgo: number) => now - minutesAgo * MIN;
  let seq = 0;
  const msg = (minutesAgo: number, m: Omit<Message, "id" | "at">): Message => ({ id: `s${++seq}`, at: at(minutesAgo), ...m });

  const conversations: Conversation[] = [
    {
      id: "mariam",
      channel: "whatsapp",
      teamId: team("deira"),
      holderId: ids.priya,
      trail: [ids.hana, ids.sara, ids.priya],
      collaboratorIds: [],
      status: "open",
      unread: 2,
      lastCustomerAt: at(4),
      phoneReply: { authorId: ids.khalid, draft: "Hi Mariam, delivery is confirmed for Thursday between 10:00 and 12:00." },
      contact: {
        name: "Mariam Al Suwaidi",
        phone: "+971 50 123 4567",
        email: "mariam@suwaidi-trading.ae",
        company: "Suwaidi Trading LLC",
        language: "English",
        tags: ["B2B", "Bulk buyer"],
        possibleDuplicate: "An Outlook contact with the same company, “M. Suwaidi”, may be the same person. You can merge them from the customer page.",
        deals: [{ id: "d1", title: "12 x ThinkPad E14 for office", fils: 4_260_000, stage: "won", ownerId: ids.sara }],
        tasks: [{ id: "t1", text: "Confirm Thursday delivery slot", ownerId: ids.priya, due: "Thursday", done: false }],
        orders: [{ no: "#QE-2231", fils: 4_260_000, state: "Paid, not yet sent", source: "Shopify" }],
      },
      handoffs: [
        { fromId: ids.hana, toId: ids.sara, toTeamId: null, at: at(150), note: "Asking for 10% off 12 units. Needs a manager to approve the discount." },
        { fromId: ids.sara, toId: ids.priya, toTeamId: null, at: at(58), note: "Deal won, AED 42,600.00, invoice paid. Needs delivery to Business Bay by Thursday. Customer wants a call before arrival." },
      ],
      messages: [
        msg(180, { kind: "in", text: "Hi, do you have the ThinkPad E14 in stock? I need 12 for my office." }),
        msg(177, { kind: "out", authorId: ids.hana, status: "read", text: "Hello Mariam, yes, we have 12 in stock. I'll send you a quote now." }),
        msg(160, { kind: "in", edited: true, text: "Thanks. Can you do 10% off for 12 units? We pay by bank transfer." }),
        msg(150, { kind: "event", text: `${P("hana").name} handed this chat to ${who("sara")}` }),
        msg(140, { kind: "note", authorId: ids.sara, text: "Approved 8% for 12 units. Final AED 42,600.00 including VAT." }),
        msg(136, { kind: "out", authorId: ids.sara, status: "read", reaction: "👍", text: "Hi Mariam, the best we can do is 8% off: AED 42,600.00 for all 12, VAT included. Quote attached." }),
        msg(135, { kind: "out", authorId: ids.sara, status: "read", media: { type: "document", name: "Quote-QE-Q-0412.pdf", size: 188_416 } }),
        msg(66, { kind: "in", text: "Deal. Invoice paid. When can you deliver to Business Bay?" }),
        msg(65, { kind: "in", media: { type: "voice", duration: "0:38" } }),
        msg(58, { kind: "event", text: `${P("sara").name} handed this chat to ${who("priya")}` }),
        msg(6, { kind: "in", media: { type: "location", name: "Bay Square, Building 7, Business Bay" } }),
        msg(5, { kind: "in", media: { type: "photo", caption: "This is the loading entrance", size: 1_258_291 } }),
        msg(5, { kind: "in", deleted: true }),
        msg(4, { kind: "in", text: "Thursday would be ideal. Please call before arriving." }),
        msg(1, {
          kind: "out",
          authorId: ids.khalid,
          source: "phone",
          status: "delivered",
          replyTo: { author: "Mariam", text: "Thursday would be ideal. Please call before arriving." },
          text: "Thank you Mariam, we'll make sure it arrives on Thursday.",
        }),
      ],
    },
    {
      id: "george",
      channel: "whatsapp",
      teamId: team("deira"),
      holderId: null,
      trail: [],
      collaboratorIds: [],
      status: "open",
      unread: 3,
      lastCustomerAt: at(12),
      contact: { name: "George Mathew", phone: "+971 54 330 8812", language: "English", tags: [], deals: [], tasks: [], orders: [] },
      handoffs: [],
      messages: [
        msg(42, { kind: "in", text: "Hi, what's the price for the iPhone 16 Pro 256GB?" }),
        msg(41, { kind: "in", text: "Do you have it in black?" }),
        msg(12, { kind: "in", text: "Hello?" }),
      ],
    },
    {
      id: "rahul",
      channel: "whatsapp",
      teamId: team("mall"),
      holderId: null,
      trail: [],
      collaboratorIds: [],
      status: "open",
      unread: 1,
      lastCustomerAt: at(17),
      contact: { name: "Rahul Menon", phone: "+971 52 610 9924", language: "English", tags: ["Warranty"], deals: [], tasks: [], orders: [{ no: "#QE-2104", fils: 389_900, state: "Delivered", source: "Shopify" }] },
      handoffs: [],
      messages: [
        msg(18, { kind: "in", text: "My laptop screen flickers. I bought it from you last month. Is it under warranty?" }),
        msg(17, { kind: "in", media: { type: "video", duration: "0:12", size: 4_404_019, caption: "The flicker when it wakes up" } }),
      ],
    },
    {
      id: "fatima",
      channel: "whatsapp",
      teamId: team("deira"),
      holderId: ids.hana,
      trail: [ids.hana],
      collaboratorIds: [],
      status: "open",
      unread: 0,
      lastCustomerAt: at(48),
      contact: {
        name: "Fatima Rahman",
        phone: "+971 50 772 0931",
        language: "English",
        tags: ["Repairs"],
        deals: [{ id: "d2", title: "Replacement charger", fils: 18_900, stage: "new", ownerId: ids.hana }],
        tasks: [],
        orders: [],
      },
      handoffs: [],
      messages: [
        msg(50, { kind: "in", text: "My laptop charger stopped working. Do you sell replacements?" }),
        msg(48, { kind: "in", media: { type: "photo", caption: "The charger", size: 842_112 } }),
        msg(35, { kind: "out", authorId: ids.hana, status: "read", text: "Yes, we do. Could you send me the model number on the back of the charger?" }),
      ],
    },
    {
      id: "ahmed",
      channel: "email",
      teamId: team("deira"),
      holderId: ids.sara,
      trail: [ids.sara],
      collaboratorIds: [],
      status: "open",
      unread: 0,
      lastCustomerAt: at(95),
      contact: {
        name: "Ahmed Saeed",
        phone: "+971 4 339 2210",
        email: "ahmed.saeed@saeedcontracting.ae",
        company: "Saeed Contracting",
        language: "English",
        tags: ["B2B"],
        deals: [{ id: "d3", title: "20 x Dell P2723D", fils: 3_180_000, stage: "quoted", ownerId: ids.sara }],
        tasks: [{ id: "t2", text: "Send quotation", ownerId: ids.sara, due: "Today", done: false }],
        orders: [],
      },
      handoffs: [],
      messages: [
        msg(95, {
          kind: "in",
          subject: "Quotation for 20 monitors",
          text: "Dear Sara,\n\nPlease send your best price for 20 x Dell P2723D, delivered to Al Quoz.\n\nRegards,\nAhmed Saeed\nProcurement, Saeed Contracting",
        }),
      ],
    },
    {
      id: "noura",
      channel: "whatsapp",
      teamId: team("mall"),
      holderId: ids.omar,
      trail: [ids.omar],
      collaboratorIds: [],
      status: "open",
      unread: 0,
      lastCustomerAt: at(190),
      contact: { name: "Noura Al Ketbi", phone: "+971 56 118 4420", language: "English", tags: ["Warranty"], deals: [], tasks: [], orders: [{ no: "#QE-2190", fils: 129_900, state: "Delivered", source: "Shopify" }] },
      handoffs: [],
      messages: [
        msg(190, { kind: "in", text: "The earbuds you sent only charge on one side." }),
        msg(150, { kind: "note", authorId: ids.omar, text: `${P("priya").name}, can we courier a replacement to Mirdif instead of asking her to come to the mall?` }),
        msg(140, {
          kind: "out",
          authorId: ids.omar,
          status: "failed",
          error: "Not delivered. WhatsApp didn't say why: the customer may have blocked this number or no longer uses WhatsApp. Try calling, or email if you have an address.",
          text: "Sorry about that, Noura. We'll send a replacement pair to you tomorrow.",
        }),
      ],
    },
    {
      id: "lina",
      channel: "whatsapp",
      teamId: team("mall"),
      holderId: ids.omar,
      trail: [ids.omar],
      collaboratorIds: [],
      status: "open",
      unread: 0,
      lastCustomerAt: at(26 * 60),
      contact: { name: "Lina Haddad", phone: "+971 55 874 1123", language: "Arabic", tags: ["Online shop"], deals: [], tasks: [], orders: [{ no: "#QE-2238", fils: 64_900, state: "Delivered", source: "Shopify" }] },
      handoffs: [],
      messages: [
        msg(27 * 60, { kind: "in", text: "مرحبا، طلبت سماعات يوم الإثنين. هل وصلت الطلبية؟" }),
        msg(26.8 * 60, { kind: "out", authorId: ids.omar, status: "read", text: "مرحبًا لينا، الطلب في الطريق وسيصل اليوم قبل الساعة 6 مساءً." }),
        msg(26 * 60, { kind: "in", text: "شكرًا" }),
      ],
    },
    {
      id: "deepak",
      channel: "whatsapp",
      teamId: team("deira"),
      holderId: ids.hana,
      trail: [ids.hana],
      collaboratorIds: [],
      status: "resolved",
      unread: 0,
      lastCustomerAt: at(30 * 60),
      contact: { name: "Deepak Nair", phone: "+971 58 204 1187", language: "English", tags: [], deals: [], tasks: [], orders: [] },
      handoffs: [],
      messages: [
        msg(30 * 60, { kind: "in", text: "Are you open on Friday evening?" }),
        msg(29.9 * 60, { kind: "out", authorId: ids.hana, status: "read", text: "Yes, both shops are open until 23:00 on Friday." }),
        msg(29.8 * 60, { kind: "event", text: `${P("hana").name} resolved this chat` }),
      ],
    },
    {
      id: "yousef",
      channel: "whatsapp",
      teamId: team("general"),
      holderId: null,
      trail: [],
      collaboratorIds: [],
      status: "resolved",
      unread: 0,
      imported: true,
      lastCustomerAt: at(79 * 24 * 60),
      contact: { name: "Yousef Karim", phone: "+971 56 204 7713", language: "English", tags: [], deals: [], tasks: [], orders: [] },
      handoffs: [],
      messages: [
        msg(79 * 24 * 60 + 10, { kind: "event", text: "History imported from the phone when the number was connected" }),
        msg(79 * 24 * 60 + 8, { kind: "in", imported: true, text: "Can you send me your technician's number?" }),
        msg(79 * 24 * 60 + 5, { kind: "out", imported: true, authorId: ids.khalid, source: "phone", media: { type: "contact", name: "Qamar Service Desk", phone: "+971 4 555 0191" } }),
        msg(79 * 24 * 60, { kind: "in", imported: true, media: { type: "sticker" } }),
      ],
    },
    {
      id: "spam1",
      channel: "whatsapp",
      teamId: team("mall"),
      holderId: null,
      trail: [],
      collaboratorIds: [],
      status: "spam",
      unread: 0,
      lastCustomerAt: at(300),
      contact: { name: "+971 58 000 1122", phone: "+971 58 000 1122", language: "English", tags: [], deals: [], tasks: [], orders: [] },
      handoffs: [],
      messages: [
        msg(300, { kind: "in", text: "Earn AED 5,000 a day from home!! Reply YES to join our investment group" }),
        msg(290, { kind: "event", text: `${P("omar").name} marked this chat as spam` }),
      ],
    },
  ];

  return { now, people, teams, viewer, conversations };
}
