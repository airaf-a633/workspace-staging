import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { ARTICLES, CATEGORIES, HELP_SITE, topic, liveVersion } from "@/components/help/sample";
import { SiteSearch } from "@/components/help/site-search";
import { SiteShell } from "@/components/help/site-shell";
import { siteText } from "@/components/help/site-text";
import { langOf, siteFor } from "./site";

export const metadata = { title: { absolute: HELP_SITE.name } };

/* The public help site's front page: search first, then topics, then what most people read. */
export default async function HelpHome(props: PageProps<"/help/[site]">) {
  const { site } = await props.params;
  const base = siteFor(site);
  const lang = langOf((await props.searchParams).lang);
  const s = siteText(lang);
  const suffix = lang === "en" ? "" : `?lang=${lang}`;
  const live = ARTICLES.filter((a) => liveVersion(a, lang));
  const popular = [...live].sort((a, b) => b.views - a.views).slice(0, 5);
  return (
    <SiteShell base={base} lang={lang}>
      <div className="grid gap-10">
        <SiteSearch base={base} lang={lang} />
        <section className="grid gap-px overflow-hidden rounded-[var(--radius-panel)] bg-border ring-1 ring-border sm:grid-cols-2">
          {CATEGORIES.map((c, i) => {
            const n = live.filter((a) => a.category === c.id).length;
            return (
              <Link key={c.id} href={`${base}/c/${c.id}${suffix}`} className={`grid gap-1 bg-surface p-5 hover:bg-surface-2 ${i === CATEGORIES.length - 1 && CATEGORIES.length % 2 ? "sm:col-span-2" : ""}`}>
                <span className="font-semibold">{topic(c).name}</span>
                <span className="text-sm text-muted">{topic(c).description}</span>
                <span className="text-xs text-muted">{s("articles", { n })}</span>
              </Link>
            );
          })}
        </section>
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">{s("popular")}</h2>
          <ul className="overflow-hidden rounded-[var(--radius-panel)] bg-surface ring-1 ring-border">
            {popular.map((a) => (
              <li key={a.id} className="border-b border-border last:border-0">
                <Link href={`${base}/a/${a.slug}${suffix}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-2">
                  {liveVersion(a, lang)!.title}
                  <CaretRight size={16} className="shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </SiteShell>
  );
}
