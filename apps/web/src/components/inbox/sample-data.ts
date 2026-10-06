import type { ChannelInbox, Conversation, InboxData, Label, Message, Person, Team, ViewerInfo } from "./types";

/**
 * Sample conversations for Northwind Home (decided 2026-10-07): a global online brand selling home goods and
 * small electronics, with one conversation on each connected channel so every channel's own rules show.
 *
 * They're bound to the real workspace: sample people match real members by first name, and sample teams match
 * real teams by name ("Sales", "Support"). Anyone missing becomes a "sample teammate" who exists only here, so
 * every workspace sees the full story. Customer messages are sample content and stay as written in every language.
 */

const SAMPLE_PEOPLE = [
  { key: "elena", name: "Elena", role: "Owner" },
  { key: "marcus", name: "Marcus", role: "Sales manager" },
  { key: "priya", name: "Priya", role: "Support manager" },
  { key: "kenji", name: "Kenji", role: "Operations manager" },
  { key: "leo", name: "Leo", role: "Agent" },
] as const;
type PersonKey = (typeof SAMPLE_PEOPLE)[number]["key"];
type TeamKey = "sales" | "support" | "general";

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

/** The channel accounts Northwind Home has connected. Instagram's login has expired, to show a broken channel. */
export const SAMPLE_INBOXES: ChannelInbox[] = [
  { id: "in-wa", channel: "whatsapp", name: "WhatsApp", address: "+1 415 555 0134" },
  { id: "in-web", channel: "webchat", name: "Website chat", address: "northwindhome.com" },
  { id: "in-support", channel: "email", name: "Support", address: "support@northwindhome.com" },
  { id: "in-wholesale", channel: "email", name: "Wholesale", address: "wholesale@northwindhome.com" },
  { id: "in-ig", channel: "instagram", name: "Instagram", address: "@northwindhome", broken: "tokenExpired" },
  { id: "in-fb", channel: "messenger", name: "Messenger", address: "Northwind Home" },
  { id: "in-tg", channel: "telegram", name: "Telegram", address: "@northwindhome_bot" },
  { id: "in-sms", channel: "sms", name: "SMS", address: "+1 415 555 0177" },
  { id: "in-voice", channel: "voice", name: "Phone", address: "+1 415 555 0100" },
  { id: "in-line", channel: "line", name: "LINE Japan", address: "Northwind Home JP" },
  { id: "in-tt", channel: "tiktok", name: "TikTok", address: "@northwindhome" },
  { id: "in-slack", channel: "slack", name: "Slack Connect", address: "#northwind-hearth" },
  { id: "in-discord", channel: "discord", name: "Community", address: "Northwind Discord" },
];

export const SAMPLE_LABELS: Label[] = [
  { id: "l-vip", name: "VIP", color: "#B7791F" },
  { id: "l-wholesale", name: "Wholesale", color: "#0A5670" },
  { id: "l-order", name: "Order issue", color: "#C2410C" },
  { id: "l-warranty", name: "Warranty", color: "#4D7C0F" },
  { id: "l-feedback", name: "Product feedback", color: "#475569" },
];

const MIN = 60_000;
const HOUR = 60;
const DAY = 24 * HOUR;

