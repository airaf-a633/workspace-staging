import { redirect } from "next/navigation";

// Settings is one page with a side sub-menu; it opens on Team members (decided 2026-09-30).
export default async function Settings(props: PageProps<"/w/[slug]/settings">) {
  const { slug } = await props.params;
  redirect(`/w/${slug}/members`);
}
