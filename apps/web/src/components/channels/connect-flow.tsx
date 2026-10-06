"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCircle, Copy, Info } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import { ChannelMark } from "./channel-mark";
import { channel, type ChannelKey } from "./catalog";
import { WidgetEditor, type WidgetSettings } from "./widget-editor";

/**
 * Connecting a channel (decided 2026-10-07): full step-by-step flows for WhatsApp, website chat, email,
 * Instagram and Messenger; one shared "connect your account" flow for the other channels. In the preview
 * every outside sign-in is simulated and nothing connects.
 */
type Step = "number" | "meta" | "details" | "site" | "widget" | "install" | "method" | "setup" | "account" | "keys" | "done";

const STEPS: Partial<Record<ChannelKey, Step[]>> = {
  whatsapp: ["number", "meta", "details", "done"],
  webchat: ["site", "widget", "install", "done"],
  email: ["method", "setup", "details", "done"],
  instagram: ["meta", "details", "done"],
  messenger: ["meta", "details", "done"],
  api: ["details", "keys", "done"],
};
const GENERIC: Step[] = ["account", "details", "done"];

type EmailMethod = "google" | "microsoft" | "forward" | "relay";

export const DEFAULT_WIDGET: WidgetSettings = {
  color: "#0A5670",
  greeting: "",
  launcher: "",
  position: "right",
  replyTime: "minutes",
  prechat: false,
  hours: "workspace",
  away: "",
  helpCenter: true,
  uploads: true,
  csat: true,
  domains: "northwindhome.com",
  identity: false,
};

interface Props {
  base: string;
  ch: ChannelKey;
  business: string;
  teams: { id: string; name: string }[];
  canManage: boolean;
}

function Choice({ on, onClick, title, body }: { on: boolean; onClick: () => void; title: string; body: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`grid gap-1 rounded-[var(--radius-panel)] border p-4 text-start transition-colors ${on ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2"}`}
    >
      <span className="font-medium">{title}</span>
      <span className="text-sm text-muted">{body}</span>
    </button>
  );
}

function Done({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 rounded-[var(--radius-control)] bg-done-soft px-3 py-2 text-sm" role="status">
      <CheckCircle size={18} weight="fill" className="shrink-0 text-done" aria-hidden="true" /> {text}
    </p>
  );
}

