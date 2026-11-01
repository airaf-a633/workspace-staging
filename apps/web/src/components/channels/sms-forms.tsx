"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui/surface";
import { Submit } from "@/components/ui/submit";
import { useT } from "@/i18n/client";
import type { SmsState } from "@/app/w/[slug]/channels/sms-actions";

const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal";

function Problem({ state }: { state: SmsState }) {
  const t = useT("smsSetup");
  if (!state) return null;
  const message =
    state.error === "needSid" ? t("errors.needSid")
    : state.error === "needToken" ? t("errors.needToken")
    : state.error === "needNumber" ? t("errors.needNumber")
    : state.error === "badCredentials" ? t("errors.badCredentials")
    : state.error === "unreachable" ? t("errors.unreachable")
    : state.error === "already" ? t("errors.already")
    : state.error === "otherAccount" ? t("errors.otherAccount")
    : state.error === "otherTwilio" ? t("errors.otherTwilio")
    : state.error === "notAllowed" ? t("errors.notAllowed")
    : state.error === "needName" ? t("errors.needName")
    : t("errors.failed");
  return <Notice tone="error" title={message}>{state.detail ? t("twilioSaid", { detail: state.detail }) : null}</Notice>;
}

/** Connecting an SMS number: where to find two values, then three fields. */
export function SmsConnectForm({ action, slug }: { action: (prev: SmsState, data: FormData) => Promise<SmsState>; slug: string }) {
  const t = useT("smsSetup");
  const [state, run] = useActionState(action, null);
  return (
    <div className="grid gap-5 sm:max-w-lg">
      <ol className="grid list-decimal gap-2 ps-5 text-sm">
        <li>{t("step1")}</li>
        <li>{t("step2")}</li>
        <li>{t("step3")}</li>
      </ol>
      <form action={run} className="grid gap-4">
        <input type="hidden" name="slug" value={slug} />
        <Problem state={state} />
        <label className="grid gap-1.5 text-sm font-medium">
          {t("sid")}
          <input name="sid" required autoComplete="off" spellCheck={false} dir="ltr" maxLength={40} placeholder="AC…" className={`${field} font-mono`} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("token")}
          <input name="token" required autoComplete="off" spellCheck={false} dir="ltr" maxLength={200} className={`${field} font-mono`} />
          <span className="text-xs font-normal text-muted">{t("tokenHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("number")}
          <input name="number" required autoComplete="off" inputMode="tel" dir="ltr" maxLength={30} placeholder="+1 555 010 0100" className={field} />
          <span className="text-xs font-normal text-muted">{t("numberHelp")}</span>
        </label>
        <div><Submit pending={t("connecting")}>{t("connect")}</Submit></div>
      </form>
    </div>
  );
}

/** New credentials for the same Twilio account, or bringing a disconnected inbox back. */
export function SmsReplaceCredentials({ action, slug, id, reconnect }: { action: (prev: SmsState, data: FormData) => Promise<SmsState>; slug: string; id: string; reconnect: boolean }) {
  const t = useT("smsSetup");
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className="grid gap-3 sm:max-w-lg">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={id} />
      <Problem state={state} />
      <p className="text-sm text-muted">{reconnect ? t("reconnectHelp") : t("replaceHelp")}</p>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("sid")}
        <input name="sid" required autoComplete="off" spellCheck={false} dir="ltr" maxLength={40} placeholder="AC…" className={`${field} font-mono`} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("token")}
        <input name="token" required autoComplete="off" spellCheck={false} dir="ltr" maxLength={200} className={`${field} font-mono`} />
      </label>
      <div><Submit variant="secondary" pending={t("connecting")}>{reconnect ? t("reconnect") : t("replace")}</Submit></div>
    </form>
  );
}
