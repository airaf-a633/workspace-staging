import type { Customer } from "@/components/customers/types";
import type { InboxData } from "@/components/inbox/types";

/** A task as the Tasks screen shows it. Dates are Dubai time (UTC+4, no daylight saving). */
export interface BoardTask {
  id: string;
  text: string;
  ownerId: string;
  customerId: string | null;
  customerName: string | null;
  teamId: string;
  /** Start of the due moment; with hasTime false only the day counts. */
  due: number | null;
  hasTime: boolean;
  done: boolean;
  doneAt?: number;
  repeat: "daily" | "weekly" | "monthly" | null;
  comments: { byId: string; text: string; at: number }[];
  calendar: "Google" | "Outlook" | null;
}

export const DAY = 86_400_000;
const DUBAI = 4 * 3600_000;

/** Midnight in Dubai for the day containing `at`. */
export function dubaiDay(at: number) {
  return Math.floor((at + DUBAI) / DAY) * DAY - DUBAI;
}

/** Day index 0 = Monday … 6 = Sunday, in Dubai. */
export function dubaiWeekday(at: number) {
  return (new Date(dubaiDay(at) + DUBAI).getUTCDay() + 6) % 7;
}

function at(now: number, days: number, hhmm?: string) {
  const [h, m] = (hhmm ?? "09:00").split(":").map(Number);
  return dubaiDay(now) + days * DAY + (h * 60 + m) * 60_000;
}

/** Turn a sample due word ("Today", "Thursday", "No date") into a timestamp. */
function fromWord(word: string, now: number): number | null {
  if (word === "No date") return null;
  if (word === "Today") return at(now, 0);
  if (word === "Tomorrow") return at(now, 1);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].indexOf(word);
  if (days < 0) return at(now, 2);
  return at(now, ((days - dubaiWeekday(now) + 7) % 7) || 7);
}

export function buildTasks(data: InboxData, customers: Customer[]): BoardTask[] {
  const { now, people, teams } = data;
  const id = (n: string) => people.find((p) => p.name === n)?.id ?? "";
  const team = (needle: string) => teams.find((t) => t.name.toLowerCase().includes(needle))?.id ?? teams[0]?.id ?? "";
  const calendarOf = (ownerId: string): BoardTask["calendar"] => (ownerId === id("Sara") ? "Outlook" : ownerId === id("Priya") ? "Google" : null);

  const fromCustomers: BoardTask[] = customers.flatMap((c) =>
    c.tasks.map((t) => ({
      id: t.id,
      text: t.text,
      ownerId: t.ownerId,
      customerId: c.id,
      customerName: c.name,
      teamId: c.teamId,
      due: fromWord(t.due, now),
      hasTime: false,
      done: t.done,
      repeat: null,
      comments: [],
      calendar: calendarOf(t.ownerId),
    })),
  );

  const t = (p: Partial<BoardTask> & Pick<BoardTask, "id" | "text" | "ownerId" | "teamId">): BoardTask => ({
    customerId: null,
    customerName: null,
    due: null,
    hasTime: false,
    done: false,
    repeat: null,
    comments: [],
    calendar: calendarOf(p.ownerId),
    ...p,
  });

  const extra: BoardTask[] = [
    t({ id: "x1", text: "Arrange courier for order #QE-2240", ownerId: id("Priya"), teamId: team("mall"), due: at(now, -2), comments: [{ byId: id("Omar"), text: "Customer is home after 17:00.", at: now - 2 * DAY }] }),
    t({ id: "x2", text: "Send revised quote with 3-year warranty", ownerId: id("Sara"), customerName: "Al Noor Trading", teamId: team("deira"), due: at(now, 0, "16:00"), hasTime: true }),
    t({ id: "x3", text: "Call about the MacBook colours", ownerId: id("Sara"), customerId: "khalifa", customerName: "Khalifa Al Mazrouei", teamId: team("mall"), due: at(now, 1, "11:00"), hasTime: true }),
    t({ id: "x4", text: "Check the warranty claim with Lenovo", ownerId: id("Omar"), customerId: "rahul", customerName: "Rahul Menon", teamId: team("mall"), due: at(now, 0, "14:00"), hasTime: true }),
    t({ id: "x5", text: "Courier replacement earbuds to Mirdif", ownerId: id("Omar"), customerId: "noura", customerName: "Noura Al Ketbi", teamId: team("mall"), due: at(now, 1) }),
    t({ id: "x6", text: "Check stock of ThinkPad E14", ownerId: id("Priya"), teamId: team("deira"), due: at(now, ((0 - dubaiWeekday(now) + 7) % 7) || 7), repeat: "weekly" }),
    t({ id: "x7", text: "Weekly check-in with the managers", ownerId: id("Khalid"), teamId: team("general"), due: at(now, 2, "10:00"), hasTime: true, repeat: "weekly", calendar: "Google" }),
    t({ id: "x8", text: "Ask Hana to follow up on George", ownerId: id("Hana"), customerId: "george", customerName: "George Mathew", teamId: team("deira"), due: at(now, 0, "13:00"), hasTime: true }),
    t({ id: "x9", text: "Print price tags for the new phones", ownerId: id("Hana"), teamId: team("deira"), due: at(now, 12) }),
    t({ id: "d1", text: "Send invoice to Mariam", ownerId: id("Sara"), customerId: "mariam", customerName: "Mariam Al Suwaidi", teamId: team("deira"), due: at(now, -1), done: true, doneAt: now - DAY }),
    t({ id: "d2", text: "Tell Deepak the Friday opening hours", ownerId: id("Hana"), customerId: "deepak", customerName: "Deepak Nair", teamId: team("deira"), due: at(now, -1), done: true, doneAt: now - 30 * 3600_000 }),
  ];

  return [...fromCustomers, ...extra];
}

export type When = "overdue" | "today" | "tomorrow" | "week" | "later" | "none";

export function whenOf(task: BoardTask, now: number): When {
  if (task.due === null) return "none";
  const d = (dubaiDay(task.due) - dubaiDay(now)) / DAY;
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 7) return "week";
  return "later";
}

/** The next due date for a repeating task. */
export function nextDue(task: BoardTask): number | null {
  if (!task.due || !task.repeat) return null;
  if (task.repeat === "daily") return task.due + DAY;
  if (task.repeat === "weekly") return task.due + 7 * DAY;
  const d = new Date(task.due + DUBAI);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.getTime() - DUBAI;
}

/** Snooze targets: later today (+3 h), tomorrow 09:00, next Monday 09:00. */
export function snoozeTo(kind: "later" | "tomorrow" | "week", now: number): { due: number; hasTime: boolean } {
  if (kind === "later") return { due: now + 3 * 3600_000, hasTime: true };
  if (kind === "tomorrow") return { due: at(now, 1), hasTime: true };
  return { due: at(now, ((0 - dubaiWeekday(now) + 7) % 7) || 7), hasTime: true };
}

export function dueAt(days: number, time: string | null, now: number) {
  return { due: at(now, days, time ?? undefined), hasTime: !!time };
}
