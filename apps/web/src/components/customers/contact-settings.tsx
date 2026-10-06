"use client";

import { useState } from "react";
import { Info, Plus, X } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import type { CustomFieldDef } from "./types";

const RETENTION = ["never", "6", "12", "24", "36"] as const;
type Retention = (typeof RETENTION)[number];

/**
 * Settings › Contacts and privacy (decided 2026-10-07): the fields every contact has, the tags, matching people
 * to companies by email domain, and how long conversations are kept. Fields and tags need crm.settings;
 * retention is for owners and admins.
 */
export function ContactSettings({ initialFields, tags: initialTags, canFields, canRetention }: { initialFields: CustomFieldDef[]; tags: string[]; canFields: boolean; canRetention: boolean }) {
  const t = useT("contactSettings");
  const tAll = useT();
  const [fields, setFields] = useState(initialFields);
  const [draft, setDraft] = useState<{ label: string; type: CustomFieldDef["type"]; options: string }>({ label: "", type: "text", options: "" });
  const [tags, setTags] = useState(initialTags);
  const [tag, setTag] = useState("");
  const [domains, setDomains] = useState(true);
  const [retention, setRetention] = useState<Retention>("never");
  const [confirmRetention, setConfirmRetention] = useState<Retention | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const field = "min-h-10 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm disabled:opacity-60";
  const card = "grid gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-5 sm:p-6";
  const labelTaken = fields.some((f) => f.label.toLowerCase() === draft.label.trim().toLowerCase());

  function addField(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.label.trim() || labelTaken) return;
    const options = draft.type === "select" ? draft.options.split(",").map((o) => o.trim()).filter(Boolean) : undefined;
    if (draft.type === "select" && !options?.length) return;
    setFields([...fields, { key: `f${fields.length}-${draft.label.trim().toLowerCase().replace(/\W+/g, "-")}`, label: draft.label.trim(), type: draft.type, options }]);
    setDraft({ label: "", type: "text", options: "" });
    setSaved(t("fieldAdded"));
  }

  return (
    <div className="grid gap-6">
      {saved && <p role="status" className="flex items-center gap-2 rounded-[var(--radius-control)] bg-done-soft px-4 py-2 text-sm"><Info size={16} aria-hidden="true" />{saved} {t("previewNote")}</p>}

      <section className={card} aria-labelledby="cs-fields">
        <div className="grid gap-1">
          <h2 id="cs-fields" className="text-base font-semibold">{t("fields")}</h2>
          <p className="text-sm text-muted">{t("fieldsHelp")}</p>
        </div>
        <ul className="divide-y divide-border rounded-[var(--radius-control)] border border-border">
          {fields.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="grid">
                <span className="font-medium">{f.label}</span>
                <span className="text-xs text-muted">{t(`types.${f.type}`)}{f.options ? `: ${f.options.join(", ")}` : ""}</span>
              </span>
              {canFields && (
                <button type="button" onClick={() => setFields(fields.filter((x) => x.key !== f.key))} className={buttonClass("ghost", "sm", "!px-2")} aria-label={t("removeField", { name: f.label })}>
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {canFields && (
          <form onSubmit={addField} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
            <label className="grid gap-1 text-sm font-medium">
              {t("fieldName")}
              <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} maxLength={40} className={field} aria-invalid={labelTaken} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              {t("fieldType")}
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as CustomFieldDef["type"] })} className={field}>
                {(["text", "number", "date", "select"] as const).map((x) => <option key={x} value={x}>{t(`types.${x}`)}</option>)}
              </select>
            </label>
            <button type="submit" disabled={!draft.label.trim() || labelTaken} className={buttonClass("secondary", "sm")}><Plus size={16} aria-hidden="true" /> {t("addField")}</button>
            {draft.type === "select" && (
              <label className="grid gap-1 text-sm font-medium sm:col-span-3">
                {t("options")}
                <input value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} placeholder="Bronze, Silver, Gold" className={field} />
              </label>
            )}
            {labelTaken && <p role="alert" className="text-sm text-fail sm:col-span-3">{t("fieldTaken")}</p>}
          </form>
        )}
      </section>

      <section className={card} aria-labelledby="cs-tags">
        <div className="grid gap-1">
          <h2 id="cs-tags" className="text-base font-semibold">{t("tags")}</h2>
          <p className="text-sm text-muted">{t("tagsHelp")}</p>
        </div>
        <ul className="flex flex-wrap gap-2">
          {tags.map((x) => (
            <li key={x} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 ps-3 pe-1.5 text-sm">
              {x}
              {canFields && <button type="button" onClick={() => setTags(tags.filter((y) => y !== x))} className="grid size-6 place-items-center rounded-full hover:bg-border" aria-label={t("removeTag", { tag: x })}><X size={12} aria-hidden="true" /></button>}
            </li>
          ))}
        </ul>
        {canFields && (
          <form onSubmit={(e) => { e.preventDefault(); if (tag.trim() && !tags.includes(tag.trim())) setTags([...tags, tag.trim()]); setTag(""); }} className="flex gap-2">
            <input value={tag} onChange={(e) => setTag(e.target.value)} maxLength={30} placeholder={t("newTag")} aria-label={t("newTag")} className={`${field} max-w-60`} />
            <button type="submit" disabled={!tag.trim()} className={buttonClass("secondary", "sm")}>{tAll("common.add")}</button>
          </form>
        )}
      </section>

      <section className={card} aria-labelledby="cs-companies">
        <h2 id="cs-companies" className="text-base font-semibold">{t("companies")}</h2>
        <label className="flex items-start justify-between gap-4">
          <span className="grid"><span className="text-sm font-medium">{t("domainMatch")}</span><span className="text-xs text-muted">{t("domainMatchHelp")}</span></span>
          <input type="checkbox" role="switch" checked={domains} disabled={!canFields} onChange={(e) => setDomains(e.target.checked)} className="mt-0.5 size-5 accent-[var(--primary)]" />
        </label>
      </section>

      <section className={card} aria-labelledby="cs-retention">
        <div className="grid gap-1">
          <h2 id="cs-retention" className="text-base font-semibold">{t("retention")}</h2>
          <p className="text-sm text-muted">{t("retentionHelp")}</p>
        </div>
        <label className="grid gap-1 text-sm font-medium sm:max-w-sm">
          {t("keep")}
          <select
            value={confirmRetention ?? retention}
            disabled={!canRetention}
            onChange={(e) => {
              const v = e.target.value as Retention;
              // Shortening retention deletes data, so it asks first; lengthening or "never" applies straight away.
              if (v !== "never" && (retention === "never" || Number(v) < Number(retention))) setConfirmRetention(v);
              else { setRetention(v); setConfirmRetention(null); setSaved(t("retentionSaved")); }
            }}
            className={field}
          >
            {RETENTION.map((r) => <option key={r} value={r}>{r === "never" ? t("forever") : t("months", { count: Number(r) })}</option>)}
          </select>
        </label>
        {confirmRetention && (
          <div role="alert" className="grid gap-3 rounded-[var(--radius-control)] bg-warn-soft p-4 text-sm">
            <p>{t("retentionConfirm", { months: Number(confirmRetention) })}</p>
            <span className="flex gap-2">
              <button type="button" onClick={() => setConfirmRetention(null)} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</button>
              <button type="button" onClick={() => { setRetention(confirmRetention); setConfirmRetention(null); setSaved(t("retentionSaved")); }} className={buttonClass("primary", "sm")}>{t("retentionApply")}</button>
            </span>
          </div>
        )}
        {!canRetention && <p className="text-sm text-muted">{t("retentionOwner")}</p>}
      </section>
    </div>
  );
}
