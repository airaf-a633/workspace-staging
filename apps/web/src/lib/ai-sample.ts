import { canSeeDealValue, covers, type RoleTemplateKey } from "@app/domain";
import { previewDeals, previewPerson, previewTasks } from "@/lib/preview";

/**
 * What the preview's AI "knows" for one person: plain facts it can answer from, already cut down to that
 * person's permissions (decided 2026-10-01: AI acts with exactly the person's role). The real AI will
 * read the same things through the same access rules (docs/AI_PLAN.md).
 */
export interface AiDeal { id: string; customer: string; title: string; quietDays: number; fils: number | null; owner: string; stage: string }
export interface AiChat { id: string; customer: string; waitingMin: number }
export interface AiWorld {
  base: string;
  me: { id: string; name: string; template: RoleTemplateKey };
  canDeals: boolean;
  canTasks: boolean;
  /** Quoted or negotiating deals the customer hasn't answered for 2+ days. */
  quietDeals: AiDeal[];
  /** Chats nobody has claimed, longest wait first. */
  unclaimed: AiChat[];
  tasksToday: { text: string; customer: string | null }[];
  overdue: { text: string; customer: string | null }[];
  credits: { left: number; total: number };
}

const DAY = 86_400_000;

export function previewAiWorld(as: string): AiWorld {
  const me = previewPerson(as);
  const { data, deals } = previewDeals(as);
  const { tasks } = previewTasks(as);
  const name = (id: string) => data.people.find((p) => p.id === id)?.name ?? "";
  const ref = (teamId: string, holderId: string) => ({ teamId, holderId });
  const canDeals = (me.scopes["deals.view"] ?? "none") !== "none";
  const canTasks = (me.scopes["tasks.manage"] ?? "none") !== "none";

  const quietDeals = canDeals
    ? deals
        .filter((d) => (d.stage === "quoted" || d.stage === "negotiating") && d.lastCustomerAt && data.now - d.lastCustomerAt >= 2 * DAY)
        .filter((d) => covers(data.viewer, "deals.view", ref(d.teamId, d.ownerId)))
        .map((d) => ({
          id: d.id,
          customer: d.customerName,
          title: d.title,
          quietDays: Math.floor((data.now - d.lastCustomerAt!) / DAY),
          fils: canSeeDealValue(data.viewer, d.ownerId) ? d.fils : null,
          owner: name(d.ownerId),
          stage: d.stage,
        }))
    : [];

  const unclaimed = data.conversations
    .filter((c) => c.status === "open" && !c.holderId && c.lastCustomerAt && covers(data.viewer, "conversations.view", c))
    .map((c) => ({ id: c.id, customer: c.contact.name, waitingMin: Math.round((data.now - c.lastCustomerAt!) / 60_000) }))
    .sort((a, b) => b.waitingMin - a.waitingMin);

  const startOfDay = Math.floor((data.now + 4 * 3600_000) / DAY) * DAY - 4 * 3600_000;
  const mine = tasks.filter((t) => t.ownerId === me.id && !t.done);
  return {
    base: `/preview/${as}`,
    me: { id: me.id, name: me.name, template: me.template },
    canDeals,
    canTasks,
    quietDeals,
    unclaimed,
    tasksToday: mine.filter((t) => t.due !== null && t.due >= startOfDay && t.due < startOfDay + DAY).map((t) => ({ text: t.text, customer: t.customerName })),
    overdue: mine.filter((t) => t.due !== null && t.due < startOfDay).map((t) => ({ text: t.text, customer: t.customerName })),
    credits: { left: 1_840, total: 2_500 },
  };
}
