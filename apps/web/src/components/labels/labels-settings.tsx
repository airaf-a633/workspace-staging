"use client";

import { useState } from "react";
import { PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import type { Label } from "@/components/inbox/types";

/**
 * Settings › Labels (decided 2026-10-19): labels sort chats across every channel ("VIP", "Order issue").
 * Owners and admins (crm.settings) create, rename, recolour and delete them; deleting removes the label from
 * every chat. Session-only in the preview.
 */

export const LABEL_COLORS = ["#B7791F", "#0E7490", "#C2410C", "#4D7C0F", "#475569", "#7C3AED", "#BE185D", "#006ACC"];
const MAX = 40;

function Swatches({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={`size-7 rounded-full ring-offset-2 ring-offset-[var(--color-surface)] ${value === c ? "ring-2 ring-[var(--color-text)]" : ""}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

export function LabelsSettings({
  initial,
  usage,
  canEdit,
  saveTo,
}: {
  initial: Label[];
  usage: Record<string, number>;
  canEdit: boolean;
  /** A real workspace saves labels; the preview leaves this out. */
  saveTo?: { save: (id: string | null, name: string, color: string) => Promise<{ id?: string; error?: string }>; remove: (id: string) => Promise<string | null> };
}) {
  const t = useT("labelsSettings");
  const [labels, setLabels] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[0]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function open(l: Label | "new") {
    setError(null);
    setDeleting(null);
    if (l === "new") {
      setEditing("new");
      setName("");
      setColor(LABEL_COLORS[labels.length % LABEL_COLORS.length]);
    } else {
      setEditing(l.id);
      setName(l.name);
      setColor(l.color);
    }
  }

  function save() {
    const clean = name.trim();
    if (!clean) return setError(t("errors.empty"));
    if (labels.some((l) => l.id !== editing && l.name.toLowerCase() === clean.toLowerCase())) return setError(t("errors.taken"));
    const before = labels;
    const tempId = `l-${labels.length}-${clean}`;
    if (editing === "new") setLabels([...labels, { id: tempId, name: clean, color }]);
    else setLabels(labels.map((l) => (l.id === editing ? { ...l, name: clean, color } : l)));
    const id = editing === "new" ? null : editing;
    setEditing(null);
    if (saveTo) {
      void saveTo.save(id, clean, color).then((r) => {
        if (r.id && !id) setLabels((list) => list.map((l) => (l.id === tempId ? { ...l, id: r.id! } : l)));
        if (r.error) {
          setLabels(before);
          setError(t(r.error === "name_taken" ? "errors.taken" : "errors.failed"));
        }
      });
    }
  }

  const form = (
    <form
      className="grid gap-3 px-5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="grid gap-1.5 text-sm font-medium">
        {t("name")}
        <input
          autoFocus
          value={name}
          maxLength={MAX}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "label-err" : undefined}
          className="min-h-11 rounded-[var(--radius-control)] border border-border bg-surface px-3 font-normal"
        />
      </label>
      {error && <p id="label-err" role="alert" className="text-sm text-fail">{error}</p>}
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">{t("color")}</span>
        <Swatches value={color} onChange={setColor} label={t("color")} />
      </div>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass("primary", "sm")}>{editing === "new" ? t("create") : t("save")}</button>
        <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setEditing(null)}>{t("cancel")}</button>
      </div>
    </form>
  );

  return (
    <div className="grid gap-4">
      {canEdit && editing !== "new" && (
        <div>
          <button type="button" className={buttonClass("primary", "sm")} onClick={() => open("new")}>
            <Plus size={16} aria-hidden="true" /> {t("new")}
          </button>
        </div>
      )}
      {!canEdit && <p className="text-sm text-muted">{t("readOnly")}</p>}

      <ul className="overflow-hidden rounded-[var(--radius-panel)] bg-surface shadow-[var(--shadow-1)] ring-1 ring-border">
        {editing === "new" && <li className="border-b border-border">{form}</li>}
        {labels.length === 0 && editing !== "new" && <li className="px-5 py-8 text-center text-sm text-muted">{t("empty")}</li>}
        {labels.map((l) =>
          editing === l.id ? (
            <li key={l.id} className="border-b border-border last:border-0">{form}</li>
          ) : (
            <li key={l.id} className="grid gap-3 border-b border-border px-5 py-3 last:border-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="size-3 shrink-0 rounded-full" style={{ background: l.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{l.name}</span>
                  <span className="ms-2 text-sm text-muted">{t("chats", { count: usage[l.id] ?? 0 })}</span>
                </span>
                {canEdit && (
                  <span className="flex gap-1">
                    <button type="button" onClick={() => open(l)} className="grid size-9 place-items-center rounded text-muted hover:bg-surface-2 hover:text-text" aria-label={t("edit", { name: l.name })}>
                      <PencilSimple size={18} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setDeleting(l.id)} className="grid size-9 place-items-center rounded text-muted hover:bg-surface-2 hover:text-fail" aria-label={t("delete", { name: l.name })}>
                      <Trash size={18} aria-hidden="true" />
                    </button>
                  </span>
                )}
              </div>
              {deleting === l.id && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] bg-fail-soft px-3 py-2 text-sm">
                  <span>{t("confirmDelete", { name: l.name, count: usage[l.id] ?? 0 })}</span>
                  <span className="flex gap-2">
                    <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setDeleting(null)}>{t("cancel")}</button>
                    <button
                      type="button"
                      className={buttonClass("destructive", "sm")}
                      onClick={() => {
                        const before = labels;
                        setLabels(labels.filter((x) => x.id !== l.id));
                        setDeleting(null);
                        if (saveTo) void saveTo.remove(l.id).then((e) => { if (e) { setLabels(before); setError(t("errors.failed")); } });
                      }}
                    >
                      {t("deleteConfirm")}
                    </button>
                  </span>
                </div>
              )}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
