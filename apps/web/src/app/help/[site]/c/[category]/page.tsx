import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ARTICLES, CATEGORIES, HELP_SITE, topic, liveVersion } from "@/components/help/sample";
import { SiteShell } from "@/components/help/site-shell";
import { siteText } from "@/components/help/site-text";
import { langOf, siteFor } from "../../site";

export async function generateMetadata(props: PageProps<"/help/[site]/c/[category]">) {
  const { category } = await props.params;
  return { title: { absolute: `${CATEGORIES.find((c) => c.id === category)?.name ?? ""} · ${HELP_SITE.name}` } };
}

export default async function HelpCategory(props: PageProps<"/help/[site]/c/[category]">) {
  const { site, category } = await props.params;
  const base = siteFor(site);
  const c = CATEGORIES.find((x) => x.id === category);
  if (!c) notFound();
  const lang = langOf((await props.searchParams).lang);
  const s = siteText(lang);
  const suffix = lang === "en" ? "" : `?lang=${lang}`;
  const list = ARTICLES.filter((a) => a.category === c.id && liveVersion(a, lang));
  return (
    <SiteShell base={base} lang={lang}>
      <div className="grid gap-6">
        <Link href={`${base}${suffix}`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />{s("back")}</Link>
        <header className="grid gap-1">
          <h1 className="title text-3xl">{topic(c).name}</h1>
          <p className="text-muted">{topic(c).description}</p>
        </header>
        <ul className="overflow-hidden rounded-[var(--radius-panel)] bg-surface ring-1 ring-border">
          {list.map((a) => (
            <li key={a.id} className="border-b border-border last:border-0">
              <Link href={`${base}/a/${a.slug}${suffix}`} className="block px-5 py-4 hover:bg-surface-2">{liveVersion(a, lang)!.title}</Link>
            </li>
          ))}
        </ul>
      </div>
    </SiteShell>
  );
}