export function buildSampleInbox(members: RealMember[], realTeams: RealTeam[], viewer: ViewerInfo, tz: string, now = Date.now()): InboxData {
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
  const team = (key: TeamKey) => (key === "general" ? fallback : realTeams.find((t) => t.name.toLowerCase().includes(key)) ?? fallback).id;
  const teams: Team[] = realTeams.map((t) => ({ id: t.id, name: t.name }));

  const at = (minutesAgo: number) => now - minutesAgo * MIN;
  let seq = 0;
  const msg = (minutesAgo: number, m: Omit<Message, "id" | "at">): Message => ({ id: `s${++seq}`, at: at(minutesAgo), ...m });
  const base = { collaboratorIds: [], handoffs: [], labels: [] as string[] };

  const conversations: Conversation[] = [
    {
      ...base,
      id: "mariam",
      channel: "whatsapp",
      inboxId: "in-wa",
      labels: ["l-wholesale"],
      aiSuggestion: "Hi Mariam, delivery is booked for Thursday between 10:00 and 12:00 at the goods entrance. Our driver will call you ten minutes before arriving.",
      teamId: team("sales"),
      holderId: ids.kenji,
      trail: [ids.leo, ids.marcus, ids.kenji],
      status: "open",
      unread: 2,
      lastCustomerAt: at(4),
      phoneReply: { authorId: ids.elena, draft: "Hi Mariam, delivery is confirmed for Thursday between 10:00 and 12:00." },
      contact: {
        id: "ct-mariam",
        name: "Mariam Haddad",
        phone: "+44 7700 900412",
        email: "mariam@haddadinteriors.co.uk",
        company: "Haddad Interiors",
        location: "London, UK",
        language: "English",
        tags: ["Wholesale"],
        identities: [
          { ch: "whatsapp", handle: "+44 7700 900412" },
          { ch: "email", handle: "mariam@haddadinteriors.co.uk" },
        ],
        merge: { name: "M. Haddad", ch: "email", handle: "m.haddad@haddadinteriors.co.uk", reason: "sameName" },
        past: [{ id: "p-m1", ch: "email", at: at(41 * DAY), summary: "Asked for trade prices on lighting for a hotel project." }],
        deals: [{ id: "d1", title: "12 x Aura floor lamp for a hotel lobby", fils: 276_000, stage: "won", ownerId: ids.marcus }],
        tasks: [{ id: "t1", text: "Confirm Thursday delivery slot", ownerId: ids.kenji, due: "Thursday", done: false }],
        orders: [{ no: "#NW-4821", fils: 276_000, state: "Paid, not yet sent", source: "Shopify" }],
      },
      handoffs: [
        { fromId: ids.leo, toId: ids.marcus, toTeamId: null, at: at(150), note: "Asking for 10% off 12 lamps. Needs a manager to approve the discount." },
        { fromId: ids.marcus, toId: ids.kenji, toTeamId: null, at: at(58), note: "Deal won, $2,760.00, invoice paid. Needs delivery to Shoreditch by Thursday. Customer wants a call before arrival." },
      ],
      messages: [
        msg(180, { kind: "in", text: "Hi, do you have the Aura floor lamp in stock? I need 12 for a hotel lobby." }),
        msg(177, { kind: "out", authorId: ids.leo, status: "read", text: "Hello Mariam, yes, we have 12 in stock. I'll send you a quote now." }),
        msg(160, { kind: "in", edited: true, text: "Thanks. Can you do 10% off for 12? We pay by bank transfer." }),
        msg(150, { kind: "event", event: { key: "handedToPerson", by: ids.leo, to: ids.marcus } }),
        msg(140, { kind: "note", authorId: ids.marcus, text: "Approved 8% for 12 units. Final $2,760.00 including shipping." }),
        msg(136, { kind: "out", authorId: ids.marcus, status: "read", reaction: "👍", text: "Hi Mariam, the best we can do is 8% off: $2,760.00 for all 12, shipping included. Quote attached." }),
        msg(135, { kind: "out", authorId: ids.marcus, status: "read", media: { type: "document", name: "Quote-NW-Q-0412.pdf", size: 188_416 } }),
        msg(66, { kind: "in", text: "Deal. Invoice paid. When can you deliver to Shoreditch?" }),
        msg(65, { kind: "in", media: { type: "voice", duration: "0:38", transcript: "Hi, it's Mariam. Please deliver to the goods entrance at the back, not reception. Call me when you're ten minutes away." } }),
        msg(58, { kind: "event", event: { key: "handedToPerson", by: ids.marcus, to: ids.kenji } }),
        msg(6, { kind: "in", media: { type: "location", name: "The Rosebery Hotel, 12 Curtain Road, London" } }),
        msg(5, { kind: "in", media: { type: "photo", caption: "This is the goods entrance", size: 1_258_291 } }),
        msg(5, { kind: "in", deleted: true }),
        msg(4, { kind: "in", text: "Thursday would be ideal. Please call before arriving." }),
        msg(1, {
          kind: "out",
          authorId: ids.elena,
          source: "phone",
          status: "delivered",
          replyTo: { author: "Mariam", text: "Thursday would be ideal. Please call before arriving." },
          text: "Thank you Mariam, we'll make sure it arrives on Thursday.",
        }),
      ],
    },
    {
      ...base,
      id: "daniel",
      channel: "webchat",
      inboxId: "in-web",
      labels: ["l-order"],
      aiSuggestion: "Sorry about that, Daniel. I've opened a delivery check with the courier and will update you by email within the hour.",
      teamId: team("support"),
      holderId: null,
      trail: [],
      status: "open",
      unread: 3,
      lastCustomerAt: at(47),
      visitor: { page: "northwindhome.com/orders/NW-4790", browser: "Chrome on Android", online: false },
      contact: {
        id: "ct-daniel",
        name: "Daniel Okafor",
        email: "daniel.okafor@gmail.com",
        location: "Lagos, Nigeria",
        language: "English",
        tags: [],
        identities: [
          { ch: "webchat", handle: "northwindhome.com" },
          { ch: "email", handle: "daniel.okafor@gmail.com" },
        ],
        deals: [],
        tasks: [],
        orders: [{ no: "#NW-4790", fils: 8_900, state: "Delivered", source: "Shopify" }],
      },
      messages: [
        msg(49, { kind: "in", text: "Hi, my order NW-4790 says delivered but it isn't here." }),
        msg(48, { kind: "in", text: "I've checked with my neighbours too." }),
        msg(47, { kind: "in", text: "Is anyone there?" }),
      ],
    },
    {
      ...base,
      id: "lukas",
      channel: "email",
      inboxId: "in-wholesale",
      labels: ["l-wholesale"],
      subject: "Invoice INV-2207 for Q3 stock",
      aiSuggestion: "Hi Lukas,\n\nYes, we can add 20 Pebble speakers to Thursday's pallet. I'll send an updated invoice today.\n\nKenji",
      teamId: team("sales"),
      holderId: ids.kenji,
      trail: [ids.kenji],
      status: "open",
      unread: 1,
      lastCustomerAt: at(95),
      contact: {
        id: "ct-lukas",
        name: "Lukas Weber",
        email: "l.weber@hausundlicht.de",
        company: "Haus & Licht GmbH",
        location: "Munich, Germany",
        language: "English",
        tags: ["Wholesale"],
        identities: [{ ch: "email", handle: "l.weber@hausundlicht.de" }],
        past: [{ id: "p-l1", ch: "email", at: at(92 * DAY), summary: "Q2 order: 1 pallet of table lamps, paid on time." }],
        deals: [{ id: "d3", title: "20 x Pebble speaker add-on", fils: 159_800, stage: "quoted", ownerId: ids.marcus }],
        tasks: [{ id: "t2", text: "Send tracking for the Q3 pallet", ownerId: ids.kenji, due: "Thursday", done: false }],
        orders: [{ no: "#NW-4702", fils: 1_840_000, state: "Paid, not yet sent", source: "Orders pack" }],
      },
      messages: [
        msg(26 * HOUR, {
          kind: "in",
          email: { to: "wholesale@northwindhome.com", cc: ["einkauf@hausundlicht.de"] },
          text: "Hello Kenji,\n\nAttached is our payment confirmation for invoice INV-2207. Could you confirm the pallet ships this week?\n\nBest regards,\nLukas Weber\nPurchasing, Haus & Licht GmbH",
          media: { type: "document", name: "Payment-INV-2207.pdf", size: 96_256 },
        }),
        msg(25 * HOUR, {
          kind: "out",
          authorId: ids.kenji,
          status: "delivered",
          email: { to: "l.weber@hausundlicht.de", cc: ["einkauf@hausundlicht.de"], quoted: "Attached is our payment confirmation for invoice INV-2207. Could you confirm the pallet ships this week?" },
          text: "Hi Lukas,\n\nThanks, payment received. The pallet leaves our Rotterdam warehouse on Thursday; I'll send tracking then.\n\nKenji",
        }),
        msg(95, {
          kind: "in",
          email: { to: "wholesale@northwindhome.com", cc: ["einkauf@hausundlicht.de"], quoted: "The pallet leaves our Rotterdam warehouse on Thursday; I'll send tracking then." },
          text: "Thanks Kenji. One more thing: can you add 20 Pebble speakers to the same pallet?\n\nLukas",
        }),
      ],
    },
    {
      ...base,
      id: "sofia",
      channel: "instagram",
      inboxId: "in-ig",
      aiSuggestion: "Hi Sofia! Yes, we ship to Lisbon in 3 to 5 working days, and shipping is free over $150.",
      teamId: team("sales"),
      holderId: null,
      trail: [],
      status: "open",
      unread: 2,
      lastCustomerAt: at(19),
      contact: {
        id: "ct-sofia",
        name: "Sofia Martins",
        location: "Lisbon, Portugal",
        language: "English",
        tags: [],
        identities: [{ ch: "instagram", handle: "@sofia.martins" }],
        merge: { name: "Sofia Martins", ch: "email", handle: "sofia.martins@sapo.pt", reason: "sameName" },
        deals: [],
        tasks: [],
        orders: [],
      },
      messages: [
        msg(20, { kind: "in", story: { kind: "reply", caption: "New in: the Cloud table lamp" }, text: "Do you ship to Lisbon? 😍" }),
        msg(19, { kind: "in", text: "And how long does it take?" }),
      ],
    },
    {
      ...base,
      id: "aiko",
      channel: "line",
      inboxId: "in-line",
      teamId: team("support"),
      holderId: ids.priya,
      trail: [ids.priya],
      status: "open",
      unread: 0,
      lastCustomerAt: at(20 * HOUR),
      contact: {
        id: "ct-aiko",
        name: "Aiko Tanaka",
        location: "Osaka, Japan",
        language: "Japanese",
        tags: [],
        identities: [{ ch: "line", handle: "Aiko T." }],
        deals: [],
        tasks: [{ id: "t3", text: "Check the JP adapter is in every Halo box", ownerId: ids.kenji, due: "Friday", done: false }],
        orders: [{ no: "#NW-4711", fils: 12_900, state: "Delivered", source: "Shopify" }],
      },
      messages: [
        msg(2 * DAY, { kind: "in", text: "電源アダプターが日本のコンセントに合いません。", translation: { en: "The power adapter doesn't fit Japanese sockets.", ar: "محوّل الطاقة لا يناسب المقابس اليابانية." } }),
        msg(2 * DAY - 40, { kind: "out", authorId: ids.priya, status: "read", text: "申し訳ありません。日本用のアダプターを無料でお送りします。" }),
        msg(20 * HOUR, { kind: "in", text: "アダプターが届きました。ありがとうございます！", translation: { en: "The adapter arrived. Thank you!", ar: "وصل المحوّل. شكرًا!" } }),
      ],
    },
    {
      ...base,
      id: "omar",
      channel: "telegram",
      inboxId: "in-tg",
      aiSuggestion: "Hi Omar, the Halo desk lamp is back in stock. Shall I reserve two for you?",
      teamId: team("sales"),
      holderId: null,
      trail: [],
      status: "open",
      unread: 1,
      lastCustomerAt: at(9),
      contact: { id: "ct-omar", name: "Omar Haddad", location: "Dubai, UAE", language: "English", tags: [], identities: [{ ch: "telegram", handle: "@omarh" }], deals: [], tasks: [], orders: [] },
      messages: [msg(9, { kind: "in", text: "Is the Halo desk lamp back in stock? I need two." })],
    },
    {
      ...base,
      id: "george",
      channel: "sms",
      inboxId: "in-sms",
      aiSuggestion: "Hi George, yes: the Breeze replacement filter is $24.90, or $44.90 for two. Want me to text you the link?",
      teamId: team("support"),
      holderId: null,
      trail: [],
      status: "open",
      unread: 2,
      lastCustomerAt: at(12),
      contact: {
        id: "ct-george",
        name: "George Mathew",
        phone: "+1 646 555 0193",
        location: "New York, USA",
        language: "English",
        tags: [],
        identities: [
          { ch: "sms", handle: "+1 646 555 0193" },
          { ch: "whatsapp", handle: "+1 646 555 0193" },
        ],
        deals: [],
        tasks: [],
        orders: [{ no: "#NW-4655", fils: 21_900, state: "Delivered", source: "Shopify" }],
      },
      messages: [
        msg(42, { kind: "in", text: "Hi, do you sell replacement filters for the Breeze air purifier?" }),
        msg(12, { kind: "in", text: "Hello?" }),
      ],
    },
    {
      ...base,
      id: "grace",
      channel: "voice",
      inboxId: "in-voice",
      labels: ["l-order"],
      teamId: team("support"),
      holderId: ids.leo,
      trail: [ids.leo],
      status: "open",
      unread: 1,
      lastCustomerAt: at(35),
      contact: {
        id: "ct-grace",
        name: "Grace Kim",
        phone: "+1 212 555 0148",
        location: "New York, USA",
        language: "English",
        tags: [],
        identities: [
          { ch: "voice", handle: "+1 212 555 0148" },
          { ch: "sms", handle: "+1 212 555 0148" },
        ],
        deals: [],
        tasks: [],
        orders: [{ no: "#NW-4802", fils: 18_900, state: "Shipped", source: "Shopify" }],
      },
      messages: [
        msg(3 * DAY, { kind: "in", call: { direction: "in", duration: "4:12", recording: "4:12" } }),
        msg(3 * DAY - 5, { kind: "note", authorId: ids.leo, text: "Walked her through assembling the Nook shelf. All good." }),
        msg(35, {
          kind: "in",
          call: { direction: "in", missed: true, voicemail: "Hi, it's Grace Kim, order 4802. The tracking hasn't moved in four days. Can someone call me back? Thanks." },
        }),
      ],
    },
    {
      ...base,
      id: "tom",
      channel: "messenger",
      inboxId: "in-fb",
      teamId: team("support"),
      holderId: null,
      trail: [],
      status: "open",
      unread: 2,
      lastCustomerAt: at(9),
      sensitive: "payment",
      contact: {
        id: "ct-tom",
        name: "Tom Becker",
        location: "Berlin, Germany",
        language: "English",
        tags: [],
        identities: [{ ch: "messenger", handle: "Tom Becker" }],
        deals: [],
        tasks: [],
        orders: [{ no: "#NW-4775", fils: 32_900, state: "Delivered", source: "Shopify" }],
      },
      messages: [
        msg(11, { kind: "in", text: "I was charged twice for order #NW-4775. $329 taken two times from my card." }),
        msg(9, { kind: "in", text: "If this isn't fixed today I'm filing a chargeback." }),
      ],
    },
    {
      ...base,
      id: "ines",
      channel: "slack",
      inboxId: "in-slack",
      labels: ["l-wholesale", "l-vip"],
      subject: "#northwind-hearth",
      aiSuggestion: "Thanks Ines. 30 Cloud lamps works; I'll put them in the autumn price list with your trade discount.",
      teamId: team("sales"),
      holderId: ids.marcus,
      trail: [ids.marcus],
      status: "open",
      unread: 1,
      lastCustomerAt: at(40),
      contact: {
        id: "ct-ines",
        name: "Ines Duarte",
        email: "ines@hearthandco.pt",
        company: "Hearth & Co",
        location: "Porto, Portugal",
        language: "English",
        tags: ["Wholesale", "VIP"],
        identities: [
          { ch: "slack", handle: "Ines Duarte · Hearth & Co" },
          { ch: "email", handle: "ines@hearthandco.pt" },
        ],
        deals: [{ id: "d4", title: "30 x Cloud table lamp for window displays", fils: 267_000, stage: "negotiating", ownerId: ids.marcus }],
        tasks: [{ id: "t4", text: "Send the autumn price list", ownerId: ids.marcus, due: "Today", done: false }],
        orders: [],
      },
      messages: [
        msg(3 * HOUR, {
          kind: "in",
          text: "Morning! Can we get the autumn price list before Friday? We're planning the window display.",
          thread: { replies: 2, lastName: "Marcus", lastText: "Sending it today." },
        }),
        msg(3 * HOUR - 10, { kind: "out", authorId: ids.marcus, status: "read", text: "Sending it today, Ines." }),
        msg(40, { kind: "in", media: { type: "document", name: "window-plan.pdf", size: 412_000 }, text: "Here's the plan. We'd like 30 of the Cloud lamps." }),
      ],
    },
    {
      ...base,
      id: "nils",
      channel: "discord",
      inboxId: "in-discord",
      labels: ["l-feedback"],
      subject: "#help",
      aiSuggestion: "Thanks for flagging, Nils. We've reproduced the pairing issue on Android 15 and a fix ships this week. Until then, restart the speaker while holding play.",
      teamId: team("support"),
      holderId: null,
      trail: [],
      status: "open",
      unread: 1,
      lastCustomerAt: at(2 * HOUR),
      contact: { id: "ct-nils", name: "Nils Andersson", location: "Stockholm, Sweden", language: "English", tags: [], identities: [{ ch: "discord", handle: "nils_a" }], deals: [], tasks: [], orders: [] },
      messages: [
        msg(2 * HOUR, {
          kind: "in",
          text: "Since the last firmware update my Pebble speaker won't pair with Android 15. Anyone else?",
          thread: { replies: 4, lastName: "kaitlyn.r", lastText: "Same here on a Pixel 9." },
        }),
      ],
    },
    {
      ...base,
      id: "chloe",
      channel: "tiktok",
      inboxId: "in-tt",
      aiSuggestion: "Hi Chloé! The Cloud lamp is $89 and yes, it comes in sage green: northwindhome.com/cloud",
      teamId: team("sales"),
      holderId: null,
      trail: [],
      status: "open",
      unread: 1,
      lastCustomerAt: at(25),
      contact: { id: "ct-chloe", name: "Chloé Dubois", location: "Lyon, France", language: "English", tags: [], identities: [{ ch: "tiktok", handle: "@chloedeco" }], deals: [], tasks: [], orders: [] },
      messages: [msg(25, { kind: "in", text: "saw the cloud lamp in your video!! what's the price and does it come in sage green?" })],
    },
    {
      ...base,
      id: "lina",
      channel: "whatsapp",
      inboxId: "in-wa",
      aiSuggestion: "مرحبًا لينا، يسعدنا أن الطلب وصلك. إذا احتجتِ أي شيء آخر فنحن هنا.",
      teamId: team("support"),
      holderId: ids.priya,
      trail: [ids.priya],
      status: "open",
      unread: 0,
      lastCustomerAt: at(26 * HOUR),
      contact: {
        id: "ct-lina",
        name: "Lina Haddad",
        phone: "+962 79 555 0142",
        location: "Amman, Jordan",
        language: "Arabic",
        tags: [],
        identities: [{ ch: "whatsapp", handle: "+962 79 555 0142" }],
        deals: [],
        tasks: [],
        orders: [{ no: "#NW-4738", fils: 6_490, state: "Delivered", source: "Shopify" }],
      },
      messages: [
        msg(27 * HOUR, { kind: "in", text: "مرحبا، طلبت سماعات يوم الإثنين. هل وصلت الطلبية؟", translation: { en: "Hello, I ordered earphones on Monday. Has the order arrived?" } }),
        msg(26.8 * HOUR, { kind: "out", authorId: ids.priya, status: "read", text: "مرحبًا لينا، الطلب في الطريق وسيصل اليوم قبل الساعة 6 مساءً." }),
        msg(26 * HOUR, { kind: "in", text: "شكرًا", translation: { en: "Thanks" } }),
      ],
    },
    {
      ...base,
      id: "rahul",
      channel: "email",
      inboxId: "in-support",
      labels: ["l-warranty"],
      subject: "Breeze purifier rattling at high speed",
      aiSuggestion: "Hi Rahul,\n\nSorry about the noise. Your purifier is under warranty, so we'll send a replacement fan unit this week at no cost.\n\nPriya",
      teamId: team("support"),
      holderId: null,
      trail: [],
      status: "open",
      unread: 1,
      lastCustomerAt: at(17),
      contact: {
        id: "ct-rahul",
        name: "Rahul Menon",
        email: "rahul.menon@outlook.com",
        phone: "+91 98450 12345",
        location: "Bengaluru, India",
        language: "English",
        tags: ["Warranty"],
        identities: [
          { ch: "email", handle: "rahul.menon@outlook.com" },
          { ch: "whatsapp", handle: "+91 98450 12345" },
        ],
        deals: [],
        tasks: [],
        orders: [{ no: "#NW-4604", fils: 13_900, state: "Delivered", source: "Shopify" }],
      },
      messages: [
        msg(17, {
          kind: "in",
          email: { to: "support@northwindhome.com" },
          text: "Hi,\n\nMy Breeze air purifier, bought last month, has started rattling at high speed. Video attached. Is this covered by the warranty?\n\nThanks,\nRahul",
          media: { type: "video", duration: "0:12", size: 4_404_019, name: "rattle.mp4" },
        }),
      ],
    },
    {
      ...base,
      id: "deepak",
      channel: "webchat",
      inboxId: "in-web",
      teamId: team("sales"),
      holderId: ids.leo,
      trail: [ids.leo],
      status: "resolved",
      unread: 0,
      lastCustomerAt: at(30 * HOUR),
      visitor: { page: "northwindhome.com/shipping", browser: "Safari on iPhone", online: false },
      contact: { id: "ct-deepak", name: "Deepak Nair", location: "Singapore", language: "English", tags: [], identities: [{ ch: "webchat", handle: "northwindhome.com" }], deals: [], tasks: [], orders: [] },
      messages: [
        msg(30 * HOUR, { kind: "in", text: "Do you ship to Singapore?" }),
        msg(29.9 * HOUR, { kind: "out", authorId: ids.leo, status: "read", text: "Yes, in 5 to 7 working days. Shipping is free over $150." }),
        msg(29.8 * HOUR, { kind: "event", event: { key: "resolved", by: ids.leo } }),
      ],
    },
    {
      ...base,
      id: "yousef",
      channel: "whatsapp",
      inboxId: "in-wa",
      teamId: team("general"),
      holderId: null,
      trail: [],
      status: "resolved",
      unread: 0,
      imported: true,
      lastCustomerAt: at(79 * DAY),
      contact: { id: "ct-yousef", name: "Yousef Karim", phone: "+1 415 555 0161", location: "San Francisco, USA", language: "English", tags: [], identities: [{ ch: "whatsapp", handle: "+1 415 555 0161" }], deals: [], tasks: [], orders: [] },
      messages: [
        msg(79 * DAY + 10, { kind: "event", event: { key: "imported" } }),
        msg(79 * DAY + 8, { kind: "in", imported: true, text: "Can you send me your repairs desk number?" }),
        msg(79 * DAY + 5, { kind: "out", imported: true, authorId: ids.elena, source: "phone", media: { type: "contact", name: "Northwind Repairs", phone: "+1 415 555 0100" } }),
        msg(79 * DAY, { kind: "in", imported: true, media: { type: "sticker" } }),
      ],
    },
    {
      ...base,
      id: "spam1",
      channel: "sms",
      inboxId: "in-sms",
      teamId: team("support"),
      holderId: null,
      trail: [],
      status: "spam",
      unread: 0,
      lastCustomerAt: at(300),
      contact: { id: "ct-spam1", name: "+1 305 555 0110", phone: "+1 305 555 0110", language: "English", tags: [], identities: [{ ch: "sms", handle: "+1 305 555 0110" }], deals: [], tasks: [], orders: [] },
      messages: [
        msg(300, { kind: "in", text: "Earn $5,000 a day from home!! Reply YES to join our investment group" }),
        msg(290, { kind: "event", event: { key: "spam", by: ids.priya } }),
      ],
    },
  ];

  return { now, tz, people, teams, viewer, conversations, inboxes: SAMPLE_INBOXES, labels: SAMPLE_LABELS };
}
