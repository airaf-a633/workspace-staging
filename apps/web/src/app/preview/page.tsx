import Link from "next/link";
import { ArrowRight, ChatsCircle, House, Gear, UserPlus } from "@phosphor-icons/react/dist/ssr";
import { RelayLogo } from "@/components/brand/logo";
import { LanguageSwitch } from "@/components/language-switch";
import { roleLabel } from "@/i18n/labels";
import { getT } from "@/i18n/server";
import { PREVIEW_PEOPLE, previewMembers } from "@/lib/preview";

export async function generateMetadata() {
  const t = await getT("preview");
  const meta = await getT("meta");
  return { title: { absolute: `${t("index.metaTitle")} · ${meta("name")}` } };
}

export default async function PreviewIndex() {
  const members = previewMembers();
  const tAll = await getT();
  const t = await getT("preview");
  const nav = await getT("nav");
  const meta = await getT("meta");

  return (
    <main className="force-light min-h-dvh bg-bg text-text">
      <section className="border-b border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-14 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" aria-label={meta("name")}><RelayLogo size={26} /></Link>
            <LanguageSwitch />
          </div>
          <div className="grid max-w-3xl gap-4 pt-8">
            <h1 className="display text-4xl sm:text-5xl">{t("index.title")}</h1>
            <p className="text-lg text-muted">{t("index.intro")}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14">
        <h2 className="text-lg font-semibold">{t("index.viewAs")}</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PREVIEW_PEOPLE.map((p) => {
            const m = members.find((x) => x.key === p.key)!;
            return (
              <li key={p.key}>
                <div className="grid h-full content-start gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-[var(--shadow-1)]">
                  <div className="flex items-center gap-3">
                    <span className="bg-primary grid size-12 place-items-center rounded-full font-semibold text-xl text-white" aria-hidden="true">{p.name[0]}</span>
                    <div>
                      <p className="title text-2xl">{p.name}</p>
                      <p className="text-sm text-muted">{roleLabel(tAll, m.role)}</p>
                    </div>
                  </div>
                  <p className="text-muted">{t(`people.${p.key}`)}</p>
                  <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
                    <Link href={`/preview/${p.key}`} className="inline-flex min-h-11 items-center gap-1.5 text-primary hover:underline"><House size={18} aria-hidden="true" />{nav("home")}</Link>
                    <Link href={`/preview/${p.key}/inbox`} className="inline-flex min-h-11 items-center gap-1.5 text-primary hover:underline"><ChatsCircle size={18} aria-hidden="true" />{nav("inbox")}</Link>
                    <Link href={`/preview/${p.key}/settings`} className="inline-flex min-h-11 items-center gap-1.5 text-primary hover:underline"><Gear size={18} aria-hidden="true" />{nav("settings")}</Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-6 text-lg font-semibold">{t("index.gettingStarted")}</h2>
        <Link href="/preview/sign-up" className="group flex items-center gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-6 transition-colors hover:bg-surface-2">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><UserPlus size={24} aria-hidden="true" /></span>
          <span className="grid flex-1 gap-0.5">
            <span className="font-semibold">{t("index.signUpTitle")}</span>
            <span className="text-sm text-muted">{t("index.signUpBody")}</span>
          </span>
          <ArrowRight size={20} className="text-muted transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
