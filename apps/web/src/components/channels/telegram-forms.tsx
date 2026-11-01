"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui/surface";
import { Submit } from "@/components/ui/submit";
import { useT } from "@/i18n/client";
import type { TelegramState } from "@/app/w/[slug]/channels/telegram-actions";

const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal";

function Problem({ state }: { state: TelegramState }) {
  const t = useT("telegramSetup");
  if (!state) return null;
  const message =
    state.error === "needToken" ? t("errors.needToken")
    : state.error === "badToken" ? t("errors.badToken")
    : state.error === "unreachable" ? t("errors.unreachable")
    : state.error === "needHttps" ? t("errors.needHttps")
    : state.error === "already" ? t("errors.already")
    : state.error === "otherAccount" ? t("errors.otherAccount")
    : state.error === "otherBot" ? t("errors.otherBot")
    : state.error === "webhook" ? t("errors.webhook")
    : state.error === "notAllowed" ? t("errors.notAllowed")
    : state.error === "needName" ? t("errors.needName")
    : t("errors.failed");
  return <Notice tone="error" title={message}>{state.detail ? t("telegramSaid", { detail: state.detail }) : null}</Notice>;
}

/** Connecting a bot: four small steps, then one field. */
export function TelegramConnectForm({ action, slug }: { action: (prev: TelegramState, data: FormData) => Promise<TelegramState>; slug: string }) {
  const t = useT("telegramSetup");
  const [state, run, pending] = useActionState(action, null);
  return (
    <div className="grid gap-5 sm:max-w-lg">
      <ol className="grid list-decimal gap-2 ps-5 text-sm">
        <li>{t("step1")}</li>
        <li>{t("step2")}</li>
        <li>{t("step3")}</li>
        <li>{t("step4")}</li>
      </ol>
      <form action={run} className="grid gap-4">
        <input type="hidden" name="slug" value={slug} />
        <Problem state={state} />
        <label className="grid gap-1.5 text-sm font-medium">
          {t("token")}
          <input name="token" required autoComplete="off" spellCheck={false} dir="ltr" maxLength={200} placeholder="123456789:AA…" className={`${field} font-mono`} />
          <span className="text-xs font-normal text-muted">{t("tokenHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("greeting")}
          <textarea name="greeting" rows={3} maxLength={1000} placeholder={t("greetingPlaceholder")} className={`${field} py-2`} />
          <span className="text-xs font-normal text-muted">{t("greetingHelp")}</span>
        </label>
        <div><Submit pending={t("connecting")}>{t("connect")}</Submit></div>
        <span className="sr-only" aria-live="polite">{pending ? t("connecting") : ""}</span>
      </form>
    </div>
  );
}

/** A new token for the same bot, or bringing a disconnected bot back. */
export function TelegramReplaceToken({ action, slug, id, reconnect }: { action: (prev: TelegramState, data: FormData) => Promise<TelegramState>; slug: string; id: string; reconnect: boolean }) {
  const t = useT("telegramSetup");
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className="grid gap-3 sm:max-w-lg">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={id} />
      <Problem state={state} />
      <p className="text-sm text-muted">{reconnect ? t("reconnectHelp") : t("replaceHelp")}</p>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("token")}
        <input name="token" required autoComplete="off" spellCheck={false} dir="ltr" maxLength={200} placeholder="123456789:AA…" className={`${field} font-mono`} />
      </label>
      <div><Submit variant="secondary" pending={t("connecting")}>{reconnect ? t("reconnect") : t("replace")}</Submit></div>
    </form>
  );
}
