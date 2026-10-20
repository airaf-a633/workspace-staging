import type { ChannelKey } from "@/components/channels/catalog";

/**
 * Campaigns for Northwind Home (decided 2026-10-07): WhatsApp templates, email, SMS, and Messenger/Instagram
 * within Meta's window. Audiences are saved segments with consent enforced: Relay leaves out anyone without
 * opt-in on the channel, anyone marked do-not-contact, and anyone with no handle there, and says how many.
 * Segment sizes are sample figures for a shop with about 12,000 contacts.
 */

export type CampaignChannel = Extract<ChannelKey, "whatsapp" | "email" | "sms" | "messenger" | "instagram">;
export const CAMPAIGN_CHANNELS: CampaignChannel[] = ["whatsapp", "email", "sms", "messenger", "instagram"];

export interface Segment {
  id: string;
  name: string;
  size: number;
}

export const SEGMENTS: Segment[] = [
  { id: "all", name: "All contacts", size: 12_480 },
  { id: "buyers", name: "Bought in the last year", size: 7_920 },
  { id: "vip", name: "VIP", size: 640 },
  { id: "wholesale", name: "Wholesale accounts", size: 410 },
  { id: "halo-waitlist", name: "Waiting list: Halo desk lamp", size: 1_310 },
  { id: "quiet", name: "No contact in 90 days", size: 3_920 },
];

/** How a segment shrinks on one channel. Shares are sample figures; the rule is the real one. */
const REACH: Record<CampaignChannel, { handle: number; consent: number; window?: number }> = {
  whatsapp: { handle: 0.64, consent: 0.74 },
  email: { handle: 0.93, consent: 0.82 },
  sms: { handle: 0.58, consent: 0.61 },
  messenger: { handle: 0.18, consent: 1, window: 0.07 },
  instagram: { handle: 0.27, consent: 1, window: 0.05 },
};
const DNC_SHARE = 0.012;

export function audience(segment: Segment, ch: CampaignChannel) {
  const r = REACH[ch];
  const noHandle = Math.round(segment.size * (1 - r.handle));
  const withHandle = segment.size - noHandle;
  const noConsent = Math.round(withHandle * (1 - r.consent));
  const consented = withHandle - noConsent;
  const dnc = Math.round(consented * DNC_SHARE);
  const afterDnc = consented - dnc;
  // Messenger and Instagram: only people who wrote within Meta's messaging window can be reached.
  const outsideWindow = r.window ? afterDnc - Math.round(afterDnc * r.window) : 0;
  const eligible = afterDnc - outsideWindow;
  return { total: segment.size, eligible, excluded: { noHandle, noConsent, dnc, outsideWindow } };
}

export interface WaTemplate {
  name: string;
  category: "Marketing" | "Utility";
  body: string;
  variables: string[];
}

/** Templates Meta has approved for Northwind Home. {{n}} are filled per customer. */
export const WA_TEMPLATES: WaTemplate[] = [
  { name: "back_in_stock", category: "Marketing", body: "Hi {{1}}, good news: the {{2}} is back in stock. Reply YES and we'll hold one for you for 48 hours.", variables: ["First name", "Product"] },
  { name: "early_access", category: "Marketing", body: "Hi {{1}}, as one of our VIP customers you get early access to {{2}} before anyone else. Reply to reserve.", variables: ["First name", "Collection"] },
  { name: "order_update", category: "Utility", body: "Hi {{1}}, an update on your order {{2}}: {{3}}", variables: ["First name", "Order number", "Update"] },
];

/** Sample per-message rates in US cents (Meta's real rate card applies at send time, by the customer's country). */
export const WA_RATE_CENTS: Record<WaTemplate["category"], number> = { Marketing: 4.2, Utility: 1.1 };
export const SMS_RATE_CENTS = 0.8;

export type CampaignStatus = "draft" | "approval" | "scheduled" | "sent";

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  segment: string;
  status: CampaignStatus;
  createdBy: string;
  approvedBy?: string;
  team: "sales" | "support";
  /** Days from today: negative = in the past. */
  when: number;
  localTime?: string;
  message: { subject?: string; preview?: string; body: string; template?: string };
  ab?: { a: string; b: string; metric: "opened" | "replied"; aPct: number; bPct: number; winner?: "a" | "b" };
  results?: { sent: number; delivered: number; read: number | null; clicked?: number; replied: number; orders: number; optedOut: number };
}

export const CAMPAIGNS: Campaign[] = [
  {
    id: "c1",
    name: "Autumn lighting launch",
    channel: "email",
    segment: "all",
    status: "sent",
    createdBy: "Marcus",
    approvedBy: "Elena",
    team: "sales",
    when: -9,
    message: { subject: "Your evenings, warmer", preview: "Meet the Aura and Cloud autumn finishes.", body: "The nights are drawing in. Meet the new Aura and Cloud finishes in brass, sage and smoke, with free shipping over $150." },
    ab: { a: "New: autumn lighting is here", b: "Your evenings, warmer", metric: "opened", aPct: 41, bPct: 46, winner: "b" },
    results: { sent: 8_420, delivered: 8_211, read: 3_940, clicked: 812, replied: 212, orders: 164, optedOut: 31 },
  },
  {
    id: "c2",
    name: "Back in stock: Halo desk lamp",
    channel: "whatsapp",
    segment: "halo-waitlist",
    status: "sent",
    createdBy: "Leo",
    approvedBy: "Marcus",
    team: "sales",
    when: -2,
    message: { template: "back_in_stock", body: "Hi {{1}}, good news: the {{2}} is back in stock. Reply YES and we'll hold one for you for 48 hours." },
    results: { sent: 1_260, delivered: 1_244, read: 1_102, replied: 188, orders: 97, optedOut: 6 },
  },
  {
    id: "c3",
    name: "Breeze filter reminder",
    channel: "sms",
    segment: "buyers",
    status: "sent",
    createdBy: "Priya",
    approvedBy: "Elena",
    team: "support",
    when: -14,
    message: { body: "Northwind: time to replace your Breeze filter. 2 for $44.90: nwh.co/breeze Reply STOP to opt out." },
    results: { sent: 2_030, delivered: 1_986, read: null, replied: 41, orders: 133, optedOut: 12 },
  },
  {
    id: "c4",
    name: "VIP early access: Nook shelf",
    channel: "whatsapp",
    segment: "vip",
    status: "scheduled",
    createdBy: "Marcus",
    team: "sales",
    when: 1,
    localTime: "10:00",
    message: { template: "early_access", body: "Hi {{1}}, as one of our VIP customers you get early access to {{2}} before anyone else. Reply to reserve." },
  },
  {
    id: "c5",
    name: "Black Friday preview",
    channel: "email",
    segment: "all",
    status: "approval",
    createdBy: "Marcus",
    team: "sales",
    when: 6,
    message: { subject: "Black Friday starts early for you", preview: "24 hours before everyone else.", body: "Our Black Friday prices go live on Thursday. As a Northwind customer you can shop them 24 hours early." },
  },
  {
    id: "c6",
    name: "Cloud lamp: story followers",
    channel: "instagram",
    segment: "all",
    status: "draft",
    createdBy: "Leo",
    team: "sales",
    when: 0,
    message: { body: "Thanks for following our Cloud lamp story! It's $89 and ships in 3 to 5 days: northwindhome.com/cloud" },
  },
];

/** Big sends need an owner or admin to approve (decided 2026-10-07). */
export const APPROVAL_OVER = 1_000;
