/**
 * WhatsApp numbers as the settings screens show them. Field names follow what the Cloud API reports
 * (quality rating, messaging limit tier, display-name review), so real data can replace the sample in M2.8.
 */

export type NumberStatus = "connected" | "attention" | "disconnected";
export type Quality = "high" | "medium" | "low";

export interface WaNumber {
  id: string;
  displayName: string;
  displayNameStatus: "approved" | "pending" | "rejected";
  number: string;
  teamKey: string;
  status: NumberStatus;
  quality: Quality;
  /** New customers the number may start conversations with in 24 hours. */
  limit: number | "unlimited";
  /** When the WhatsApp Business app was last opened on the phone (coexistence: 14 days without it disconnects). */
  appLastOpened: number;
  about: string;
  category: string;
  newChats: "team" | "person" | "rules";
  usage: { service: number; utility: number; marketing: number };
  cardOnMeta: boolean;
}

export const RATE_FILS = { utility: 6, marketing: 21 } as const;
export const DISCONNECT_DAYS = 14;
export const REMIND_FROM_DAY = 10;

export const QUALITY: Record<Quality, { label: string; tone: "done" | "warn" | "fail"; help: string }> = {
  high: { label: "High", tone: "done", help: "Customers are happy with your messages." },
  medium: { label: "Medium", tone: "warn", help: "Some customers blocked or reported this number lately. Send fewer marketing messages for a few days." },
  low: { label: "Low", tone: "fail", help: "Meta may lower your daily limit. Pause marketing and only message customers who asked to hear from you." },
};

const DAY = 86_400_000;

export function sampleNumbers(now: number): WaNumber[] {
  return [
    {
      id: "deira",
      displayName: "Qamar Electronics",
      displayNameStatus: "approved",
      number: "+971 4 555 0190",
      teamKey: "deira",
      status: "connected",
      quality: "high",
      limit: 1000,
      appLastOpened: now - 2 * DAY,
      about: "Laptops, phones and repairs in Deira and Dubai Mall. We reply 10:00 to 22:00.",
      category: "Electronics",
      newChats: "team",
      usage: { service: 214, utility: 38, marketing: 120 },
      cardOnMeta: true,
    },
    {
      id: "mall",
      displayName: "Qamar Electronics Mall",
      displayNameStatus: "pending",
      number: "+971 4 555 0191",
      teamKey: "mall",
      status: "attention",
      quality: "medium",
      limit: 250,
      appLastOpened: now - 11 * DAY,
      about: "Qamar Electronics at Dubai Mall, Level 2. Pick up online orders here.",
      category: "Electronics",
      newChats: "team",
      usage: { service: 96, utility: 12, marketing: 0 },
      cardOnMeta: false,
    },
  ];
}

export function daysLeft(n: WaNumber, now: number) {
  return Math.max(0, DISCONNECT_DAYS - Math.floor((now - n.appLastOpened) / DAY));
}

export function estimatedCostFils(n: WaNumber) {
  return n.usage.utility * RATE_FILS.utility + n.usage.marketing * RATE_FILS.marketing;
}

export function limitText(limit: WaNumber["limit"]) {
  return limit === "unlimited" ? "No daily limit" : `Up to ${limit.toLocaleString("en-GB")} new customers a day`;
}
