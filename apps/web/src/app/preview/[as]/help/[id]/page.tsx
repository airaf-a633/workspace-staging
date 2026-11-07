import { notFound, redirect } from "next/navigation";
import { ArticleEditor } from "@/components/help/article-editor";
import { ARTICLES } from "@/components/help/sample";
import { getT } from "@/i18n/server";
import { previewScope } from "@/lib/preview";

export async function generateMetadata(props: PageProps<"/preview/[as]/help/[id]">) {
  const { id } = await props.params;
  return { title: ARTICLES.find((a) => a.id === id)?.versions.en?.title ?? (await getT("helpCenter"))("newArticle") };
}

export default async function PreviewArticle(props: PageProps<"/preview/[as]/help/[id]">) {
  const { as, id } = await props.params;
  if (previewScope(as, "canned.use") === "none") redirect(`/preview/${as}`);
  const sp = await props.searchParams;
  const article = id === "new" ? null : ARTICLES.find((a) => a.id === id);
  if (article === undefined) notFound();
  const title = typeof sp.title === "string" ? sp.title.slice(0, 120) : undefined;
  return <ArticleEditor key={id} base={`/preview/${as}`} article={article} initialTitle={title} canPublish={previewScope(as, "canned.manage") !== "none"} />;
}
