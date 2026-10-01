"use client";

import Link from "next/link";
import { useState } from "react";
import { Circle } from "@phosphor-icons/react";
import { TeamShapeField, type TeamShapeValue } from "@/components/team-shape-field";
import { buttonClass } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import { setupSteps } from "@/lib/setup";

/* Workspace creation and the setup checklist it shapes (PRODUCT_DECISIONS §14), without saving anything. */
export function PreviewOnboarding() {
  const [step, setStep] = useState<"create" | "checklist">("create");
  const [name, setName] = useState("Qamar Electronics");
  const [shape, setShape] = useState<TeamShapeValue | null>(null);
  const t = useT("onboarding");
  const setup = useT("setup");
  const common = useT("common");
  const home = useT("home");

  if (step === "create") {
    return (
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          setStep("checklist");
        }}
      >
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{t("businessName")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base" />
        </label>
        <TeamShapeField value={shape} onChange={setShape} />
        <button type="submit" className={buttonClass("primary", "md", "w-full")}>{t("create")}</button>
      </form>
    );
  }

  // The same checklist the real Home shows, shaped by the answer above.
  const steps = setupSteps(setup, common, { shape, memberCount: 1, connected: false, base: "/preview" });

  return (
    <div className="grid gap-5">
      <p className="text-muted">{t.rich("ready", { name: <strong className="font-medium text-text">{name || t("yourBusiness")}</strong> })}</p>
      <ol className="grid gap-1">
        {steps.map((s) => (
          <li key={s.title} className="flex items-start gap-3 rounded-[var(--radius-control)] p-3">
            <Circle size={24} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
            <span className="grid gap-0.5">
              <span className="font-medium">{s.title}</span>
              <span className="text-sm text-muted">{s.body}</span>
              {s.soon && <span className="text-sm italic text-muted">{s.soon}</span>}
            </span>
          </li>
        ))}
      </ol>
      {shape === "delivery" && (
        <p className="rounded-[var(--radius-control)] bg-surface-2 p-3 text-sm">{home.rich("deliveryNote", { title: <strong className="font-medium">{home("deliveryTitle")}</strong> })}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Link href="/preview/khalid" className={buttonClass("primary")}>{t("seeOwnerHome")}</Link>
        <button type="button" onClick={() => setStep("create")} className={buttonClass("ghost")}>{common("back")}</button>
      </div>
    </div>
  );
}
