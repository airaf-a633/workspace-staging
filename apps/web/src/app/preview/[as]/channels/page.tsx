import { ChannelsPage } from "@/components/channels/channels-page";
import { getT, getTimeZone } from "@/i18n/server";
import { PREVIEW_TEAMS, previewInbox, previewScope } from "@/lib/preview";

export async function generateMetadata() {
  return { title: (await getT("settings"))("channels") };
}

export default async function PreviewChannels(props: PageProps<"/preview/[as]/channels">) {
  const { as } = await props.params;
  const tz = await getTimeZone();
  const data = previewInbox(as, tz);
  // Where each inbox's conversations go: the team that holds most of them.
  const teamOf: Record<string, string> = {};
  for (const i of data.inboxes) {
    const convs = data.conversations.filter((c) => c.inboxId === i.id);
    const tally = new Map<string, number>();
    for (const c of convs) tally.set(c.teamId, (tally.get(c.teamId) ?? 0) + 1);
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    teamOf[i.id] = PREVIEW_TEAMS.find((x) => x.id === top)?.name ?? PREVIEW_TEAMS[0].name;
  }
  return (
    <ChannelsPage
      base={`/preview/${as}`}
      inboxes={data.inboxes}
      teamOf={teamOf}
      canManage={previewScope(as, "numbers.manage") !== "none"}
      adding={!!(await props.searchParams).add}
      isOwner={previewScope(as, "members.manage") !== "none"}
    />
  );
}
