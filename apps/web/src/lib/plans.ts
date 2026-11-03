/**
 * Relay's plans, shared by the public pricing page and Settings › Billing so they can't drift apart.
 * Prices are per user per month in US dollars (provisional until the founders lock them, 2026-10-19).
 * Yearly billing gives two months free: you pay for ten.
 */
export type PlanKey = "starter" | "growth" | "pro";
export type PlanFeature = "inbox" | "channels" | "helpCenter" | "reports" | "sla" | "campaigns" | "customRoles" | "sso" | "audit" | "api";

export interface Plan {
  key: PlanKey;
  /** Per user per month, billed monthly. */
  price: number;
  /** AI credits per user per month. */
  credits: number;
  features: PlanFeature[];
}

export const PLANS: Plan[] = [
  { key: "starter", price: 19, credits: 100, features: ["inbox", "channels", "helpCenter", "reports"] },
  { key: "growth", price: 39, credits: 500, features: ["inbox", "channels", "helpCenter", "reports", "sla", "campaigns", "customRoles"] },
  { key: "pro", price: 79, credits: 2_000, features: ["inbox", "channels", "helpCenter", "reports", "sla", "campaigns", "customRoles", "sso", "audit", "api"] },
];

export const POPULAR: PlanKey = "growth";
export const TRIAL_DAYS = 14;

/**
 * The private pilot (decided 2026-11-03): free for invited businesses until launch pricing is announced. The public website still
 * shows every plan and price (the founder wants the product showcased, 2026-11-03), with a note that the pilot is free and
 * a section saying what works today and what is coming. Set to false when billing exists.
 */
export const PILOT = true;

/** What a user costs per month when billed yearly (ten months for twelve), rounded to cents. */
export function yearlyMonthly(price: number) {
  return Math.round((price * 10 * 100) / 12) / 100;
}
