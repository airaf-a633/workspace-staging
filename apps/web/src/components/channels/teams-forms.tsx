"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui/surface";
import { Submit } from "@/components/ui/submit";
import { useT } from "@/i18n/client";
import type { TeamsState } from "@/app/w/[slug]/channels/teams-actions";

const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal";

type Action = (prev: TeamsState, data: FormData) => Promise<TeamsState>;

function Problem({ state }: { state: TeamsState }) {
  const t = useT("teamsSetup");
  if (!state) return null;
  return <Notice tone="error" title={t(`errors.${state.error}`)}>{state.detail ? t("microsoftSaid", { detail: state.detail }) : null}</Notice>;
}

/** Connecting a company's bot: where to find three values, then the fields. */
export function TeamsConnectForm({ action, slug }: { action: Action; slug: string }) {
  const t = useT("teamsSetup");
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
          {t("appId")}
          <input name="appId" required autoComplete="off" spellCheck={false} dir="ltr" maxLength={40} placeholder="00000000-0000-0000-0000-000000000000" className={`${field} font-mono`} />
          <span className="text-xs font-normal text-muted">{t("appIdHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("tenant")}
          <input name="tenant" required autoComplete="off" spellCheck={false} dir="ltr" maxLength={40} placeholder="00000000-0000-0000-0000-000000000000" className={`${field} font-mono`} />
          <span className="text-xs font-normal text-muted">{t("tenantHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("secret")}
          <input name="secret" required autoComplete="off" spellCheck={false} dir="ltr" maxLength={200} className={`${field} font-mono`} />
          <span className="text-xs font-normal text-muted">{t("secretHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("nameLabel")}
          <input name="name" defaultValue="Help desk" maxLength={80} className={field} />
          <span className="text-xs font-normal text-muted">{t("nameHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("greeting")}
          <textarea name="greeting" rows={3} maxLength={500} dir="auto" className={`${field} py-2`} />
          <span className="text-xs font-normal text-muted">{t("greetingHelp")}</span>
        </label>
        <div><Submit pending={t("connecting")}>{t("connect")}</Submit></div>
      </form>
    </div>
  );
}

/** The inbox name and the optional welcome message. */
export function TeamsSettingsForm({ action, slug, id, name, greeting, canManage }: { action: Action; slug: string; id: string; name: string; greeting: string; canManage: boolean }) {
  const t = useT("teamsSetup");
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
          <span className="text-xs font-normal text-muted">{t("renameHelp")}</span>
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("greeting")}
          <textarea name="greeting" defaultValue={greeting} rows={3} maxLength={500} dir="auto" className={`${field} py-2`} />
          <span className="text-xs font-normal text-muted">{t("greetingHelp")}</span>
        </label>
      </fieldset>
      {canManage && <div><Submit pending={t("connecting")}>{t("save")}</Submit></div>}
    </form>
  );
}

/** A new client secret for the same bot, or bringing a disconnected bot back. */
export function TeamsReplaceSecret({ action, slug, id, reconnect }: { action: Action; slug: string; id: string; reconnect: boolean }) {
  const t = useT("teamsSetup");
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className="grid gap-3 sm:max-w-lg">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={id} />
      <Problem state={state} />
      <p className="text-sm text-muted">{reconnect ? t("reconnectHelp") : t("replaceHelp")}</p>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("secret")}
        <input name="secret" required autoComplete="off" spellCheck={false} dir="ltr" maxLength={200} className={`${field} font-mono`} />
      </label>
      <div><Submit variant="secondary" pending={t("connecting")}>{reconnect ? t("reconnect") : t("replace")}</Submit></div>
    </form>
  );
}
