"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui/surface";
import { Submit } from "@/components/ui/submit";
import { useT } from "@/i18n/client";
import type { VoiceState } from "@/app/w/[slug]/channels/voice-actions";

const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal";

type Action = (prev: VoiceState, data: FormData) => Promise<VoiceState>;

function Problem({ state }: { state: VoiceState }) {
  const t = useT("voiceSetup");
  if (!state) return null;
  return <Notice tone="error" title={t(`errors.${state.error}`)}>{state.detail ? t("twilioSaid", { detail: state.detail }) : null}</Notice>;
}

/** Connecting a phone line: where to find two values, then the number and the phone to ring. */
export function VoiceConnectForm({ action, slug }: { action: Action; slug: string }) {
  const t = useT("voiceSetup");
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
        <label className="grid gap-1.5 text-sm font-medium">
          {t("forward")}
          <input name="forward" autoComplete="off" inputMode="tel" dir="ltr" maxLength={30} placeholder="+971 50 123 4567" className={field} />
          <span className="text-xs font-normal text-muted">{t("forwardHelp")}</span>
        </label>
        <div><Submit pending={t("connecting")}>{t("connect")}</Submit></div>
      </form>
    </div>
  );
}

/** What happens to a call: which phone rings, for how long, and what a caller hears before leaving a message. */
export function VoiceSettingsForm({
  action, slug, id, name, forward, ring, greeting, notice, canManage,
}: { action: Action; slug: string; id: string; name: string; forward: string; ring: number; greeting: string; notice: string; canManage: boolean }) {
  const t = useT("voiceSetup");
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className="grid gap-4 sm:max-w-lg">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={id} />
      <Problem state={state} />
      <fieldset disabled={!canManage} className="grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">
          {t("nameLabel")}
          <input name="name" defaultValue={name} required maxLength={80} className={field} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("forward")}
          <input name="forward" defaultValue={forward} autoComplete="off" inputMode="tel" dir="ltr" maxLength={30} placeholder="+971 50 123 4567" className={field} />
          <span className="text-xs font-normal text-muted">{t("forwardHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("ring")}
          <input name="ring" type="number" min={5} max={60} defaultValue={ring} required className={`${field} w-28`} />
          <span className="text-xs font-normal text-muted">{t("ringHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("greeting")}
          <textarea name="greeting" defaultValue={greeting} rows={3} maxLength={300} dir="auto" className={`${field} py-2`} />
          <span className="text-xs font-normal text-muted">{t("greetingHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("notice")}
          <textarea name="notice" defaultValue={notice} rows={2} maxLength={300} dir="auto" className={`${field} py-2`} />
          <span className="text-xs font-normal text-muted">{t("noticeHelp")}</span>
        </label>
      </fieldset>
      {canManage && <div><Submit pending={t("connecting")}>{t("save")}</Submit></div>}
    </form>
  );
}

/** New credentials for the same Twilio account, or bringing a disconnected line back. */
export function VoiceReplaceCredentials({ action, slug, id, reconnect }: { action: Action; slug: string; id: string; reconnect: boolean }) {
  const t = useT("voiceSetup");
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
