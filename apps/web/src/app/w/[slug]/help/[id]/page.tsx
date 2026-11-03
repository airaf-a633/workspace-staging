import { notFound } from "next/navigation";
import { ArticleEditor } from "@/components/help/article-editor";
import { ARTICLES } from "@/components/help/sample";
import { PreviewNotice } from "@/components/preview-notice";
import { getT } from "@/i18n/server";
import { loadWorkspace, scopeOf } from "@/lib/workspace";

export async function generateMetadata(props: PageProps<"/w/[slug]/help/[id]">) {
  const { id } = await props.params;
  return { title: ARTICLES.find((a) => a.id === id)?.versions.en?.title ?? (await getT("helpCenter"))("newArticle") };
}

export default async function Article(props: PageProps<"/w/[slug]/help/[id]">) {
  const { slug, id } = await props.params;
  const sp = await props.searchParams;
  const { workspace } = await loadWorkspace(slug);
  const [use, manage] = await Promise.all([scopeOf(workspace.id, "canned.use"), scopeOf(workspace.id, "canned.manage")]);
  if (use === "none") notFound();
  const article = id === "new" ? null : ARTICLES.find((a) => a.id === id);
  if (article === undefined) notFound();
  const title = typeof sp.title === "string" ? sp.title.slice(0, 120) : undefined;
  return (
    <>
      <PreviewNotice />
      <ArticleEditor key={id} base={`/w/${slug}`} article={article} initialTitle={title} canPublish={manage !== "none"} />
    </>
  );
}