export function ConnectFlow({ base, ch, business, teams, canManage }: Props) {
  const t = useT("connect");
  const tAll = useT();
  const steps = STEPS[ch] ?? GENERIC;
  const name = tAll(`channels.${ch}`);
  const review = channel(ch).review;

  const [i, setI] = useState(0);
  const [waMode, setWaMode] = useState<"new" | "existing">("new");
  const [signedIn, setSignedIn] = useState(false);
  const [method, setMethod] = useState<EmailMethod>("google");
  const [verified, setVerified] = useState(false);
  const [local, setLocal] = useState("support");
  const [site, setSite] = useState({ name: business, domain: "northwindhome.com" });
  const [inboxName, setInboxName] = useState(name);
  const [team, setTeam] = useState(teams[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const step = steps[i];
  const field = "min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm";
  const metaLike = ch === "instagram" || ch === "messenger" || ch === "whatsapp";

  if (!canManage) {
    return <p className="rounded-[var(--radius-panel)] border border-border bg-surface p-5 text-muted">{t("readOnly")}</p>;
  }

  const ready =
    step === "meta" || step === "account" ? signedIn
    : step === "setup" ? (method === "forward" ? verified : method === "relay" ? /^[a-z0-9][a-z0-9._-]{0,40}$/.test(local) : signedIn)
    : step === "details" ? inboxName.trim().length > 0 && inboxName.trim().length <= 60
    : step === "site" ? site.name.trim().length > 0 && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(site.domain.trim())
    : true;

  const snippet = `<script src="https://widget.relay.app/v1.js" data-inbox="nw_8f2k3" async></script>`;
  const forwardAddress = "support-7f3k@inbound.relay.app";

  let body: React.ReactNode = null;
  switch (step) {
    case "number":
      body = (
        <div role="radiogroup" aria-label={t("whatsapp.choose")} className="grid gap-3">
          <Choice on={waMode === "new"} onClick={() => setWaMode("new")} title={t("whatsapp.newTitle")} body={t("whatsapp.newBody")} />
          <Choice on={waMode === "existing"} onClick={() => setWaMode("existing")} title={t("whatsapp.existingTitle")} body={t("whatsapp.existingBody")} />
        </div>
      );
      break;
    case "meta":
      body = (
        <div className="grid gap-4">
          <p className="text-muted">{ch === "whatsapp" ? t("meta.bodyWhatsapp") : ch === "instagram" ? t("meta.bodyInstagram") : t("meta.bodyMessenger")}</p>
          <ul className="grid gap-1.5 text-sm">
            {(["read", "send", "profile"] as const).map((k) => (
              <li key={k} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{t(`meta.permissions.${k}`)}</li>
            ))}
          </ul>
          {signedIn ? (
            <Done text={ch === "whatsapp" ? t("meta.pickedWhatsapp") : ch === "instagram" ? t("meta.pickedInstagram") : t("meta.pickedMessenger")} />
          ) : (
            <button type="button" onClick={() => setSignedIn(true)} className={buttonClass("primary", "md", "w-fit")}>{t("meta.signIn")}</button>
          )}
        </div>
      );
      break;
    case "account":
      body = (
        <div className="grid gap-4">
          <p className="text-muted">{t("generic.body", { channel: name })}</p>
          {signedIn ? (
            <Done text={t("generic.connectedAs", { handle: "Northwind Home" })} />
          ) : (
            <button type="button" onClick={() => setSignedIn(true)} className={buttonClass("primary", "md", "w-fit")}>{t("generic.button", { channel: name })}</button>
          )}
        </div>
      );
      break;
    case "method":
      body = (
        <div role="radiogroup" aria-label={t("email.method")} className="grid gap-3 sm:grid-cols-2">
          {(["google", "microsoft", "forward", "relay"] as const).map((m) => (
            <Choice key={m} on={method === m} onClick={() => { setMethod(m); setSignedIn(false); setVerified(false); }} title={t(`email.methods.${m}.title`)} body={t(`email.methods.${m}.body`)} />
          ))}
        </div>
      );
      break;
    case "setup":
      if (method === "google" || method === "microsoft") {
        body = signedIn ? (
          <Done text={t("email.signedIn", { address: "support@northwindhome.com" })} />
        ) : (
          <div className="grid gap-3">
            <p className="text-muted">{t("email.oauthBody")}</p>
            <button type="button" onClick={() => setSignedIn(true)} className={buttonClass("primary", "md", "w-fit")}>
              {t("email.signInWith", { provider: method === "google" ? "Google" : "Microsoft" })}
            </button>
          </div>
        );
      } else if (method === "forward") {
        body = (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <p className="text-sm font-medium">{t("email.forwardTo")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <code dir="ltr" className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm">{forwardAddress}</code>
                <button type="button" onClick={() => void navigator.clipboard?.writeText(forwardAddress)} className={buttonClass("ghost", "sm")}><Copy size={16} aria-hidden="true" /> {t("copy")}</button>
              </div>
              <p className="text-sm text-muted">{t("email.forwardHelp")}</p>
              {verified ? <Done text={t("email.forwardOk")} /> : <button type="button" onClick={() => setVerified(true)} className={buttonClass("secondary", "sm", "w-fit")}>{t("email.verify")}</button>}
            </div>
            <fieldset className="grid gap-3 border-t border-border pt-4">
              <legend className="pb-1 text-sm font-medium">{t("email.smtpTitle")}</legend>
              <p className="text-sm text-muted">{t("email.smtpHelp")}</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                <label className="grid gap-1 text-sm">{t("email.smtpHost")}<input className={field} dir="ltr" placeholder="smtp.northwindhome.com" autoComplete="off" /></label>
                <label className="grid gap-1 text-sm">{t("email.smtpPort")}<input className={field} dir="ltr" inputMode="numeric" defaultValue="587" autoComplete="off" /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">{t("email.smtpUser")}<input className={field} dir="ltr" autoComplete="off" /></label>
                <label className="grid gap-1 text-sm">{t("email.smtpPassword")}<input className={field} dir="ltr" type="password" autoComplete="new-password" /></label>
              </div>
            </fieldset>
          </div>
        );
      } else {
        body = (
          <label className="grid gap-2">
            <span className="text-sm font-medium">{t("email.relayAddress")}</span>
            <span className="flex items-center gap-1" dir="ltr">
              <input value={local} onChange={(e) => setLocal(e.target.value.toLowerCase())} className={`${field} max-w-48`} autoComplete="off" />
              <span className="text-sm text-muted">@northwindhome.relay.email</span>
            </span>
            <span className="text-sm text-muted">{t("email.relayHelp")}</span>
          </label>
        );
      }
      break;
    case "site":
      body = (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">{t("webchat.siteName")}<input value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} className={field} /></label>
          <label className="grid gap-1.5 text-sm font-medium">{t("webchat.domain")}<input value={site.domain} onChange={(e) => setSite({ ...site, domain: e.target.value })} className={field} dir="ltr" placeholder="example.com" /></label>
          <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
            {t("team")}
            <select value={team} onChange={(e) => setTeam(e.target.value)} className={field}>{teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </label>
        </div>
      );
      break;
    case "widget":
      body = <WidgetEditor business={site.name || business} initial={{ ...DEFAULT_WIDGET, greeting: t("webchat.greetingDefault"), launcher: t("webchat.launcherDefault"), away: t("webchat.awayDefault"), domains: site.domain }} />;
      break;
    case "install":
      body = (
        <div className="grid gap-4">
          <p className="text-muted">{t("webchat.installBody")}</p>
          <pre dir="ltr" className="overflow-x-auto rounded-[var(--radius-panel)] bg-[#111518] p-4 text-sm text-[#E6EDF0]"><code>{snippet}</code></pre>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(snippet); setCopied(true); }} className={buttonClass("secondary", "sm")}>
              {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} {copied ? t("copied") : t("copy")}
            </button>
            <button type="button" onClick={() => setChecked(true)} className={buttonClass("ghost", "sm")}>{t("webchat.check")}</button>
          </div>
          {checked && <p role="status" className="flex gap-2 text-sm text-muted"><Info size={18} className="shrink-0" aria-hidden="true" />{t("webchat.notFound", { domain: site.domain })}</p>}
          <p className="text-sm text-muted">{t("webchat.platforms")}</p>
        </div>
      );
      break;
    case "details":
      body = (
        <div className="grid gap-4">
          {ch === "whatsapp" && (
            <label className="grid gap-1.5 text-sm font-medium">
              {t("whatsapp.displayName")}
              <input defaultValue={business} className={field} />
              <span className="font-normal text-muted">{t("whatsapp.displayNameHelp")}</span>
            </label>
          )}
          <label className="grid gap-1.5 text-sm font-medium">
            {t("name")}
            <input value={inboxName} onChange={(e) => setInboxName(e.target.value)} maxLength={60} className={field} />
            <span className="font-normal text-muted">{t("nameHelp")}</span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("team")}
            <select value={team} onChange={(e) => setTeam(e.target.value)} className={field}>{teams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </label>
        </div>
      );
      break;
    case "keys":
      body = (
        <dl className="grid gap-3 text-sm">
          <div className="grid gap-1"><dt className="font-medium">{t("api.endpoint")}</dt><dd><code dir="ltr" className="break-all rounded bg-surface-2 px-2 py-1">https://api.relay.app/v1/inboxes/nw_api_42/messages</code></dd></div>
          <div className="grid gap-1">
            <dt className="font-medium">{t("api.key")}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <code dir="ltr" className="rounded bg-surface-2 px-2 py-1">{showKey ? "rl_preview_4f9c2e8a17b3" : "rl_preview_••••••••••••"}</code>
              <button type="button" onClick={() => setShowKey((s) => !s)} className={buttonClass("ghost", "sm")}>{showKey ? t("api.hide") : t("api.show")}</button>
            </dd>
            <span className="text-muted">{t("api.keyHelp")}</span>
          </div>
          <label className="grid gap-1 font-medium">{t("api.webhook")}<input className={field} dir="ltr" placeholder="https://your-app.example.com/relay-events" /></label>
        </dl>
      );
      break;
    case "done":
      body = (
        <div className="grid justify-items-start gap-4">
          <p className="flex items-center gap-2 text-lg font-semibold"><CheckCircle size={26} weight="fill" className="text-done" aria-hidden="true" /> {t("doneTitle", { channel: name })}</p>
          <p className="text-muted">{review ? t(`review.${review}`) : t("doneBody", { name: inboxName || site.name })}</p>
          <div className="flex flex-wrap gap-2">
            <Link href={`${base}/inbox`} className={buttonClass("primary", "md")}>{t("openInbox")}</Link>
            <Link href={`${base}/channels`} className={buttonClass("secondary", "md")}>{t("back")}</Link>
          </div>
        </div>
      );
      break;
  }

  return (
    <div className="grid gap-6">
      <Link href={`${base}/channels`} className="inline-flex min-h-9 w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <header className="flex items-center gap-3">
        <ChannelMark ch={ch} size={40} label={name} />
        <div className="grid">
          <h1 className="title text-2xl">{t("title", { channel: name })}</h1>
          <p className="text-sm text-muted">{t("stepOf", { n: i + 1, total: steps.length })} · {t(`steps.${step}`)}</p>
        </div>
      </header>

      <ol className="flex gap-1.5" aria-hidden="true">
        {steps.map((s, k) => <li key={s} className={`h-1 flex-1 rounded-full ${k <= i ? "bg-primary" : "bg-border"}`} />)}
      </ol>

      {metaLike && step !== "done" && i === 0 && review && <p className="flex gap-2 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-sm text-muted"><Info size={18} className="shrink-0" aria-hidden="true" />{t(`reviewBefore.${review}`)}</p>}

      <section className="rounded-[var(--radius-panel)] border border-border bg-surface p-5 sm:p-6">{body}</section>

      {step !== "done" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-muted"><Info size={16} aria-hidden="true" />{t("previewNote")}</p>
          <div className="flex gap-2">
            {i > 0 && <button type="button" onClick={() => setI(i - 1)} className={buttonClass("ghost", "md")}>{t("backStep")}</button>}
            <button type="button" disabled={!ready} onClick={() => setI(i + 1)} className={buttonClass("primary", "md")}>
              {steps[i + 1] === "done" ? t("finish") : t("next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
