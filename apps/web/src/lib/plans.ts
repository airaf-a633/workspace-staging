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

/** What a user costs per month when billed yearly (ten months for twelve), rounded to cents. */
export function yearlyMonthly(price: number) {
  return Math.round((price * 10 * 100) / 12) / 100;
}
