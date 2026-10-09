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
      title: "8 x Nook shelf for a co-working space",
      fils: 236_000,
      stage: "negotiating",
      ownerId: id("Leo"),
      customerId: null,
      customerName: "Hannah Schmidt",
      teamId: team("sales"),
      createdAt: now - 6 * DAY,
      closeDate: now + 3 * DAY,
      lastCustomerAt: now - 5 * 3600_000,
      approval: { byId: id("Leo"), pct: 8, note: "She'll order today if we do 8%. A competitor quoted 6% off.", status: "pending" },
      notes: [{ byId: id("Leo"), text: "Needs delivery to Hamburg before the space opens on the 1st.", at: now - 5 * DAY }],
    },
    {
      id: "nt1",
      title: "Studio fit-out: 40 Halo lamps and 10 speakers",
      fils: 1_240_000,
      stage: "negotiating",
      ownerId: id("Marcus"),
      customerId: null,
      customerName: "Kinfolk Studios",
      teamId: team("sales"),
      createdAt: now - 21 * DAY,
      closeDate: now + 14 * DAY,
      lastCustomerAt: now - 2 * DAY,
      followUp: { text: "Send revised quote with a 3-year warranty", due: "Today" },
      notes: [],
    },
    {
      id: "ph1",
      title: "2 x Halo desk lamp",
      fils: 25_800,
      stage: "new",
      ownerId: id("Leo"),
      customerId: "omar",
      customerName: "Omar Haddad",
      teamId: team("sales"),
      createdAt: now - 45 * 60_000,
      lastCustomerAt: now - 9 * 60_000,
      notes: [],
    },
    {
      id: "lt1",
      title: "3 x Breeze air purifier",
      fils: 59_700,
      stage: "lost",
      ownerId: id("Leo"),
      customerId: null,
      customerName: "Imran Qureshi",
      teamId: team("sales"),
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
