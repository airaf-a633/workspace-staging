import { notFound } from "next/navigation";
import { InboxSettings } from "@/components/channels/inbox-settings";
import { SAMPLE_INBOXES } from "@/components/inbox/sample-data";
import { SettingsFrame } from "@/components/settings-frame";
import { getTimeZone } from "@/i18n/server";
import { PREVIEW_TEAMS, PREVIEW_WORKSPACE, previewInbox, previewScope } from "@/lib/preview";

export async function generateMetadata(props: PageProps<"/preview/[as]/channels/[id]">) {
  const { id } = await props.params;
  return { title: SAMPLE_INBOXES.find((i) => i.id === id)?.name ?? "" };
}

export default async function PreviewInboxSettings(props: PageProps<"/preview/[as]/channels/[id]">) {
  const { as, id } = await props.params;
  const inbox = SAMPLE_INBOXES.find((i) => i.id === id);
  if (!inbox) notFound();
  const data = previewInbox(as, await getTimeZone());
  const first = data.conversations.find((c) => c.inboxId === id);
  return (
    <SettingsFrame base={`/preview/${as}`} active="channels" isOwner={previewScope(as, "members.manage") !== "none"}>
      <InboxSettings
        key={id}
        base={`/preview/${as}`}
        inbox={inbox}
        teams={PREVIEW_TEAMS.map(({ id, name }) => ({ id, name }))}
        teamId={first?.teamId ?? PREVIEW_TEAMS[0].id}
        business={PREVIEW_WORKSPACE.name}
        canManage={previewScope(as, "numbers.manage") !== "none"}
      />
    </SettingsFrame>
  );
}
