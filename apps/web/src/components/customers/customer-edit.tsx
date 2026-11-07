"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import type { Person } from "@/components/inbox/types";
import type { ContactPatch } from "./save";
import type { CustomFieldDef, Customer } from "./types";

/**
 * Editing a customer's details (step 2b, decided 2026-10-20): name, how to reach them, owner, tags, language,
 * area, custom fields and the pinned note. Plain inputs, one Save. Checks the obvious mistakes before sending;
 * the database checks again.
 */
export function CustomerEdit({
  c,
  fields,
  people,
  onSave,
  onCancel,
}: {
  c: Customer;
  fields: CustomFieldDef[];
  people: Person[];
  onSave: (patch: ContactPatch, pinned: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const t = useT("customerEdit");
  const [d, setD] = useState({
    name: c.name,
    email: c.email ?? "",
    phone: c.phone ?? "",
    owner: c.ownerId ?? "",
    tags: c.tags.join(", "),
    language: c.language ?? "",
    area: c.area ?? "",
    fields: { ...c.fields },
    pinned: c.pinned?.text ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const field = "min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base";

  async function save() {
    if (!d.name.trim()) return setError(t("errors.need_name"));
    if (d.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) return setError(t("errors.bad_email"));
    setSaving(true);
    setError(null);
    const result = await onSave(
      {
        name: d.name.trim(),
        email: d.email.trim() || null,
        phone: d.phone.trim() || null,
        owner: d.owner || null,
        tags: d.tags.split(",").map((x) => x.trim()).filter(Boolean),
        language: d.language.trim() || null,
        area: d.area.trim() || null,
        fields: d.fields,
      },
      d.pinned,
    );
    setSaving(false);
    if (result) setError(t(`errors.${result in ERRORS ? (result as keyof typeof ERRORS) : "failed"}`));
  }

  return (
    <form
      className="grid gap-4 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2 className="font-semibold">{t("title")}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">{t("name")}<input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={120} className={field} /></label>
        <label className="grid gap-1.5 text-sm font-medium">{t("email")}<input type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} dir="ltr" className={field} /></label>
        <label className="grid gap-1.5 text-sm font-medium">{t("phone")}<input type="tel" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} dir="ltr" placeholder="+44 7700 900123" className={field} /></label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("owner")}
          <select value={d.owner} onChange={(e) => setD({ ...d, owner: e.target.value })} className={field}>
            <option value="">{t("nobody")}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">{t("tags")}<input value={d.tags} onChange={(e) => setD({ ...d, tags: e.target.value })} placeholder={t("tagsPlaceholder")} className={field} /></label>
        <label className="grid gap-1.5 text-sm font-medium">{t("language")}<input value={d.language} onChange={(e) => setD({ ...d, language: e.target.value })} className={field} /></label>
        <label className="grid gap-1.5 text-sm font-medium">{t("area")}<input value={d.area} onChange={(e) => setD({ ...d, area: e.target.value })} placeholder={t("areaPlaceholder")} className={field} /></label>
        {fields.map((f) => (
          <label key={f.key} className="grid gap-1.5 text-sm font-medium">
            {f.label}
            {f.type === "select" ? (
              <select value={d.fields[f.key] ?? ""} onChange={(e) => setD({ ...d, fields: { ...d.fields, [f.key]: e.target.value } })} className={field}>
                <option value="">—</option>
                {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                value={d.fields[f.key] ?? ""}
                onChange={(e) => setD({ ...d, fields: { ...d.fields, [f.key]: e.target.value } })}
                className={field}
              />
            )}
          </label>
        ))}
        <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
          {t("pinned")}
          <textarea value={d.pinned} onChange={(e) => setD({ ...d, pinned: e.target.value })} rows={2} maxLength={1000} placeholder={t("pinnedPlaceholder")} className={`${field} py-2`} dir="auto" />
          <span className="text-xs font-normal text-muted">{t("pinnedHelp")}</span>
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-fail">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={buttonClass("primary", "sm")}>{saving ? t("saving") : t("save")}</button>
        <button type="button" onClick={onCancel} className={buttonClass("ghost", "sm")}>{t("cancel")}</button>
      </div>
    </form>
  );
}

const ERRORS = { need_name: 1, bad_email: 1, bad_phone: 1, not_allowed: 1, too_long: 1, failed: 1 } as const;
