import { ChannelsPage } from "@/components/channels/channels-page";
import type { ChannelInbox } from "@/components/inbox/types";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";

export async function generateMetadata() {
  return { title: (await getT("settings"))("channels") };
}

/* Settings › Channels in a real workspace. WhatsApp is the only channel that connects for real so far (M2). */
export default async function Channels(props: PageProps<"/w/[slug]/channels">) {
  const { slug } = await props.params;
  const { supabase, workspace } = await loadWorkspace(slug);
  const { data: accounts } = await supabase
    .from("whatsapp_accounts")
    .select("id, display_phone, verified_name, status, teams(name)")
    .eq("workspace_id", workspace.id)
    .order("created_at");
  const rows = (accounts ?? []) as unknown as { id: string; display_phone: string; verified_name: string | null; status: string; teams: { name: string } | null }[];
  const inboxes: ChannelInbox[] = rows.map((a) => ({
    id: a.id,
    channel: "whatsapp",
    name: a.verified_name ?? "WhatsApp",
    address: a.display_phone,
    broken: a.status === "disconnected" ? "tokenExpired" : undefined,
  }));
  const teamOf = Object.fromEntries(rows.filter((a) => a.teams).map((a) => [a.id, a.teams!.name]));
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
