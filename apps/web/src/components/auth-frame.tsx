import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { getT } from "@/i18n/server";

const POINTS = ["phone", "handoff", "noMarkup"] as const;

/**
 * Single-task frame for sign-in, sign-up, workspace creation and invites.
 * Wide screens: the brand atmosphere on one side, the form on the other. Phones: the form alone.
 */
export async function AuthFrame({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const t = await getT("authFrame");
  const meta = await getT("meta");
  return (
    <div className="force-light grid min-h-dvh bg-bg text-text lg:grid-cols-[1fr_1.1fr]">
      <aside className="bg-hero drift hidden flex-col justify-between p-12 text-white lg:flex">
        <Link href="/" className="font-serif text-3xl tracking-tight">{meta("name")}</Link>
        <div className="grid gap-8">
          <p className="display max-w-md text-5xl">{t("headline")}</p>
          <ul className="grid gap-3 text-white/85">
            {POINTS.map((k) => (
              <li key={k} className="flex gap-3"><Check size={22} className="mt-0.5 shrink-0 text-[#8FD9D0]" aria-hidden="true" />{t(`points.${k}`)}</li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/70">{t("footnote")}</p>
      </aside>

      <main className="grid place-items-center px-4 py-10">
        <div className="grid w-full max-w-md gap-6">
          <Link href="/" className="text-center font-serif text-3xl tracking-tight text-primary lg:hidden">{meta("name")}</Link>
          <section className="grid gap-6 rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-[var(--shadow-2)] sm:p-9">
            <header className="grid gap-2">
              <h1 className="title text-3xl">{title}</h1>
              {description && <p className="text-muted">{description}</p>}
            </header>
            {children}
          </section>
          {footer && <div className="text-center text-sm">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
