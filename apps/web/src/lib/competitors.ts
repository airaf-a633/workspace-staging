/**
 * Comparison pages (decided 2026-10-19): competitors' public list prices, each with the date we checked it and a
 * link to their own pricing page. Prices change, so re-check before every edit and update CHECKED_ON.
 * Only facts from the competitor's official pricing page go here; the words around them live in i18n (compare.*).
 */
export const CHECKED_ON = "2026-10-19";

export type RivalKey = "zendesk" | "intercom" | "front" | "chatwoot";

export interface Rival {
  key: RivalKey;
  name: string;
  source: string;
  /** Their plans, cheapest first, per user per month as published (null = "contact sales"). */
  plans: { name: string; price: number | null }[];
  /** How the published prices are billed. */
  billing: "annual" | "monthly";
}

export const RIVALS: Rival[] = [
  {
    key: "zendesk",
    name: "Zendesk",
    source: "https://www.zendesk.com/pricing/",
    billing: "annual",
    plans: [
      { name: "Suite Team", price: 55 },
      { name: "Suite Professional", price: 115 },
      { name: "Suite Enterprise", price: null },
    ],
  },
  {
    key: "intercom",
    name: "Intercom",
    source: "https://www.intercom.com/pricing",
    billing: "annual",
    plans: [
      { name: "Essential", price: 29 },
      { name: "Advanced", price: 85 },
      { name: "Expert", price: 132 },
    ],
  },
  {
    key: "front",
    name: "Front",
    source: "https://front.com/pricing",
    billing: "annual",
    plans: [
      { name: "Starter", price: 25 },
      { name: "Professional", price: 65 },
      { name: "Enterprise", price: 105 },
    ],
  },
  {
    key: "chatwoot",
    name: "Chatwoot",
    source: "https://www.chatwoot.com/pricing",
    billing: "monthly",
    plans: [
      { name: "Startups", price: 19 },
      { name: "Business", price: 39 },
      { name: "Enterprise", price: 99 },
    ],
  },
];

export const rival = (key: string) => RIVALS.find((r) => r.key === key);
