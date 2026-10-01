import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { GetReady } from "@/components/whatsapp/get-ready";
import { can, loadWorkspace } from "@/lib/workspace";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("settings"))("whatsapp") };
}

/* Until Meta approves our platform nobody can connect, so the real page is the get-ready checklist (decided 2026-09-30). */
export default async function WhatsAppNumbers(props: PageProps<"/w/[slug]/whatsapp">) {
  const { slug } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  const isOwner = await can(workspace.id, "members.manage");
  const t = await getT("numbers");
  return (
    <SettingsFrame base={`/w/${slug}`} active="whatsapp" isOwner={isOwner}>
      <SectionHeader title={t("title")} description={isOwner ? t("descriptionBefore") : t("ownerOnly")} />
      <GetReady teamsHref={`/w/${slug}/teams`} />
    </SettingsFrame>
  );
}
