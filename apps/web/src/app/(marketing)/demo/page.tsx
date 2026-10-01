import Link from "next/link";
import { HandoffDemo } from "@/components/marketing/handoff-demo";
import { ManagerHomesPreview } from "@/components/marketing/manager-homes-preview";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  const t = await getT("demo");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

const STEPS = ["one", "two", "three", "four"] as const;

export default async function Demo() {
  const t = await getT("demo");
  const site = await getT("site");
  return (
    <main className="mx-auto grid max-w-6xl gap-14 px-4 py-12">
      <header className="grid gap-3">
        <h1 className="text-4xl font-semibold">{t("title")}</h1>
        <p className="max-w-2xl text-lg text-muted">{t("intro")}</p>
      </header>

      <section className="grid items-start gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid gap-3">
          <h2 className="text-2xl font-semibold">{t("handoff.title")}</h2>
          <ol className="grid list-decimal gap-2 ps-5 text-muted">
            {STEPS.map((k) => (
              <li key={k}>{t.rich(`handoff.steps.${k}`, { button: <strong className="text-text">{t("handoff.button")}</strong> })}</li>
            ))}
          </ol>
        </div>
        <HandoffDemo full />
      </section>

      <section className="grid items-start gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid gap-3">
          <h2 className="text-2xl font-semibold">{t("homes.title")}</h2>
          <p className="text-muted">{t("homes.body")}</p>
        </div>
        <ManagerHomesPreview />
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/sign-up" className={buttonClass("primary")}>{site("startTrial")}</Link>
        <Link href="/" className={buttonClass("secondary")}>{t("back")}</Link>
      </div>
    </main>
  );
}
