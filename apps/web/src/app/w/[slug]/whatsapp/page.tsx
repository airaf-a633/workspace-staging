import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { GetReady } from "@/components/whatsapp/get-ready";
import { can, loadWorkspace } from "@/lib/workspace";

export const metadata = { title: "WhatsApp numbers" };

/* Until Meta approves our platform nobody can connect, so the real page is the get-ready checklist (decided 2026-09-30). */
export default async function WhatsAppNumbers(props: PageProps<"/w/[slug]/whatsapp">) {
  const { slug } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  const isOwner = await can(workspace.id, "members.manage");
  return (
    <SettingsFrame base={`/w/${slug}`} active="whatsapp" isOwner={isOwner}>
      <SectionHeader title="WhatsApp numbers" description={isOwner ? "Connect the numbers your customers write to. Your plan includes one or more." : "Only the owner can connect or change WhatsApp numbers."} />
      <GetReady teamsHref={`/w/${slug}/teams`} />
    </SettingsFrame>
  );
}
