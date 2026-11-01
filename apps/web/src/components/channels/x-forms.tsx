"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui/surface";
import { Submit } from "@/components/ui/submit";
import { useT } from "@/i18n/client";
import type { XState } from "@/app/w/[slug]/channels/x-actions";

const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal";

type Action = (prev: XState, data: FormData) => Promise<XState>;

function Problem({ state }: { state: XState }) {
  const t = useT("xSetup");
  if (!state) return null;
  return <Notice tone="error" title={t(`errors.${state.error}`)} />;
}

function Secrets({ required }: { required: boolean }) {
  const t = useT("xSetup");
  return (
    <>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("clientSecret")}
        <input name="clientSecret" required={required} autoComplete="off" spellCheck={false} dir="ltr" maxLength={400} className={`${field} font-mono`} />
        <span className="text-xs font-normal text-muted">{t("clientSecretHelp")}</span>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("bearerToken")}
        <input name="bearerToken" required={required} autoComplete="off" spellCheck={false} dir="ltr" maxLength={400} className={`${field} font-mono`} />
        <span className="text-xs font-normal text-muted">{t("bearerTokenHelp")}</span>
      </label>
    </>
  );
}

/** Connecting through the business's own X app: three values, then X's login page. */
export function XConnectForm({ action, slug }: { action: Action; slug: string }) {
  const t = useT("xSetup");
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className="grid gap-4 sm:max-w-lg">
      <input type="hidden" name="slug" value={slug} />
      <Problem state={state} />
      <label className="grid gap-1.5 text-sm font-medium">
        {t("clientId")}
        <input name="clientId" required autoComplete="off" spellCheck={false} dir="ltr" maxLength={100} className={`${field} font-mono`} />
        <span className="text-xs font-normal text-muted">{t("clientIdHelp")}</span>
      </label>
      <Secrets required />
      <label className="grid gap-1.5 text-sm font-medium">
        {t("nameLabel")}
        <input name="name" defaultValue="X" maxLength={80} className={field} />
      </label>
      <div><Submit pending={t("connecting")}>{t("connect")}</Submit></div>
    </form>
  );
}

/** New app secrets for the same app; the account then logs in again. */
export function XReplaceSecrets({ action, slug, id, reconnect }: { action: Action; slug: string; id: string; reconnect: boolean }) {
  const t = useT("xSetup");
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className="grid gap-3 sm:max-w-lg">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={id} />
      <Problem state={state} />
      <p className="text-sm text-muted">{reconnect ? t("reconnectHelp") : t("replaceHelp")}</p>
      <Secrets required />
      <div><Submit variant="secondary" pending={t("connecting")}>{reconnect ? t("reconnect") : t("replace")}</Submit></div>
    </form>
  );
}
