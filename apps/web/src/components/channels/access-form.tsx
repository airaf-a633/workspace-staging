"use client";

import { useActionState } from "react";
import { Notice } from "@/components/ui/surface";
import { Submit } from "@/components/ui/submit";
import { useT } from "@/i18n/client";
import type { AccessState } from "@/app/w/[slug]/channels/access-actions";

const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal";

/** The "Request access" button, with an optional note about what the business wants it for. */
export function AccessForm({ action, slug, channel, note, requested }: { action: (prev: AccessState, data: FormData) => Promise<AccessState>; slug: string; channel: string; note: string; requested: boolean }) {
  const t = useT("gatedChannels");
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className="grid gap-4 sm:max-w-lg">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="channel" value={channel} />
      {state && <Notice tone="error" title={t(`errors.${state.error}`)} />}
      <label className="grid gap-1.5 text-sm font-medium">
        {t("noteLabel")}
        <textarea name="note" defaultValue={note} rows={3} maxLength={500} dir="auto" className={`${field} py-2`} />
        <span className="text-xs font-normal text-muted">{t("noteHelp")}</span>
      </label>
      <div><Submit pending={t("saving")}>{requested ? t("update") : t("request")}</Submit></div>
    </form>
  );
}
