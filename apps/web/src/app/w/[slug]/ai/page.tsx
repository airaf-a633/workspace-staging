import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { EmptyState } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";

export async function generateMetadata() {
  return { title: (await getT("settings"))("ai") };
}

/* AI switches on with its milestone (docs/AI_PLAN.md). Until then the page says what's coming, honestly. */
export default async function AiSettingsPage(props: PageProps<"/w/[slug]/ai">) {
  const { slug } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  const t = await getT("aiSettings");
  return (
    <SettingsFrame base={`/w/${slug}`} active="ai" isOwner={await can(workspace.id, "members.manage")}>
      <SectionHeader title={t("title")} description={t("description")} />
      <EmptyState icon={<Sparkle size={40} />} title={t("soonTitle")}>{t("soonBody")}</EmptyState>
    </SettingsFrame>
  );
}
