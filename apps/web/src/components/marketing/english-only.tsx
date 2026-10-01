import { getLocale, getT } from "@/i18n/server";

/**
 * Legal pages stay in English until a lawyer reviews an Arabic version (a draft translation of a
 * contract is worse than none). In Arabic, say so above the English text, in Arabic.
 */
export async function EnglishOnlyNotice() {
  if ((await getLocale()) === "en") return null;
  const t = await getT("language");
  return (
    <p lang="ar" dir="rtl" className="rounded-[var(--radius-control)] bg-surface-2 p-4 text-sm">
      {t("legalEnglishOnly")}
    </p>
  );
}
