"use client";

import { useState } from "react";
import { ChatsCircle, MagnifyingGlass, Paperclip, X } from "@phosphor-icons/react";
import { useT } from "@/i18n/client";

/**
 * The website chat widget's settings with a live preview beside them (decided 2026-10-07: colour, greeting,
 * position, pre-chat form, business hours and away message, Help Center search, plus what a real widget needs:
 * launcher text, reply time, uploads, ratings, allowed sites and signed-in visitor checks).
 */
export interface WidgetSettings {
  color: string;
  greeting: string;
  launcher: string;
  position: "left" | "right";
  replyTime: "minutes" | "hour" | "day";
  prechat: boolean;
  hours: "workspace" | "always";
  away: string;
  helpCenter: boolean;
  uploads: boolean;
  csat: boolean;
  domains: string;
  identity: boolean;
}

export const SWATCHES = ["#0A5670", "#111518", "#1D4ED8", "#B42318", "#047857", "#7A2E8E"];

/** White or near-black text, whichever reads better on the brand colour (WCAG relative luminance). */
export function textOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l > 0.36 ? "#111518" : "#FFFFFF";
}

function Toggle({ label, help, checked, onChange, disabled }: { label: string; help?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2.5">
      <span className="grid">
        <span className="text-sm font-medium">{label}</span>
        {help && <span className="text-xs text-muted">{help}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
    </label>
  );
}

export function WidgetEditor({ business, initial, disabled = false }: { business: string; initial: WidgetSettings; disabled?: boolean }) {
  const t = useT("channelsPage");
  const [w, setW] = useState(initial);
  const [open, setOpen] = useState(true);
  const set = <K extends keyof WidgetSettings>(k: K, v: WidgetSettings[K]) => setW((x) => ({ ...x, [k]: v }));
  const fg = textOn(w.color);
  const field = "min-h-10 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm disabled:opacity-60";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <fieldset disabled={disabled} className="grid content-start gap-5">
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">{t("widget.appearance")}</h3>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium" id="wc-colour">{t("widget.colour")}</span>
            <div role="radiogroup" aria-labelledby="wc-colour" className="flex flex-wrap items-center gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={w.color === c}
                  aria-label={c}
                  onClick={() => set("color", c)}
                  className={`size-8 rounded-full border border-border ring-offset-2 ring-offset-surface ${w.color === c ? "ring-2 ring-text" : ""}`}
                  style={{ background: c }}
                />
              ))}
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="color" value={w.color} onChange={(e) => set("color", e.target.value.toUpperCase())} className="size-8 cursor-pointer rounded-full border border-border bg-transparent" />
                {t("widget.custom")}
              </label>
            </div>
          </div>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("widget.greeting")}</span>
            <input value={w.greeting} onChange={(e) => set("greeting", e.target.value)} maxLength={120} className={field} dir="auto" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">{t("widget.launcher")}</span>
              <input value={w.launcher} onChange={(e) => set("launcher", e.target.value)} maxLength={30} className={field} dir="auto" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">{t("widget.position")}</span>
              <select value={w.position} onChange={(e) => set("position", e.target.value as WidgetSettings["position"])} className={field}>
                <option value="right">{t("widget.right")}</option>
                <option value="left">{t("widget.left")}</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("widget.replyTime")}</span>
            <select value={w.replyTime} onChange={(e) => set("replyTime", e.target.value as WidgetSettings["replyTime"])} className={field}>
              {(["minutes", "hour", "day"] as const).map((r) => <option key={r} value={r}>{t(`widget.replyTimes.${r}`)}</option>)}
            </select>
          </label>
        </section>

        <section className="grid gap-1 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">{t("widget.behaviour")}</h3>
          <Toggle label={t("widget.prechat")} help={t("widget.prechatHelp")} checked={w.prechat} onChange={(v) => set("prechat", v)} />
          <Toggle label={t("widget.helpCenter")} help={t("widget.helpCenterHelp")} checked={w.helpCenter} onChange={(v) => set("helpCenter", v)} />
          <Toggle label={t("widget.uploads")} checked={w.uploads} onChange={(v) => set("uploads", v)} />
          <Toggle label={t("widget.csat")} checked={w.csat} onChange={(v) => set("csat", v)} />
        </section>

        <section className="grid gap-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">{t("widget.hours")}</h3>
          <select value={w.hours} onChange={(e) => set("hours", e.target.value as WidgetSettings["hours"])} className={field} aria-label={t("widget.hours")}>
            <option value="workspace">{t("widget.hoursWorkspace")}</option>
            <option value="always">{t("widget.hoursAlways")}</option>
          </select>
          {w.hours === "workspace" && (
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">{t("widget.away")}</span>
              <textarea value={w.away} onChange={(e) => set("away", e.target.value)} rows={2} maxLength={240} className={`${field} py-2`} dir="auto" />
            </label>
          )}
        </section>

        <section className="grid gap-3 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">{t("widget.security")}</h3>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">{t("widget.domains")}</span>
            <input value={w.domains} onChange={(e) => set("domains", e.target.value)} className={field} dir="ltr" placeholder="northwindhome.com, shop.northwindhome.com" />
            <span className="text-xs text-muted">{t("widget.domainsHelp")}</span>
          </label>
          <Toggle label={t("widget.identity")} help={t("widget.identityHelp")} checked={w.identity} onChange={(v) => set("identity", v)} />
        </section>
      </fieldset>

      {/* Live preview: a page on the business's site with the widget open. */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-xs font-medium text-muted">{t("widget.previewTitle")}</p>
        <div className="relative h-[34rem] overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-2">
          <div className="grid gap-2 p-4" aria-hidden="true">
            <span className="h-3 w-24 rounded-full bg-border" />
            <span className="h-2 w-40 rounded-full bg-border/70" />
            <span className="mt-3 h-24 rounded-[var(--radius-control)] bg-border/50" />
          </div>
          <div className={`absolute bottom-4 grid justify-items-end gap-3 ${w.position === "right" ? "end-4" : "start-4 justify-items-start"}`}>
            {open && (
              <div className="grid w-72 overflow-hidden rounded-[16px] border border-border bg-surface shadow-[var(--shadow-float)]" dir="auto">
                <div className="grid gap-1 px-4 py-3" style={{ background: w.color, color: fg }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{business}</span>
                    <button type="button" onClick={() => setOpen(false)} aria-label={t("widget.close")} className="grid size-7 place-items-center rounded-full hover:bg-black/10"><X size={16} aria-hidden="true" /></button>
                  </div>
                  <span className="text-xs opacity-85">{t(`widget.replyTimes.${w.replyTime}`)}</span>
                </div>
                <div className="grid gap-2.5 p-3 text-sm">
                  {w.helpCenter && (
                    <span className="flex min-h-9 items-center gap-2 rounded-[var(--radius-control)] border border-input px-3 text-xs text-muted">
                      <MagnifyingGlass size={14} aria-hidden="true" /> {t("widget.searchHelp")}
                    </span>
                  )}
                  <p className="max-w-[85%] justify-self-start rounded-[12px] rounded-es-sm bg-surface-2 px-3 py-2">{w.greeting || "…"}</p>
                  {w.prechat ? (
                    <div className="grid gap-2 rounded-[12px] border border-border p-3">
                      <span className="text-xs text-muted">{t("widget.prechatIntro")}</span>
                      <span className="flex min-h-8 items-center rounded-[8px] border border-input px-2.5 text-xs text-muted">{t("widget.yourName")}</span>
                      <span className="flex min-h-8 items-center rounded-[8px] border border-input px-2.5 text-xs text-muted">{t("widget.yourEmail")}</span>
                      <span className="flex min-h-8 items-center justify-center rounded-[8px] text-xs font-medium" style={{ background: w.color, color: fg }}>{t("widget.startChat")}</span>
                    </div>
                  ) : (
                    <p className="max-w-[85%] justify-self-end rounded-[12px] rounded-ee-sm px-3 py-2" style={{ background: w.color, color: fg }}>{t("widget.visitorSample")}</p>
                  )}
                </div>
                {!w.prechat && (
                  <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted">
                    {w.uploads && <Paperclip size={16} aria-hidden="true" />}
                    <span className="flex-1">{t("widget.typeHere")}</span>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex min-h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-[var(--shadow-2)]"
              style={{ background: w.color, color: fg }}
            >
              <ChatsCircle size={22} weight="fill" aria-hidden="true" />
              {w.launcher}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
