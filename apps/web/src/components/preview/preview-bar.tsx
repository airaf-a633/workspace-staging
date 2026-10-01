"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Eye } from "@phosphor-icons/react";
import { LanguageSwitch } from "@/components/language-switch";
import { useT } from "@/i18n/client";

/** The strip above every preview screen: what this is, who you're viewing as, and the language. */
export function PreviewBar({ current, people }: { current: string; people: { key: string; name: string; role: string }[] }) {
  const path = usePathname();
  const router = useRouter();
  const t = useT("preview");
  const common = useT("common");

  function switchTo(key: string) {
    // Keep the same screen, swap the person: /preview/priya/inbox -> /preview/sara/inbox
    router.push(path.replace(`/preview/${current}`, `/preview/${key}`) + window.location.search);
  }

  return (
    <div className="bg-hero flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1 text-sm text-white">
      <p className="flex items-center gap-2">
        <Eye size={18} aria-hidden="true" />
        <span><strong className="font-semibold">{t("bar.title")}</strong><span className="hidden sm:inline"> · {t("bar.note")}</span></span>
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex items-center gap-2">
          <span className="text-white/80">{t("bar.viewingAs")}</span>
          <select
            value={current}
            onChange={(e) => switchTo(e.target.value)}
            className="glass min-h-8 rounded-full px-3 text-sm text-white [&>option]:text-[#0F2537]"
          >
            {people.map((p) => (
              <option key={p.key} value={p.key}>{common("nameRole", { name: p.name, role: p.role })}</option>
            ))}
          </select>
        </label>
        <LanguageSwitch tone="glass" />
        <Link href="/preview" className="text-white/85 underline-offset-4 hover:underline">{t("bar.allScreens")}</Link>
      </div>
    </div>
  );
}
