import { GatedChannelPage } from "@/components/channels/gated-page";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("gatedChannels"))("title", { channel: (await getT())("channels.wechat") }) };
}

/** wechat can't be connected yet: what it needs, and a button that saves a request for access. */
export default async function NewWechat(props: PageProps<"/w/[slug]/channels/new/wechat">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  return <GatedChannelPage slug={slug} channel="wechat" requested={sp.requested === "1"} />;
}
