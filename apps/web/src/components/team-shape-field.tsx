"use client";

import { useT } from "@/i18n/client";

export type TeamShapeValue = "solo" | "small" | "split" | "delivery";
const SHAPES: TeamShapeValue[] = ["solo", "small", "split", "delivery"];

/** "What does your team look like?" on workspace creation (real and preview). Controlled when `onChange` is given. */
export function TeamShapeField({ value, onChange }: { value?: TeamShapeValue | null; onChange?: (v: TeamShapeValue) => void }) {
  const t = useT("onboarding");
  const common = useT("common");
  return (
    <fieldset className="grid gap-1">
      <legend className="text-sm font-medium">{t("shapeQuestion")} <span className="font-normal text-muted">{common("optionalSr")}</span></legend>
      <p className="text-sm text-muted">{t("shapeHelp")}</p>
      <div className="mt-2 grid gap-2">
        {SHAPES.map((s) => (
          <label key={s} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
            <input
              type="radio"
              name="teamShape"
              value={s}
              {...(onChange ? { checked: value === s, onChange: () => onChange(s) } : {})}
              className="mt-1 size-5 accent-[var(--primary)]"
            />
            <span className="grid">
              <span className="font-medium">{t(`shapes.${s}.title`)}</span>
              <span className="text-sm text-muted">{t(`shapes.${s}.hint`)}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
