import { notFound } from "next/navigation";
import type { ChannelKey } from "@/components/channels/catalog";
import { LiveReports } from "@/components/reports/reports";
import { toReport, type ConversationsResult, type SalesResult } from "@/lib/reports-map";
import { loadPeople } from "@/lib/viewer";
import { loadWorkspace } from "@/lib/workspace";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("reports"))("title") };
}

const RANGES = [7, 30, 90] as const;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/*
 * Reports on real data (decided 2026-11-05): conversations, team and sales. The database works the numbers out in one call
 * each (report_conversations, report_sales), checking reports.view first; "team" scope sees only their teams' chats.
 * Satisfaction and campaigns come when something measures them.
 */
export default async function ReportsPage(props: PageProps<"/w/[slug]/reports">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, workspace, me } = await loadWorkspace(slug);

  const scope = async (permission: string) => ((await supabase.rpc("permission_scope", { p_workspace: workspace.id, p_permission: permission })).data ?? "none") as string;
  const [view, values, exportScope, { people, teams, viewer }, { data: channelRows }] = await Promise.all([
    scope("reports.view"),
    scope("deals.values"),
    scope("reports.export"),
    loadPeople(supabase, workspace.id, me.id),
    supabase.from("channels").select("type").eq("workspace_id", workspace.id),
  ]);
  if (view === "none") notFound();
  const teamScope = view === "all" ? "all" : "team";
  const myTeams = viewer.teamIds;
  const visible = teamScope === "all" ? teams : teams.filter((t) => myTeams.includes(t.id));

  const asked = Number(one(sp.range));
  const range = (RANGES as readonly number[]).includes(asked) ? (asked as 7 | 30 | 90) : 30;
  const askedTeam = one(sp.team);
  const team = askedTeam && visible.some((t) => t.id === askedTeam) ? askedTeam : teamScope === "all" ? "all" : (visible[0]?.id ?? "all");
  const channels = [...new Set((channelRows ?? []).map((c) => c.type as ChannelKey))].sort();
  const askedChannel = one(sp.channel);
  const channel = askedChannel && (channels as string[]).includes(askedChannel) ? (askedChannel as ChannelKey) : "all";

  const tz = workspace.timezone || "UTC";
  const args = { p_workspace: workspace.id, p_days: range, p_tz: tz, p_team: team === "all" ? null : team };
  const [conv, sales] = await Promise.all([
    supabase.rpc("report_conversations", { ...args, p_channel: channel === "all" ? null : channel }),
    supabase.rpc("report_sales", args),
  ]);
  if (conv.error || sales.error || !conv.data || !sales.data) notFound();

  const report = toReport(conv.data as ConversationsResult, sales.data as SalesResult, {
    tz,
    nameOf: (id) => people.find((p) => p.id === id)?.name ?? "—",
  });
  return (
    <LiveReports
      report={report}
      range={range}
      team={team}
      channel={channel}
      channels={channels}
      teams={teams.map(({ id, name }) => ({ id, name }))}
      teamScope={teamScope}
      myTeams={myTeams}
      canMoney={values === "all" || values === "team"}
      canExport={exportScope !== "none"}
    />
  );
}
