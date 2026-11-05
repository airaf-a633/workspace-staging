import { notFound } from "next/navigation";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { Submit } from "@/components/ui/submit";
import { Notice } from "@/components/ui/surface";
import { getLocale, getT } from "@/i18n/server";
import { CURRENCIES, currencyName } from "@/lib/currencies";
import { can, loadWorkspace } from "@/lib/workspace";
import { setCurrency } from "./actions";

export async function generateMetadata() {
  return { title: (await getT("settings"))("money") };
}

/* Settings › Currency: the one currency every deal value in this workspace is shown in. Owners only. */
export default async function MoneyPage(props: PageProps<"/w/[slug]/money">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "billing.manage"))) notFound();
  const t = await getT("moneySettings");
  const locale = await getLocale();
  const current = workspace.currency ?? "USD";
  const options = CURRENCIES.includes(current) ? CURRENCIES : [current, ...CURRENCIES];
  return (
    <SettingsFrame base={`/w/${slug}`} active="money" isOwner={await can(workspace.id, "members.manage")}>
      <SectionHeader title={t("title")} description={t("description")} />
      {sp.saved && <Notice tone="success" title={t("saved")} />}
      {sp.error && <Notice tone="error" title={t(sp.error === "notAllowed" ? "notAllowed" : "failed")} />}
      <form action={setCurrency} className="grid gap-4 sm:max-w-sm">
        <input type="hidden" name="slug" value={slug} />
        <label className="grid gap-1.5 text-sm font-medium">
          {t("label")}
          <select name="currency" defaultValue={current} className="min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal">
            {options.map((c) => <option key={c} value={c}>{currencyName(c, locale)}</option>)}
          </select>
          <span className="text-xs font-normal text-muted">{t("help")}</span>
        </label>
        <div><Submit>{t("save")}</Submit></div>
      </form>
    </SettingsFrame>
  );
}
