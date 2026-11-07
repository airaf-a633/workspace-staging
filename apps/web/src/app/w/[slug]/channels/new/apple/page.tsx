import { GatedChannelPage } from "@/components/channels/gated-page";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("gatedChannels"))("title", { channel: (await getT())("channels.apple") }) };
}

/** apple can't be connected yet: what it needs, and a button that saves a request for access. */
export default async function NewApple(props: PageProps<"/w/[slug]/channels/new/apple">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  return <GatedChannelPage slug={slug} channel="apple" requested={sp.requested === "1"} />;
}
