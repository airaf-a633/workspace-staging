import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChatsCircle } from "@phosphor-icons/react/dist/ssr";
import { ArticleBody } from "@/components/help/article-body";
import { HelpfulVote } from "@/components/help/helpful-vote";
import { ARTICLES, CATEGORIES, HELP_SITE, topic, liveVersion } from "@/components/help/sample";
import { SiteShell } from "@/components/help/site-shell";
import { siteText } from "@/components/help/site-text";
import { langOf, siteFor } from "../../site";

const published = (slug: string) => ARTICLES.find((a) => a.slug === slug && a.status === "published");

export async function generateMetadata(props: PageProps<"/help/[site]/a/[slug]">) {
  const { slug } = await props.params;
  const lang = langOf((await props.searchParams).lang);
  const a = published(slug);
  return { title: { absolute: `${((a && liveVersion(a, lang)) ?? a?.versions.en)?.title ?? ""} · ${HELP_SITE.name}` } };
}

export default async function HelpArticle(props: PageProps<"/help/[site]/a/[slug]">) {
  const { site, slug } = await props.params;
  const base = siteFor(site);
  const a = published(slug);
  if (!a) notFound();
  const lang = langOf((await props.searchParams).lang);
  const s = siteText(lang);
  const suffix = lang === "en" ? "" : `?lang=${lang}`;
  const v = liveVersion(a, lang);
  const category = CATEGORIES.find((c) => c.id === a.category)!;
  const related = ARTICLES.filter((x) => x.id !== a.id && x.category === a.category && liveVersion(x, lang)).slice(0, 3);
  return (
    <SiteShell base={base} lang={lang}>
      <article className="grid gap-6">
        <Link href={`${base}/c/${category.id}${suffix}`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />{topic(category).name}</Link>
        {v ? (
          <>
            <header className="grid gap-1">
              <h1 className="title text-3xl">{v.title}</h1>
              <p className="text-sm text-muted">{a.updatedDaysAgo === 0 ? s("updatedToday") : s("updated", { days: a.updatedDaysAgo })}</p>
            </header>
            <ArticleBody body={v.body} className="max-w-[68ch] text-[17px]" />
          </>
        ) : (
          <p className="grid gap-2 rounded-[var(--radius-panel)] bg-surface-2 p-5 text-muted">
            {s("notTranslated")}
          </p>
        )}
        <div className="border-t border-border pt-6"><HelpfulVote lang={lang} /></div>
        {related.length > 0 && (
          <section className="grid gap-2">
            <h2 className="font-semibold">{s("related")}</h2>
            <ul className="grid gap-1.5">
              {related.map((r) => <li key={r.id}><Link href={`${base}/a/${r.slug}${suffix}`} className="text-[var(--primary)] hover:underline" style={{ color: HELP_SITE.color }}>{liveVersion(r, lang)!.title}</Link></li>)}
            </ul>
          </section>
        )}
        <aside className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] bg-surface p-5 ring-1 ring-border">
          <span className="grid gap-0.5"><span className="font-semibold">{s("stillNeed")}</span><span className="text-sm text-muted">{s("chatNote")}</span></span>
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white" style={{ background: HELP_SITE.color }}>
            <ChatsCircle size={20} weight="fill" aria-hidden="true" />{s("chat")}
          </span>
        </aside>
      </article>
    </SiteShell>
  );
}
