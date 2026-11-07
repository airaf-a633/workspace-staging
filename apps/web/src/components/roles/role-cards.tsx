import type { ReactNode } from "react";
import { Check, Minus } from "@phosphor-icons/react/dist/ssr";
import { ROLE_TEMPLATES, type RoleTemplateKey } from "@app/domain";
import { getT } from "@/i18n/server";

/**
 * Roles in plain sentences (simplicity pass 2026-10-19): one card per built-in role saying who it's for, what they
 * can do and the one thing they can't. The full permission grid stays one click away for people who want it.
 */
const POINTS = ["one", "two", "three"] as const;

export async function RoleCards({ grid }: { grid: ReactNode }) {
  const t = await getT("rolesPage");
  const tAll = await getT();
  const keys: RoleTemplateKey[] = ROLE_TEMPLATES.map((r) => r.key);

  return (
    <div className="grid gap-4">
      <ul className="grid gap-3 md:grid-cols-2">
        {keys.map((k) => (
          <li key={k} className="grid content-start gap-3 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border">
            <div className="grid gap-0.5">
              <h3 className="font-semibold">{tAll(`roles.${k}`)}</h3>
              <p className="text-sm text-muted">{t(`cards.${k}.who`)}</p>
            </div>
            <ul className="grid gap-1.5 text-sm">
              {POINTS.map((p) => (
                <li key={p} className="flex gap-2">
                  <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  {t(`cards.${k}.can.${p}`)}
                </li>
              ))}
              <li className="flex gap-2 text-muted">
                <Minus size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                {t(`cards.${k}.cant`)}
              </li>
            </ul>
          </li>
        ))}
      </ul>
      <details className="group rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 font-medium [&::-webkit-details-marker]:hidden">
          {t("compareAll")}
          <span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="grid gap-2 border-t border-border px-5 pb-5 pt-4">
          <p className="text-sm text-muted">{t("matrixHelp")}</p>
          {grid}
        </div>
      </details>
    </div>
  );
}
