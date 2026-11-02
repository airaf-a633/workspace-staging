import { canSeeDealValue, covers, type Viewer } from "@app/domain";
import type { Format, TFor } from "../../i18n/types";
import { dayDiff } from "../../i18n/zone";
import type { BoardDeal } from "../deals/sample";
import type { BoardTask } from "../tasks/sample";
import { isLate } from "./home-numbers";
import type { NeedRow } from "./manager-home";

/**
 * "Needs you now" rows that come from deals and tasks (decided 2026-11-04), for a real workspace:
 * discounts waiting for this person to approve, this person's tasks that are late or due today, and their quotes to follow up.
 * The chat rows come from needsFor(). Deals are already limited to what this person may see, and a deal's value is
 * only shown to someone who may see it.
 */
export function crmNeeds(f: {
  deals: BoardDeal[];
  tasks: BoardTask[];
  viewer: Viewer;
  nameOf: (memberId: string) => string;
  base: string;
  now: number;
  tz: string;
  t: TFor<"home">;
  fmt: Format;
}): NeedRow[] {
  const { viewer, t } = f;
  const rows: NeedRow[] = [];

  for (const d of f.deals) {
    if (d.approval?.status === "pending" && d.approval.byId !== viewer.memberId && covers(viewer, "deals.approve", { teamId: d.teamId, holderId: d.ownerId })) {
      rows.push({
        id: `approve-${d.id}`, name: d.customerName, href: `${f.base}/deals?deal=${d.id}`, tone: "warn", rank: 1, waitingSince: null, meta: t("approval"),
        items: [t("approveAsk", { name: f.nameOf(d.approval.byId), pct: d.approval.pct })],
      });
    }
    if (d.stage === "quoted" && d.ownerId === viewer.memberId) {
      rows.push({
        id: `quote-${d.id}`, name: d.customerName, href: `${f.base}/deals?deal=${d.id}`, tone: "plain", rank: 3, waitingSince: null, meta: null,
        items: [canSeeDealValue(viewer, d.ownerId) ? t("needs.quoteValue", { value: f.fmt.money(d.fils) }) : t("needs.quote")],
      });
    }
  }

  for (const task of f.tasks) {
    if (task.done || task.ownerId !== viewer.memberId || task.due === null) continue;
    const late = isLate(task, f.now, f.tz);
    if (!late && dayDiff(task.due, f.now, f.tz) !== 0) continue;
    rows.push({
      id: `task-${task.id}`, name: task.customerName ?? t("needs.taskName"), href: `${f.base}/tasks`, tone: late ? "warn" : "plain", rank: late ? 1 : 3,
      waitingSince: null, meta: null,
      items: [t(late ? "needs.taskLate" : "needs.taskToday", { text: task.text })],
    });
  }
  return rows;
}
