import type { Customer } from "@/components/customers/types";
import type { InboxData } from "@/components/inbox/types";
import type { Line } from "@/i18n/labels";

/** A deal as the board shows it. Built from the sample customers, plus a few more so every stage has cards. */
export interface BoardDeal {
  id: string;
  title: string;
  fils: number;
  stage: "new" | "quoted" | "negotiating" | "won" | "lost";
  ownerId: string;
  customerId: string | null;
  customerName: string;
  teamId: string;
  createdAt: number;
  /** Expected close, as a timestamp (shown as a date in the reader's language). */
  closeDate?: number;
  /** When the customer last wrote, for "No reply 3 days" on quoted deals. */
  lastCustomerAt?: number;
  followUp?: { text: string; due: string };
  approval?: { byId: string; pct: number; note: string; status: "pending" | "approved" | "declined"; decidedById?: string };
  lostReason?: string;
  closedAt?: number;
  notes: { byId: string; text: string; at: number }[];
}

const DAY = 86_400_000;

export function buildDeals(data: InboxData, customers: Customer[]): BoardDeal[] {
  const { now, people, teams } = data;
  const id = (name: string) => people.find((p) => p.name === name)?.id ?? "";
  const team = (needle: string) => teams.find((t) => t.name.toLowerCase().includes(needle))?.id ?? teams[0]?.id ?? "";

  const fromCustomers: BoardDeal[] = customers.flatMap((c) =>
    c.deals.map((d) => ({
      id: d.id,
      title: d.title,
      fils: d.fils,
      stage: d.stage,
      ownerId: d.ownerId,
      customerId: c.id,
      customerName: c.name,
      teamId: c.teamId,
      createdAt: c.createdAt,
      lastCustomerAt: c.lastContact?.at,
      followUp: c.tasks.find((t) => t.ownerId === d.ownerId && !t.done) ? { text: c.tasks.find((t) => t.ownerId === d.ownerId && !t.done)!.text, due: c.tasks.find((t) => t.ownerId === d.ownerId && !t.done)!.due } : undefined,
      closedAt: d.stage === "won" || d.stage === "lost" ? now - DAY : undefined,
      notes: [],
    })),
  );

  const extra: BoardDeal[] = [
    {
      id: "fk1",
      title: "8 x iPad Air for a training room",
      fils: 745_000,
      stage: "negotiating",
      ownerId: id("Hana"),
      customerId: null,
      customerName: "Fatima Khoury",
      teamId: team("deira"),
      createdAt: now - 6 * DAY,
      closeDate: now + 3 * DAY,
      lastCustomerAt: now - 5 * 3600_000,
      approval: { byId: id("Hana"), pct: 8, note: "She'll order today if we do 8%. Competitor quoted 6% off.", status: "pending" },
      notes: [{ byId: id("Hana"), text: "Needs delivery to Al Barsha before Sunday's training.", at: now - 5 * DAY }],
    },
    {
      id: "nt1",
      title: "Office fit-out: 40 laptops and screens",
      fils: 12_400_000,
      stage: "negotiating",
      ownerId: id("Sara"),
      customerId: null,
      customerName: "Al Noor Trading",
      teamId: team("deira"),
      createdAt: now - 21 * DAY,
      closeDate: now + 14 * DAY,
      lastCustomerAt: now - 2 * DAY,
      followUp: { text: "Send revised quote with 3-year warranty", due: "Today" },
      notes: [],
    },
    {
      id: "ph1",
      title: "iPhone 16 Pro x 3",
      fils: 1_497_000,
      stage: "new",
      ownerId: id("Hana"),
      customerId: "george",
      customerName: "George Mathew",
      teamId: team("deira"),
      createdAt: now - 45 * 60_000,
      lastCustomerAt: now - 12 * 60_000,
      notes: [],
    },
    {
      id: "lt1",
      title: "Gaming laptop for my son",
      fils: 649_900,
      stage: "lost",
      ownerId: id("Omar"),
      customerId: null,
      customerName: "Imran Qureshi",
      teamId: team("mall"),
      createdAt: now - 12 * DAY,
      lostReason: "Price",
      closedAt: now - 3 * DAY,
      notes: [],
    },
  ];

  return [...fromCustomers, ...extra];
}

/** One quiet line on the card, only when the deal needs something (decided 2026-09-30). */
export function dealNeed(d: BoardDeal, now: number): { line: Line; tone: "warn" | "plain" } | null {
  if (d.approval?.status === "pending") return { line: { key: "deals.need.approval" }, tone: "warn" };
  if (d.followUp?.due === "Today") return { line: { key: "deals.need.followUpToday" }, tone: "warn" };
  if (d.followUp?.due === "Tomorrow") return { line: { key: "deals.need.followUpTomorrow" }, tone: "plain" };
  if ((d.stage === "quoted" || d.stage === "negotiating") && d.lastCustomerAt && now - d.lastCustomerAt >= DAY) {
    return { line: { key: "deals.need.noReply", vars: { count: Math.floor((now - d.lastCustomerAt) / DAY) } }, tone: "plain" };
  }
  return null;
}
