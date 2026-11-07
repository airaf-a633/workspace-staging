import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { ContactSettingsLive } from "@/components/settings-live";
import { getT } from "@/i18n/server";
import { loadFieldDefs } from "@/lib/customers-live";
import { can, loadWorkspace } from "@/lib/workspace";

export async function generateMetadata() {
  return { title: (await getT("settings"))("contacts") };
}

/* Settings › Contacts on real data (step 2b): the custom fields every customer has. Tags, matching and retention come with step 2c. */
export default async function ContactSettingsPage(props: PageProps<"/w/[slug]/contact-settings">) {
  const { slug } = await props.params;
  const { supabase, workspace } = await loadWorkspace(slug);
  const t = await getT("contactSettings");
  return (
    <SettingsFrame base={`/w/${slug}`} active="contacts" isOwner={await can(workspace.id, "members.manage")}>
      <SectionHeader title={t("title")} description={t("description")} />
      <ContactSettingsLive
        slug={slug}
        initialFields={await loadFieldDefs(supabase, workspace.id)}
        tags={[]}
        canFields={await can(workspace.id, "crm.settings")}
        canRetention={false}
      />
    </SettingsFrame>
  );
}
