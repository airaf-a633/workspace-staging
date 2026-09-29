import { ManagerHome } from "@/components/home/manager-home";
import { previewInbox, previewPerson } from "@/lib/preview";

export const metadata = { title: "Home" };

export default async function PreviewHome(props: PageProps<"/preview/[as]">) {
  const { as } = await props.params;
  const me = previewPerson(as);
  return <ManagerHome firstName={me.name} template={me.template} data={previewInbox(as)} inboxHref={`/preview/${as}/inbox`} />;
}
