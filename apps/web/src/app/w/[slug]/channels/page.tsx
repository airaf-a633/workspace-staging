import { ChannelsPage } from "@/components/channels/channels-page";
import { getT } from "@/i18n/server";
import { loadChannelInboxes } from "@/lib/inbox-live";
import { can, loadWorkspace } from "@/lib/workspace";

export async function generateMetadata() {
  return { title: (await getT("settings"))("channels") };
}

/* Settings › Channels in a real workspace: every connected channel. WhatsApp is the only one that connects for real so far. */
export default async function Channels(props: PageProps<"/w/[slug]/channels">) {
  const { slug } = await props.params;
  const { supabase, workspace } = await loadWorkspace(slug);
  const inboxes = await loadChannelInboxes(supabase, workspace.id);
  const { data: routed } = await supabase.from("channels").select("id, teams(name)").eq("workspace_id", workspace.id).not("team_id", "is", null);
  const teamOf = Object.fromEntries(((routed ?? []) as unknown as { id: string; teams: { name: string } | null }[]).filter((c) => c.teams).map((c) => [c.id, c.teams!.name]));
  return (
    <ChannelsPage
      base={`/w/${slug}`}
      inboxes={inboxes}
      teamOf={teamOf}
      openCount={{}}
      canManage={await can(workspace.id, "numbers.manage")}
      isOwner={await can(workspace.id, "members.manage")}
      live
    />
  );
}
