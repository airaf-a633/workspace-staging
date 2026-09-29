import { redirect } from "next/navigation";

// Settings opens on Team members, as in the real app.
export default async function PreviewSettings(props: PageProps<"/preview/[as]/settings">) {
  const { as } = await props.params;
  redirect(`/preview/${as}/members`);
}
