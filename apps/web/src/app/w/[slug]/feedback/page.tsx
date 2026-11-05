import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { Submit } from "@/components/ui/submit";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";
import { sendFeedback } from "./actions";

export async function generateMetadata() {
  return { title: (await getT("pilotFeedback"))("title") };
}

const KINDS = ["broken", "confusing", "wish", "other"] as const;

/* Tell the founder what is broken, confusing or missing (decided 2026-11-05). Anyone in the workspace may; nobody else can read it. */
export default async function Feedback(props: PageProps<"/w/[slug]/feedback">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { workspace } = await loadWorkspace(slug);
  const t = await getT("pilotFeedback");
  const from = typeof sp.from === "string" ? sp.from : "";
  const error = sp.error === "needMessage" || sp.error === "tooMany" ? sp.error : sp.error ? "failed" : null;
  return (
    <SettingsFrame base={`/w/${slug}`} active="feedback" isOwner={await can(workspace.id, "members.manage")}>
      <SectionHeader title={t("title")} description={t("description")} />
      {sp.sent && <Notice tone="success" title={t("thanks")} />}
      {error && <Notice tone="error" title={t(`errors.${error}`)} />}
      <form action={sendFeedback} className="grid gap-5 sm:max-w-xl">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="from" value={from} />
        <fieldset className="grid gap-2">
          <legend className="pb-1 text-sm font-medium">{t("kind")}</legend>
          {KINDS.map((k) => (
            <label key={k} className="flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] border border-border px-4">
              <input type="radio" name="kind" value={k} required className="size-4 accent-[var(--primary)]" />
              {t(`kinds.${k}`)}
            </label>
          ))}
        </fieldset>
        <label className="grid gap-1.5 text-sm font-medium">
          {t("message")}
          <textarea name="body" required maxLength={4000} rows={6} className="w-full rounded-[var(--radius-control)] border border-input bg-surface p-3 text-base font-normal text-text" />
          <span className="text-sm font-normal text-muted">{t("messageHelp")}</span>
        </label>
        <div><Submit pending={t("sending")}>{t("send")}</Submit></div>
      </form>
    </SettingsFrame>
  );
}
