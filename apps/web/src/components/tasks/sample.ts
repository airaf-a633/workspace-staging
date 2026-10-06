import type { Customer } from "@/components/customers/types";
import type { InboxData } from "@/components/inbox/types";
import { dayAt, dayDiff, wallClock, weekdayOf, zonedInstant } from "@/i18n/zone";

/** A task as the Tasks screen shows it. Dates follow the viewer's time zone. */
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

/** `days` from today at local `hhmm` (09:00 by default), in the viewer's zone. */
function at(now: number, days: number, tz: string, hhmm?: string) {
  return dayAt(now, days, tz, hhmm);
}

/** Turn a sample due word ("Today", "Thursday", "No date") into a timestamp. */
function fromWord(word: string, now: number, tz: string): number | null {
  if (word === "No date") return null;
  if (word === "Today") return at(now, 0, tz);
  if (word === "Tomorrow") return at(now, 1, tz);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].indexOf(word);
  if (days < 0) return at(now, 2, tz);
  return at(now, ((days - weekdayOf(now, tz) + 7) % 7) || 7, tz);
}

/** Days until next Monday (1 to 7). */
const toMonday = (now: number, tz: string) => ((0 - weekdayOf(now, tz) + 7) % 7) || 7;

export function buildTasks(data: InboxData, customers: Customer[]): BoardTask[] {
  const { now, people, teams, tz } = data;
  const id = (n: string) => people.find((p) => p.name === n)?.id ?? "";
  const team = (needle: string) => teams.find((t) => t.name.toLowerCase().includes(needle))?.id ?? teams[0]?.id ?? "";
  const calendarOf = (ownerId: string): BoardTask["calendar"] => (ownerId === id("Marcus") ? "Outlook" : ownerId === id("Kenji") ? "Google" : null);

  const fromCustomers: BoardTask[] = customers.flatMap((c) =>
    c.tasks.map((t) => ({
      id: t.id,
      text: t.text,
      ownerId: t.ownerId,
      customerId: c.id,
      customerName: c.name,
      teamId: c.teamId,
      due: fromWord(t.due, now, tz),
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
    t({ id: "x1", text: "Book a courier for order #NW-4840", ownerId: id("Kenji"), teamId: team("support"), due: at(now, -2, tz), comments: [{ byId: id("Priya"), text: "Customer is home after 17:00.", at: now - 2 * DAY }] }),
    t({ id: "x2", text: "Send revised quote with a 3-year warranty", ownerId: id("Marcus"), customerName: "Kinfolk Studios", teamId: team("sales"), due: at(now, 0, tz, "16:00"), hasTime: true }),
    t({ id: "x3", text: "Call about the brass finish", ownerId: id("Marcus"), customerId: "olivia", customerName: "Olivia Bennett", teamId: team("sales"), due: at(now, 1, tz, "11:00"), hasTime: true }),
    t({ id: "x4", text: "Order a replacement fan unit for Rahul", ownerId: id("Priya"), customerId: "rahul", customerName: "Rahul Menon", teamId: team("support"), due: at(now, 0, tz, "14:00"), hasTime: true }),
    t({ id: "x5", text: "Call Grace back about order #NW-4802", ownerId: id("Leo"), customerId: "grace", customerName: "Grace Kim", teamId: team("support"), due: at(now, 0, tz, "15:00"), hasTime: true }),
    t({ id: "x6", text: "Check stock of the Aura floor lamp", ownerId: id("Kenji"), teamId: team("sales"), due: at(now, toMonday(now, tz), tz), repeat: "weekly" }),
    t({ id: "x7", text: "Weekly check-in with the managers", ownerId: id("Elena"), teamId: team("general"), due: at(now, 2, tz, "10:00"), hasTime: true, repeat: "weekly", calendar: "Google" }),
    t({ id: "x8", text: "Reply to George about Breeze filters", ownerId: id("Leo"), customerId: "george", customerName: "George Mathew", teamId: team("support"), due: at(now, 0, tz, "13:00"), hasTime: true }),
    t({ id: "x9", text: "Write the Android 15 pairing fix for the help center", ownerId: id("Priya"), teamId: team("support"), due: at(now, 4, tz) }),
    t({ id: "d1", text: "Send invoice to Mariam", ownerId: id("Marcus"), customerId: "mariam", customerName: "Mariam Haddad", teamId: team("sales"), due: at(now, -1, tz), done: true, doneAt: now - DAY }),
    t({ id: "d2", text: "Tell Deepak the shipping times to Singapore", ownerId: id("Leo"), customerId: "deepak", customerName: "Deepak Nair", teamId: team("sales"), due: at(now, -1, tz), done: true, doneAt: now - 30 * 3600_000 }),
  ];

  return [...fromCustomers, ...extra];
}

export type When = "overdue" | "today" | "tomorrow" | "week" | "later" | "none";

export function whenOf(task: BoardTask, now: number, tz: string): When {
  if (task.due === null) return "none";
  const d = dayDiff(task.due, now, tz);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d < 7) return "week";
  return "later";
}

/** The next due date for a repeating task. */
export function nextDue(task: BoardTask, tz: string): number | null {
  if (!task.due || !task.repeat) return null;
  const w = wallClock(task.due, tz);
  const step = task.repeat === "daily" ? { m: 0, d: 1 } : task.repeat === "weekly" ? { m: 0, d: 7 } : { m: 1, d: 0 };
  return zonedInstant(w.y, w.m + step.m, w.d + step.d, w.h, w.min, tz);
}

/** Snooze targets: later today (+3 h), tomorrow 09:00, next Monday 09:00. */
export function snoozeTo(kind: "later" | "tomorrow" | "week", now: number, tz: string): { due: number; hasTime: boolean } {
  if (kind === "later") return { due: now + 3 * 3600_000, hasTime: true };
  if (kind === "tomorrow") return { due: at(now, 1, tz), hasTime: true };
  return { due: at(now, toMonday(now, tz), tz), hasTime: true };
}

export function dueAt(days: number, time: string | null, now: number, tz: string) {
  return { due: at(now, days, tz, time ?? undefined), hasTime: !!time };
}

/** Days from today until the end of this week (Sunday), for "This week". */
export const daysToWeekEnd = (now: number, tz: string) => 7 - weekdayOf(now, tz);

/** A date picked in a form (yyyy-mm-dd, optional hh:mm) as an instant in the viewer's zone. */
export function pickedDate(date: string, time: string, tz: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = (time || "09:00").split(":").map(Number);
  return zonedInstant(y, m, d, h, min, tz);
}
