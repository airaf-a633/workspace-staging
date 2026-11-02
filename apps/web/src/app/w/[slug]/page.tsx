import type { RoleTemplateKey } from "@app/domain";
import { liveCounts, ManagerHome } from "@/components/home/manager-home";
import { crmNeeds } from "@/components/home/crm-needs";
import { realNumbers } from "@/components/home/home-numbers";
import type { InboxData } from "@/components/inbox/types";
import { SetupChecklist } from "@/components/setup-checklist";
import { loadBoardDeals, loadBoardTasks } from "@/lib/crm-live";
import { loadChannelInboxes, loadLiveInbox } from "@/lib/inbox-live";
import { requestNow } from "@/lib/now";
import { setupSteps, type TeamShape } from "@/lib/setup";
import { loadPeople } from "@/lib/viewer";
import { loadWorkspace } from "@/lib/workspace";
import { getFormat, getT, getTimeZone } from "@/i18n/server";

const TEMPLATES: RoleTemplateKey[] = ["owner", "admin", "sales_manager", "support_manager", "ops_manager", "agent", "viewer"];

/*
 * Home on real data (decided 2026-11-04). A brand-new workspace, with no chats, deals or tasks yet, gets the setup checklist
 * (PRODUCT_DECISIONS §14). From the first chat, deal or task it becomes the manager home: "Needs you now" first, then the
 * numbers for the person's role. Only numbers that are really computed show; unfinished setup shrinks to a small chip.
 */
export default async function WorkspaceHome(props: PageProps<"/w/[slug]">) {
  const { slug } = await props.params;
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const base = `/w/${slug}`;
  const tz = await getTimeZone();
  const now = requestNow();
  const currency = workspace.currency ?? "USD";

  const [{ people, teams, viewer }, deals, tasks, { data: ws }, { count: memberCount }] = await Promise.all([
    loadPeople(supabase, workspace.id, me.id),
    loadBoardDeals(supabase, workspace.id, tz, now),
    loadBoardTasks(supabase, workspace.id),
    supabase.from("workspaces").select("team_shape").eq("id", workspace.id).single(),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "active"),
  ]);
  const shape = (ws?.team_shape ?? null) as TeamShape;
  const live = await loadLiveInbox(supabase, workspace.id, people.map(({ id, name, role, canReply }) => ({ id, name, role, canReply })), teams, viewer, tz);
  const firstName = me.display_name.split(" ")[0];
  const tSetup = await getT("setup");
  const common = await getT("common");
  const t = await getT("home");

  if (!live && deals.length === 0 && tasks.length === 0) {
    const steps = setupSteps(tSetup, common, { shape, memberCount: memberCount ?? 0, connected: false, base });
    return (
      <>
        <header className="grid gap-2">
          <h1 className="display text-4xl sm:text-5xl">{t("welcome", { name: firstName })}</h1>
          <p className="text-muted">{t("welcomeBody", { workspace: workspace.name })}</p>
        </header>
        <SetupChecklist steps={steps} />
        {shape === "delivery" && (
          <p className="rounded-[var(--radius-panel)] bg-surface-2 p-4 text-sm">
            {t.rich("deliveryNote", { title: <strong className="font-medium">{t("deliveryTitle")}</strong> })}
          </p>
        )}
      </>
    );
  }

  const data: InboxData =
    live ?? { now, tz, people: people.map(({ id, name, role, canReply }) => ({ id, name, role, canReply })), teams, inboxes: await loadChannelInboxes(supabase, workspace.id), labels: [], viewer, conversations: [], live: true };
  const role = Array.isArray(me.roles) ? me.roles[0] : me.roles;
  const byKey = TEMPLATES.find((k) => k === role?.key);
  const template: RoleTemplateKey = (TEMPLATES.find((k) => k === role?.template_key) ?? byKey ?? (role?.is_owner ? "owner" : "viewer"));

  const fmt = await getFormat(currency);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? common("someone");
  const extraNeeds = crmNeeds({ deals, tasks, viewer, nameOf, base, now: data.now, tz, t, fmt });
  const numbers = realNumbers({ template, meId: me.id, now: data.now, tz, dealValues: viewer.scopes["deals.values"] ?? "none", chats: liveCounts(data), deals, tasks });

  // Only the setup steps that can be finished in a real workspace today count; the rest say "coming soon" on the checklist.
  let setup: { done: number; total: number; href: string } | undefined;
  if (template === "owner" || template === "admin") {
    const doable = setupSteps(tSetup, common, { shape, memberCount: memberCount ?? 0, connected: data.inboxes.length > 0, base }).filter((s) => s.soon === null);
    const next = doable.find((s) => !s.done && s.href);
    if (next?.href) setup = { done: doable.filter((s) => s.done).length, total: doable.length, href: next.href };
  }

  return <ManagerHome firstName={firstName} template={template} data={data} inboxHref={`${base}/inbox`} setup={setup} extraNeeds={extraNeeds} numbers={numbers} currency={currency} />;
}
