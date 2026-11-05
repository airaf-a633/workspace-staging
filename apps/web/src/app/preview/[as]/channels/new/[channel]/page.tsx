import { notFound } from "next/navigation";
import { CHANNELS, type ChannelKey } from "@/components/channels/catalog";
import { ConnectFlow } from "@/components/channels/connect-flow";
import { SettingsFrame } from "@/components/settings-frame";
import { getT } from "@/i18n/server";
import { PREVIEW_TEAMS, PREVIEW_WORKSPACE, previewScope } from "@/lib/preview";

export async function generateMetadata(props: PageProps<"/preview/[as]/channels/new/[channel]">) {
  const { channel } = await props.params;
  const tAll = await getT();
  const title = tAll("connect.title", { channel: CHANNELS.some((c) => c.key === channel) ? tAll(`channels.${channel as ChannelKey}`) : "" });
  // Browser tabs don't need the bidi isolates the translator adds around inserted words.
  return { title: title.replace(/[⁨⁩]/g, "") };
}

export default async function PreviewConnect(props: PageProps<"/preview/[as]/channels/new/[channel]">) {
  const { as, channel } = await props.params;
  if (!CHANNELS.some((c) => c.key === channel)) notFound();
  return (
    <SettingsFrame base={`/preview/${as}`} active="channels" isOwner={previewScope(as, "members.manage") !== "none"}>
      <ConnectFlow
        key={channel}
        base={`/preview/${as}`}
        ch={channel as ChannelKey}
        business={PREVIEW_WORKSPACE.name}
        teams={PREVIEW_TEAMS.map(({ id, name }) => ({ id, name }))}
        canManage={previewScope(as, "numbers.manage") !== "none"}
      />
    </SettingsFrame>
  );
}
