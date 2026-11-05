"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui/surface";
import { Submit } from "@/components/ui/submit";
import { useT } from "@/i18n/client";
import type { ViberState } from "@/app/w/[slug]/channels/viber-actions";

const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal";

type Action = (prev: ViberState, data: FormData) => Promise<ViberState>;

function Problem({ state }: { state: ViberState }) {
  const t = useT("viberSetup");
  if (!state) return null;
  return <Notice tone="error" title={t(`errors.${state.error}`)}>{state.detail ? t("viberSaid", { detail: state.detail }) : null}</Notice>;
}

/** Connecting a bot the business already has: where to find the token, then the fields. */
export function ViberConnectForm({ action, slug }: { action: Action; slug: string }) {
  const t = useT("viberSetup");
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
          {t("token")}
          <input name="token" required autoComplete="off" spellCheck={false} dir="ltr" maxLength={200} className={`${field} font-mono`} />
          <span className="text-xs font-normal text-muted">{t("tokenHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("senderName")}
          <input name="senderName" maxLength={28} className={field} />
          <span className="text-xs font-normal text-muted">{t("senderNameHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("welcome")}
          <textarea name="welcome" rows={3} maxLength={500} dir="auto" className={`${field} py-2`} />
          <span className="text-xs font-normal text-muted">{t("welcomeHelp")}</span>
        </label>
        <div><Submit pending={t("connecting")}>{t("connect")}</Submit></div>
      </form>
    </div>
  );
}

/** The inbox name, the name Viber shows on replies, and the welcome message. */
export function ViberSettingsForm({ action, slug, id, name, senderName, welcome, canManage }: { action: Action; slug: string; id: string; name: string; senderName: string; welcome: string; canManage: boolean }) {
  const t = useT("viberSetup");
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
          {t("senderName")}
          <input name="senderName" defaultValue={senderName} maxLength={28} className={field} />
          <span className="text-xs font-normal text-muted">{t("senderNameHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("welcome")}
          <textarea name="welcome" defaultValue={welcome} rows={3} maxLength={500} dir="auto" className={`${field} py-2`} />
          <span className="text-xs font-normal text-muted">{t("welcomeHelp")}</span>
        </label>
      </fieldset>
      {canManage && <div><Submit pending={t("connecting")}>{t("save")}</Submit></div>}
    </form>
  );
}

/** A new token for the same bot, or bringing a disconnected bot back. */
export function ViberReplaceToken({ action, slug, id, reconnect }: { action: Action; slug: string; id: string; reconnect: boolean }) {
  const t = useT("viberSetup");
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className="grid gap-3 sm:max-w-lg">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={id} />
      <Problem state={state} />
      <p className="text-sm text-muted">{reconnect ? t("reconnectHelp") : t("replaceHelp")}</p>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("token")}
        <input name="token" required autoComplete="off" spellCheck={false} dir="ltr" maxLength={200} className={`${field} font-mono`} />
      </label>
      <div><Submit variant="secondary" pending={t("connecting")}>{reconnect ? t("reconnect") : t("replace")}</Submit></div>
    </form>
  );
}
