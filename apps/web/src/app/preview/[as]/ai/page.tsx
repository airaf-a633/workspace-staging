import { AiSettings } from "@/components/ai/ai-settings";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { getT } from "@/i18n/server";
import { previewAiWorld } from "@/lib/ai-sample";
import { previewScope } from "@/lib/preview";

export async function generateMetadata() {
  return { title: (await getT("settings"))("ai") };
}

export default async function PreviewAiSettings(props: PageProps<"/preview/[as]/ai">) {
  const { as } = await props.params;
  const t = await getT("aiSettings");
  const isOwner = previewScope(as, "members.manage") !== "none";
  return (
    <SettingsFrame base={`/preview/${as}`} active="ai" isOwner={isOwner}>
      <SectionHeader title={t("title")} description={t("description")} />
      <AiSettings isOwner={isOwner} credits={previewAiWorld(as).credits} />
    </SettingsFrame>
  );
}
