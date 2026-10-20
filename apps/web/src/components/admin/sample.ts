import type { ChannelKey } from "@/components/channels/catalog";

/**
 * The Relay staff console's sample data (decided 2026-10-07): every workspace with its plan, seats, revenue and
 * channel health; support access that only exists while an owner has granted it; and the platform's status.
 * Businesses are made up.
 */

export type Plan = "trial" | "starter" | "growth" | "pro";
export type Billing = "ok" | "pastDue" | "cancelled";

export interface StaffWorkspace {
  id: string;
  name: string;
  country: string;
  plan: Plan;
  seats: number;
  /** Monthly recurring revenue in US cents. */
  mrr: number;
  billing: Billing;
  trialDaysLeft?: number;
  channels: ChannelKey[];
  broken: number;
  lastActiveMin: number;
  conversations30d: number;
  /** Minutes of support access left, if the owner granted it. */
  accessMin?: number;
  owner: string;
}

const PRICE = { trial: 0, starter: 19_00, growth: 39_00, pro: 79_00 };
const w = (x: Omit<StaffWorkspace, "mrr">): StaffWorkspace => ({ ...x, mrr: x.billing === "cancelled" ? 0 : PRICE[x.plan] * x.seats });

export const WORKSPACES: StaffWorkspace[] = [
  w({ id: "ws-northwind", name: "Northwind Home", country: "United Kingdom", plan: "growth", seats: 7, billing: "ok", channels: ["whatsapp", "webchat", "email", "instagram", "messenger", "telegram", "sms", "voice", "line", "tiktok", "slack", "discord"], broken: 1, lastActiveMin: 2, conversations30d: 3_409, accessMin: 95, owner: "Elena" }),
  w({ id: "ws-kinfolk", name: "Kinfolk Studios", country: "Denmark", plan: "starter", seats: 3, billing: "ok", channels: ["email", "webchat"], broken: 0, lastActiveMin: 48, conversations30d: 214, owner: "Freja" }),
  w({ id: "ws-bright", name: "Bright Dental Group", country: "Canada", plan: "pro", seats: 24, billing: "ok", channels: ["voice", "sms", "email", "webchat"], broken: 0, lastActiveMin: 6, conversations30d: 6_120, owner: "Amelia" }),
  w({ id: "ws-lumen", name: "Lumen Bikes", country: "Netherlands", plan: "growth", seats: 11, billing: "pastDue", channels: ["whatsapp", "email", "instagram"], broken: 0, lastActiveMin: 15, conversations30d: 1_870, owner: "Daan" }),
  w({ id: "ws-sakura", name: "Sakura Tea House", country: "Japan", plan: "starter", seats: 2, billing: "ok", channels: ["line", "instagram"], broken: 1, lastActiveMin: 600, conversations30d: 96, owner: "Haruka" }),
  w({ id: "ws-andes", name: "Andes Travel", country: "Peru", plan: "trial", seats: 5, billing: "ok", trialDaysLeft: 3, channels: ["whatsapp", "webchat"], broken: 0, lastActiveMin: 30, conversations30d: 402, owner: "Mateo" }),
  w({ id: "ws-harbor", name: "Harbor Coffee Co.", country: "United States", plan: "growth", seats: 9, billing: "ok", channels: ["sms", "email", "webchat", "messenger"], broken: 0, lastActiveMin: 4, conversations30d: 2_215, owner: "Jordan" }),
  w({ id: "ws-veld", name: "Veld Outdoor", country: "South Africa", plan: "trial", seats: 4, billing: "ok", trialDaysLeft: 11, channels: ["whatsapp"], broken: 1, lastActiveMin: 2_880, conversations30d: 38, owner: "Thandi" }),
  w({ id: "ws-mint", name: "Mint Dental Lab", country: "Germany", plan: "starter", seats: 4, billing: "cancelled", channels: ["email"], broken: 0, lastActiveMin: 9_000, conversations30d: 12, owner: "Jonas" }),
];

export interface StaffAction {
  id: string;
  minAgo: number;
  staff: string;
  workspace: string;
  action: "extendTrial" | "compCredits" | "changePlan" | "accessRequested" | "accessUsed";
  detail: string;
  reason: string;
}

export const STAFF_LOG: StaffAction[] = [
  { id: "l1", minAgo: 25, staff: "Sam (Relay support)", workspace: "Northwind Home", action: "accessUsed", detail: "Viewed Channels › Instagram, read-only", reason: "Ticket #1182: Instagram login expired, owner asked for help" },
  { id: "l2", minAgo: 190, staff: "Maya (Relay success)", workspace: "Andes Travel", action: "extendTrial", detail: "Trial +7 days", reason: "Waiting for Meta to approve their WhatsApp display name" },
  { id: "l3", minAgo: 1_440, staff: "Sam (Relay support)", workspace: "Bright Dental Group", action: "compCredits", detail: "+2,000 AI credits", reason: "Outage on 4 Oct used credits on failed summaries" },
  { id: "l4", minAgo: 2_900, staff: "Noor (Relay billing)", workspace: "Lumen Bikes", action: "changePlan", detail: "Pro → Growth", reason: "Customer asked to downgrade; confirmed by email" },
];

export const PLATFORM = {
  queue: { queued: 42, oldestSec: 3, failed24h: 7, dead24h: 1 },
  webhooks: { received24h: 182_403, rejected24h: 12, avgMs: 140 },
  providers: [
    { name: "Meta (WhatsApp, Messenger, Instagram)", state: "ok" as const },
    { name: "Twilio (SMS, Voice)", state: "degraded" as const, note: "Delayed SMS delivery to Canada" },
    { name: "Email (inbound and outbound)", state: "ok" as const },
    { name: "Telegram", state: "ok" as const },
    { name: "LINE", state: "ok" as const },
    { name: "TikTok", state: "ok" as const },
    { name: "Slack and Discord", state: "ok" as const },
    { name: "AI provider", state: "ok" as const },
  ],
};
