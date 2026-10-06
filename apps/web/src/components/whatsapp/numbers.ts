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

/** Badge tone per quality rating; the words are in the language files (numbers.quality.<key>). */
export const QUALITY: Record<Quality, { tone: "done" | "warn" | "fail" }> = {
  high: { tone: "done" },
  medium: { tone: "warn" },
  low: { tone: "fail" },
};

const DAY = 86_400_000;

export function sampleNumbers(now: number): WaNumber[] {
  return [
    {
      id: "sales",
      displayName: "Northwind Home",
      displayNameStatus: "approved",
      number: "+1 415 555 0134",
      teamKey: "sales",
      status: "connected",
      quality: "high",
      limit: 1000,
      appLastOpened: now - 2 * DAY,
      about: "Lamps, speakers and small appliances, shipped worldwide. We reply 8:00 to 20:00.",
      category: "Shopping and retail",
      newChats: "team",
      usage: { service: 214, utility: 38, marketing: 120 },
      cardOnMeta: true,
    },
    {
      id: "support",
      displayName: "Northwind Home Support",
      displayNameStatus: "pending",
      number: "+1 415 555 0135",
      teamKey: "support",
      status: "attention",
      quality: "medium",
      limit: 250,
      appLastOpened: now - 11 * DAY,
      about: "Orders, returns and warranty help for Northwind Home customers.",
      category: "Shopping and retail",
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
