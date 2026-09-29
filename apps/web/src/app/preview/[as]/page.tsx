import { ManagerHome } from "@/components/home/manager-home";
import { previewInbox, previewPerson } from "@/lib/preview";

export const metadata = { title: "Home" };

export default async function PreviewHome(props: PageProps<"/preview/[as]">) {
  const { as } = await props.params;
  const me = previewPerson(as);
  // The sample business has connected WhatsApp and invited its team; hours, import and store are still open.
  const setup = me.template === "owner" ? { done: 2, total: 5, href: "/preview/onboarding" } : undefined;
  return <ManagerHome firstName={me.name} template={me.template} data={previewInbox(as)} inboxHref={`/preview/${as}/inbox`} setup={setup} />;
}
