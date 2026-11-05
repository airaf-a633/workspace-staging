"use client";

import { useActionState } from "react";
import { CopyField } from "@/components/ui/copy-button";
import { Notice } from "@/components/ui/surface";
import { Submit } from "@/components/ui/submit";
import { useT } from "@/i18n/client";
import type { ApiState } from "@/app/w/[slug]/channels/api-actions";

const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal";

/** The key, the signing secret and a working example. Shown once: only a fingerprint of the key is kept. */
function Revealed({ r }: { r: NonNullable<NonNullable<ApiState>["revealed"]> }) {
  const t = useT("apiSetup");
  const curl = `curl -X POST ${r.endpoint} \\\n  -H "Authorization: Bearer ${r.apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"id":"msg-1","customer":{"id":"user-42","name":"Ana"},"text":"Hello"}'`;
  return (
    <div className="grid gap-4">
      <Notice tone="success" title={t("revealedTitle")}>{t("revealedBody")}</Notice>
      <div className="grid gap-1.5 text-sm font-medium">
        {t("keyLabel")}
        <CopyField value={r.apiKey} label={t("keyLabel")} />
      </div>
      {r.webhookSecret && (
        <div className="grid gap-1.5 text-sm font-medium">
          {t("secretLabel")}
          <CopyField value={r.webhookSecret} label={t("secretLabel")} />
          <span className="text-xs font-normal text-muted">{t("secretHelp")}</span>
        </div>
      )}
      <div className="grid gap-1.5 text-sm font-medium">
        {t("addressLabel")}
        <CopyField value={r.endpoint} label={t("addressLabel")} />
      </div>
      <div className="grid gap-1.5 text-sm font-medium">
        {t("tryTitle")}
        <pre className="overflow-x-auto rounded-[var(--radius-control)] bg-surface-2 p-4 text-sm font-normal" dir="ltr"><code>{curl}</code></pre>
      </div>
    </div>
  );
}

const errorKey = (e: string): "needName" | "needHttps" | "notAllowed" | "failed" => (e === "needName" || e === "needHttps" || e === "notAllowed" ? e : "failed");

export function ApiCreateForm({ action, slug }: { action: (prev: ApiState, data: FormData) => Promise<ApiState>; slug: string }) {
  const t = useT("apiSetup");
  const [state, run] = useActionState(action, null);
  if (state?.revealed) return <Revealed r={state.revealed} />;
  return (
    <form action={run} className="grid gap-4 sm:max-w-lg">
      <input type="hidden" name="slug" value={slug} />
      {state?.error && <Notice tone="error" title={t(`errors.${errorKey(state.error)}`)} />}
      <label className="grid gap-1.5 text-sm font-medium">
        {t("name")}
        <input name="name" defaultValue={t("defaultName")} required maxLength={80} className={field} />
        <span className="text-xs font-normal text-muted">{t("nameHelp")}</span>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        {t("webhook")}
        <input name="webhook" type="url" placeholder="https://example.com/relay-replies" dir="ltr" maxLength={2000} className={field} />
        <span className="text-xs font-normal text-muted">{t("webhookHelp")}</span>
      </label>
      <div><Submit>{t("create")}</Submit></div>
    </form>
  );
}

/** Replacing the key: the old one stops at once, and the new one is shown once. */
export function ApiRotate({ action, slug, id }: { action: (prev: ApiState, data: FormData) => Promise<ApiState>; slug: string; id: string }) {
  const t = useT("apiSetup");
  const [state, run] = useActionState(action, null);
  if (state?.revealed) return <Revealed r={state.revealed} />;
  return (
    <form action={run} className="grid gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="id" value={id} />
      {state?.error && <Notice tone="error" title={t(`errors.${errorKey(state.error)}`)} />}
      <p className="text-sm text-muted">{t("rotateHelp")}</p>
      <div><Submit variant="secondary" pending={t("rotating")}>{t("rotate")}</Submit></div>
    </form>
  );
}
