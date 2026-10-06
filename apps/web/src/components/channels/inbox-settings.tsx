"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Info, WarningCircle } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import type { ChannelInbox } from "@/components/inbox/types";
import { useT } from "@/i18n/client";
import { ChannelMark } from "./channel-mark";
import { DEFAULT_WIDGET } from "./connect-flow";
import { WidgetEditor } from "./widget-editor";

/**
 * One connected inbox's settings. Disconnecting stops new messages; deleting removes the inbox from the
 * sidebar. Either way past conversations stay, read-only, on each contact (decided 2026-10-07), and deleting
 * asks for the inbox's name to be typed first.
 */
export function InboxSettings({ base, inbox, teams, teamId, business, canManage }: { base: string; inbox: ChannelInbox; teams: { id: string; name: string }[]; teamId: string; business: string; canManage: boolean }) {
  const t = useT("inboxSettings");
  const c = useT("connect");
  const o = useT("omni");
  const tAll = useT();
  const [name, setName] = useState(inbox.name);
  const [team, setTeam] = useState(teamId);
  const [auto, setAuto] = useState(true);
  const [csat, setCsat] = useState(inbox.channel !== "voice");
  const [hours, setHours] = useState<"workspace" | "always">("workspace");
  const [state, setState] = useState<"connected" | "disconnected" | "deleted">(inbox.broken ? "disconnected" : "connected");
  const [confirming, setConfirming] = useState<"disconnect" | "delete" | null>(null);
  const [typed, setTyped] = useState("");
  const [saved, setSaved] = useState(false);
  const field = "min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm disabled:opacity-60";

  if (state === "deleted") {
    return (
      <div className="grid gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-6">
        <p className="font-semibold">{t("deletedTitle", { name })}</p>
        <p className="text-muted">{t("deletedBody")}</p>
        <Link href={`${base}/channels`} className={buttonClass("secondary", "md", "w-fit")}>{t("back")}</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Link href={`${base}/channels`} className="inline-flex min-h-9 w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <header className="flex items-center gap-3">
        <ChannelMark ch={inbox.channel} size={40} label={tAll(`channels.${inbox.channel}`)} />
        <div className="grid">
          <h1 className="title text-2xl"><bdi>{name}</bdi></h1>
          <p className="text-sm text-muted" dir="ltr">{inbox.address}</p>
        </div>
      </header>

      {state === "disconnected" && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-fail/30 bg-fail-soft p-4 text-sm">
          <p className="grid gap-0.5">
            <strong className="flex items-center gap-1.5 font-semibold"><WarningCircle size={16} weight="fill" className="text-fail" aria-hidden="true" />{inbox.broken ? o(`broken.${inbox.broken}`, { inbox: name }) : t("disconnectedTitle", { name })}</strong>
            <span>{t("disconnectedBody")}</span>
          </p>
          {canManage && <button type="button" onClick={() => setState("connected")} className={buttonClass("secondary", "sm")}>{o("broken.reconnect")}</button>}
        </div>
      )}

      {!canManage && <p className="rounded-[var(--radius-control)] bg-surface-2 px-4 py-3 text-sm text-muted">{c("readOnly")}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(true);
        }}
        className="grid gap-6"
      >
        <fieldset disabled={!canManage} className="grid gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-5 sm:p-6">
          <legend className="sr-only">{t("general")}</legend>
          <h2 className="text-base font-semibold">{t("general")}</h2>
          <label className="grid gap-1.5 text-sm font-medium">
            {c("name")}
            <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} maxLength={60} required className={field} />
            <span className="font-normal text-muted">{c("nameHelp")}</span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {c("team")}
            <select value={team} onChange={(e) => { setTeam(e.target.value); setSaved(false); }} className={field}>{teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </label>
          <label className="flex items-start justify-between gap-4 py-1">
            <span className="grid"><span className="text-sm font-medium">{t("autoAssign")}</span><span className="text-xs text-muted">{t("autoAssignHelp")}</span></span>
            <input type="checkbox" role="switch" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="mt-0.5 size-5 accent-[var(--primary)]" />
          </label>
          {inbox.channel !== "voice" && (
            <label className="flex items-start justify-between gap-4 py-1">
              <span className="text-sm font-medium">{t("csat")}</span>
              <input type="checkbox" role="switch" checked={csat} onChange={(e) => setCsat(e.target.checked)} className="mt-0.5 size-5 accent-[var(--primary)]" />
            </label>
          )}
          <label className="grid gap-1.5 text-sm font-medium">
            {t("hours")}
            <select value={hours} onChange={(e) => setHours(e.target.value as "workspace" | "always")} className={field}>
              <option value="workspace">{t("hoursWorkspace")}</option>
              <option value="always">{t("hoursAlways")}</option>
            </select>
          </label>
        </fieldset>

        {inbox.channel === "webchat" && (
          <section className="grid gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-5 sm:p-6">
            <h2 className="text-base font-semibold">{t("widget")}</h2>
            <WidgetEditor business={business} disabled={!canManage} initial={{ ...DEFAULT_WIDGET, greeting: c("webchat.greetingDefault"), launcher: c("webchat.launcherDefault"), away: c("webchat.awayDefault") }} />
          </section>
        )}

        {canManage && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {saved && <p role="status" className="flex items-center gap-1.5 text-sm text-muted"><Info size={16} aria-hidden="true" />{t("saved")}</p>}
            <button type="submit" disabled={!name.trim()} className={buttonClass("primary", "md")}>{t("save")}</button>
          </div>
        )}
      </form>

      {canManage && (
        <section className="grid gap-4 rounded-[var(--radius-panel)] border border-fail/30 bg-surface p-5 sm:p-6" aria-labelledby="danger">
          <h2 id="danger" className="text-base font-semibold">{t("danger")}</h2>
          {state === "connected" && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="grid text-sm"><span className="font-medium">{t("disconnect")}</span><span className="text-muted">{t("disconnectBody")}</span></p>
              {confirming === "disconnect" ? (
                <span className="flex gap-2">
                  <button type="button" onClick={() => setConfirming(null)} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</button>
                  <button type="button" onClick={() => { setState("disconnected"); setConfirming(null); }} className={buttonClass("destructive", "sm")}>{t("disconnectConfirm")}</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirming("disconnect")} className={buttonClass("secondary", "sm")}>{t("disconnect")}</button>
              )}
            </div>
          )}
          <div className="grid gap-3 border-t border-border pt-4">
            <p className="grid text-sm"><span className="font-medium">{t("delete")}</span><span className="text-muted">{t("deleteBody", { name })}</span></p>
            {confirming === "delete" ? (
              <div className="grid gap-2 sm:max-w-md">
                <label className="grid gap-1 text-sm">
                  {t("deleteType", { name })}
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} className={field} autoComplete="off" />
                </label>
                <span className="flex gap-2">
                  <button type="button" onClick={() => { setConfirming(null); setTyped(""); }} className={buttonClass("ghost", "sm")}>{tAll("common.cancel")}</button>
                  <button type="button" disabled={typed.trim() !== name.trim()} onClick={() => setState("deleted")} className={buttonClass("destructive", "sm")}>{t("deleteConfirm")}</button>
                </span>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming("delete")} className={buttonClass("ghost", "sm", "w-fit text-fail")}>{t("delete")}</button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
