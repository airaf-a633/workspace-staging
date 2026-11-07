import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MicrosoftOutlookLogo } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { Submit } from "@/components/ui/submit";
import { Notice } from "@/components/ui/surface";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";
import { finishOutlook } from "../../outlook-actions";

export async function generateMetadata() {
  return { title: (await getT("outlookSetup"))("title") };
}

const ERRORS = ["notConfigured", "notAllowed", "declined", "expired", "alreadyConnected", "badAddress", "needName"] as const;

/* "Continue with Outlook": sign in with Microsoft, then choose your own mailbox or a shared one. */
export default async function NewOutlook(props: PageProps<"/w/[slug]/channels/new/outlook">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) notFound();
  const t = await getT("outlookSetup");
  const error = typeof sp.error === "string" ? (ERRORS.find((e) => e === sp.error) ?? "failed") : null;
  const pending = typeof sp.pending === "string" && /^[0-9a-f-]{36}$/.test(sp.pending) ? sp.pending : null;
  const { data: account } = pending ? await supabase.rpc("pending_mail_account", { p_pending: pending }) : { data: null };
  const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3";

  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <Link href={`/w/${slug}/channels/new/email`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <SectionHeader title={t("title")} description={t("help")} />
      {error && <Notice tone="error" title={t(`errors.${error}`)} />}

      {account ? (
        <form action={finishOutlook} className="grid gap-5 sm:max-w-lg">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="pending" value={pending!} />
          <input type="hidden" name="own" value={account} />
          <p className="text-sm">{t.rich("signedInAs", { account: <span className="font-medium" dir="ltr">{account}</span> })}</p>
          <fieldset className="grid gap-3">
            <legend className="mb-2 font-medium">{t("whichMailbox")}</legend>
            <label className="flex items-start gap-3 rounded-[var(--radius-control)] border border-border p-3">
              <input type="radio" name="which" value="own" defaultChecked className="mt-1 size-4 accent-[var(--primary)]" />
              <span className="grid"><span className="font-medium">{t("own")}</span><span className="text-sm text-muted" dir="ltr">{account}</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-[var(--radius-control)] border border-border p-3">
              <input type="radio" name="which" value="shared" className="mt-1 size-4 accent-[var(--primary)]" />
              <span className="grid flex-1 gap-2">
                <span className="grid"><span className="font-medium">{t("shared")}</span><span className="text-sm text-muted">{t("sharedHelp")}</span></span>
                <input name="shared" type="email" placeholder="support@yourbusiness.com" dir="ltr" className={field} />
              </span>
            </label>
          </fieldset>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("name")}
            <input name="name" defaultValue={t("defaultName")} required maxLength={80} className={`${field} font-normal`} />
          </label>
          <div><Submit>{t("connect")}</Submit></div>
          <p className="text-xs text-muted">{t("privacy")}</p>
        </form>
      ) : (
        <div className="grid gap-4 sm:max-w-lg">
          <ul className="grid list-disc gap-1.5 ps-5 text-sm text-muted">
            <li>{t("points.one")}</li>
            <li>{t("points.two")}</li>
            <li>{t("points.three")}</li>
          </ul>
          <a href={`/api/oauth/microsoft/start?slug=${slug}`} className={buttonClass("primary", "lg", "w-fit")}>
            <MicrosoftOutlookLogo size={20} aria-hidden="true" /> {t("continue")}
          </a>
          <p className="text-xs text-muted">{t("permissions")}</p>
        </div>
      )}
    </SettingsFrame>
  );
}
