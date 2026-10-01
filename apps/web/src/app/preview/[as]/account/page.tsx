import { AccountPage } from "@/components/account-page";
import { getT } from "@/i18n/server";
import { PREVIEW_WORKSPACE, previewMembers, previewScope } from "@/lib/preview";
import { setupSteps } from "@/lib/setup";

export async function generateMetadata() {
  return { title: (await getT("account"))("title") };
}

export default async function PreviewAccount(props: PageProps<"/preview/[as]/account">) {
  const { as } = await props.params;
  const isOwner = previewScope(as, "members.manage") !== "none";
  const base = `/preview/${as}`;
  // The sample business has connected WhatsApp and invited its team.
  const steps = setupSteps(await getT("setup"), await getT("common"), { shape: "split", memberCount: previewMembers().length, connected: true, base });
  // The preview has no member rows: the language lives in this browser's cookie only.
  return <AccountPage base={base} workspaceName={PREVIEW_WORKSPACE.name} isOwner={isOwner} steps={steps} saveLanguageToProfile={false} />;
}
