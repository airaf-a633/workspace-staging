"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui/surface";
import { Submit } from "@/components/ui/submit";
import { useT } from "@/i18n/client";
import type { DiscordState } from "@/app/w/[slug]/channels/discord-actions";

const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal";

type Action = (prev: DiscordState, data: FormData) => Promise<DiscordState>;

function Problem({ state }: { state: DiscordState }) {
  const t = useT("discordSetup");
  if (!state) return null;
  return <Notice tone="error" title={t(`errors.${state.error}`)} />;
}

/** Connecting a bot: three small steps, then the bot's token. */
export function DiscordConnectForm({ action, slug }: { action: Action; slug: string }) {
  const t = useT("discordSetup");
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
          {t("nameLabel")}
          <input name="name" defaultValue="Discord" maxLength={80} className={field} />
        </label>
        <div><Submit pending={t("connecting")}>{t("connect")}</Submit></div>
      </form>
    </div>
  );
}

/** A new token for the same bot, or bringing a disconnected bot back. */
export function DiscordReplaceToken({ action, slug, id, reconnect }: { action: Action; slug: string; id: string; reconnect: boolean }) {
  const t = useT("discordSetup");
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
