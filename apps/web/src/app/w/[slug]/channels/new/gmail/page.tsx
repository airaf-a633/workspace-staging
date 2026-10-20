import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, GoogleLogo } from "@phosphor-icons/react/dist/ssr";
import { z } from "zod";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { Submit } from "@/components/ui/submit";
import { Notice } from "@/components/ui/surface";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";

export async function generateMetadata() {
  return { title: (await getT("gmailSetup"))("title") };
}

const ERRORS = ["notConfigured", "notAllowed", "declined", "expired", "alreadyConnected", "missingScopes", "needName"] as const;

/** Turns the pending Google sign-in into an email channel for that mailbox. */
async function finishGmail(data: FormData) {
  "use server";
  const slug = String(data.get("slug"));
  const pending = z.uuid().parse(data.get("pending"));
  const { supabase } = await loadWorkspace(slug);
  const name = String(data.get("name") ?? "").trim();
  if (!name) redirect(`/w/${slug}/channels/new/gmail?pending=${pending}&error=needName`);
  const { data: id, error } = await supabase.rpc("finish_gmail_channel", { p_pending: pending, p_name: name });
  if (error) {
    const m = error.message;
    redirect(`/w/${slug}/channels/new/gmail?error=${m.includes("expired") ? "expired" : m.includes("already_connected") ? "alreadyConnected" : m.includes("not_allowed") ? "notAllowed" : "failed"}`);
  }
  redirect(`/w/${slug}/channels/${id}?created=1`);
}

/* "Continue with Google": sign in as the mailbox customers write to, then name it. */
export default async function NewGmail(props: PageProps<"/w/[slug]/channels/new/gmail">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, workspace } = await loadWorkspace(slug);
  if (!(await can(workspace.id, "numbers.manage"))) notFound();
  const t = await getT("gmailSetup");
  const error = typeof sp.error === "string" ? (ERRORS.find((e) => e === sp.error) ?? "failed") : null;
  const pending = typeof sp.pending === "string" && /^[0-9a-f-]{36}$/.test(sp.pending) ? sp.pending : null;
  const { data: account } = pending ? await supabase.rpc("pending_mail_account", { p_pending: pending }) : { data: null };

  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <Link href={`/w/${slug}/channels/new/email`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("back")}
      </Link>
      <SectionHeader title={t("title")} description={t("help")} />
      {error && <Notice tone="error" title={t(`errors.${error}`)} />}

      {account ? (
        <form action={finishGmail} className="grid gap-5 sm:max-w-lg">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="pending" value={pending!} />
          <p className="text-sm">{t.rich("signedInAs", { account: <span className="font-medium" dir="ltr">{account}</span> })}</p>
          <label className="grid gap-1.5 text-sm font-medium">
            {t("name")}
            <input name="name" defaultValue={t("defaultName")} required maxLength={80} className="min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal" />
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
          <a href={`/api/oauth/google/start?slug=${slug}`} className={buttonClass("primary", "lg", "w-fit")}>
            <GoogleLogo size={20} weight="bold" aria-hidden="true" /> {t("continue")}
          </a>
          <p className="text-xs text-muted">{t("permissions")}</p>
        </div>
      )}
    </SettingsFrame>
  );
}
