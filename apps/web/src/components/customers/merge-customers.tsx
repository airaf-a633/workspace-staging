"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { useFormat, useT } from "@/i18n/client";
import { valueLabel } from "@/i18n/labels";
import type { Person } from "@/components/inbox/types";
import type { Customer } from "./types";

type Field = "name" | "phone" | "email" | "company" | "language" | "area" | "type" | "ownerId";
const FIELDS: Field[] = ["name", "phone", "email", "company", "language", "area", "type", "ownerId"];

/**
 * Merging is always manual (PRODUCT_DECISIONS §5). Both records side by side; where they differ, pick which value to keep.
 * Timelines, deals, follow-ups, orders and tags combine. Logged; not undone automatically.
 */
export function MergeCustomers({ a, b, people, base, now }: { a: Customer; b: Customer; people: Person[]; base: string; now: number }) {
  const t = useT("merge");
  const tAll = useT();
  const fmt = useFormat();
  const show = (f: Field, c: Customer) =>
    (f === "ownerId" ? people.find((p) => p.id === c.ownerId)?.name
    : f === "language" ? valueLabel(tAll, "language", c.language)
    : f === "type" ? valueLabel(tAll, "customerType", c.type)
    : c[f]) ?? "";
  const differing = FIELDS.filter((f) => show(f, a) && show(f, b) && show(f, a) !== show(f, b));
  const [pick, setPick] = useState<Record<string, "a" | "b">>(Object.fromEntries(differing.map((f) => [f, "a"])));
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const tags = [...new Set([...a.tags, ...b.tags])];

  const kept = FIELDS.map((f) => {
    const va = show(f, a), vb = show(f, b);
    const value = pick[f] ? (pick[f] === "a" ? va : vb) : va || vb;
    return [t(`fields.${f}`), value] as const;
  }).filter(([, v]) => v);

  if (done) {
    return (
      <div className="grid max-w-xl gap-4 rounded-[var(--radius-panel)] bg-surface p-6 shadow-[var(--shadow-1)] ring-1 ring-border">
        <p className="flex items-center gap-2 font-semibold"><Check size={20} className="text-done" aria-hidden="true" /> {t("done")}</p>
        <p className="text-muted">{t("doneBody", { name: kept[0][1] })}</p>
        <Link href={`${base}/customers/${a.id}`} className={buttonClass("secondary", "sm", "w-fit")}>{t("backTo", { name: a.name })}</Link>
      </div>
    );
  }

  const card = (c: Customer, side: "a" | "b") => (
    <div className="grid content-start gap-1 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{side === "a" ? t("thisCustomer") : t("duplicate")}</p>
      <p className="text-lg font-semibold"><bdi>{c.name}</bdi></p>
      <p className="text-sm text-muted">
        {t("summary", { source: valueLabel(tAll, "source", c.source), count: c.timeline.length, last: c.lastContact ? fmt.ago(c.lastContact.at, now) : t("never") })}
      </p>
    </div>
  );

  return (
    <div className="grid gap-6">
      <Link href={`${base}/customers/${a.id}`} className="-mb-2 inline-flex min-h-9 w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {a.name}
      </Link>
      <header className="grid gap-1">
        <h1 className="title text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-muted">{t("intro")}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {card(a, "a")}
        {card(b, "b")}
      </div>

      {differing.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">{t("choose")}</h2>
          <div className="overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border">
            {differing.map((f) => (
              <fieldset key={f} className="grid gap-2 border-b border-border px-5 py-4 last:border-0 md:grid-cols-[8rem_1fr_1fr] md:items-center">
                <legend className="sr-only">{t(`fields.${f}`)}</legend>
                <span aria-hidden="true" className="text-sm text-muted">{t(`fields.${f}`)}</span>
                {(["a", "b"] as const).map((side) => (
                  <label key={side} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border px-3 ${pick[f] === side ? "border-primary bg-primary-soft" : "border-border"}`}>
                    <input type="radio" name={f} checked={pick[f] === side} onChange={() => setPick({ ...pick, [f]: side })} className="size-4 accent-[var(--primary)]" />
                    <bdi className="break-all">{show(f, side === "a" ? a : b)}</bdi>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">{t("whatHappens")}</h2>
        <ul className="grid gap-2 rounded-[var(--radius-panel)] bg-surface p-5 text-sm shadow-[var(--shadow-1)] ring-1 ring-border">
          <li>{t.rich("one", { name: <strong className="font-semibold">{kept[0][1]}</strong>, details: fmt.list(kept.slice(1).map(([l, v]) => t("detail", { field: fmt.locale === "en" ? l.toLowerCase() : l, value: v }))) })}</li>
          <li>{t("timelines", { count: a.timeline.length + b.timeline.length })}</li>
          <li>{t("moves", { deals: a.deals.length + b.deals.length, tasks: a.tasks.length + b.tasks.length, orders: a.orders.length + b.orders.length })}</li>
          {tags.length > 0 && <li>{t("tags", { tags: fmt.list(tags) })}</li>}
          <li className="text-muted">{t("audit")}</li>
        </ul>
      </section>

      {confirming ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] bg-warn-soft p-4 text-sm">
          <span>{t.rich("confirm", { b: <strong className="font-semibold">{b.name}</strong>, a: <strong className="font-semibold">{a.name}</strong> })}</span>
          <span className="flex gap-2">
            <button type="button" onClick={() => setConfirming(false)} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</button>
            <button type="button" onClick={() => setDone(true)} className={buttonClass("primary", "sm")}>{t("yes")}</button>
          </span>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Link href={`${base}/customers/${a.id}`} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</Link>
          <button type="button" onClick={() => setConfirming(true)} className={buttonClass("primary", "sm")}>{t("submit")}</button>
        </div>
      )}
    </div>
  );
}
