import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { WebchatForm } from "@/components/channels/webchat-form";
import { EmailForm } from "@/components/channels/email-form";
import { serverEnv } from "@/env";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { publicEnv } from "@/lib/public-env";
import { can, loadWorkspace } from "@/lib/workspace";
import { updateWebchat } from "../webchat-actions";
import { updateEmailChannel, verifyEmailDomain } from "../email-actions";
import { Submit } from "@/components/ui/submit";

export async function generateMetadata() {
  return { title: (await getT("settings"))("channels") };
}

/** Where the install code points: the configured site address, else the address this page was opened on. */
async function appOrigin() {
  const configured = publicEnv().siteUrl;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}

/* One channel in a real workspace. WhatsApp has its own page; website chat shows its install code and settings. */
export default async function ChannelPage(props: PageProps<"/w/[slug]/channels/[id]">) {
  const { slug, id } = await props.params;
  const sp = await props.searchParams;
  const { supabase, workspace } = await loadWorkspace(slug);
  const { data: ch } = await supabase.from("channels").select("id, type, name, external_id, settings, status").eq("id", id).eq("workspace_id", workspace.id).maybeSingle();
  if (!ch) notFound();
  if (ch.type === "whatsapp") redirect(`/w/${slug}/whatsapp`);
  if (ch.type === "email") return <EmailChannel slug={slug} ch={ch} sp={sp} workspaceId={workspace.id} />;
  if (ch.type !== "webchat") notFound();

  const t = await getT("webchatSetup");
  const canManage = await can(workspace.id, "numbers.manage");
  const s = (ch.settings ?? {}) as { color?: string; greeting?: string; position?: "left" | "right"; domains?: string };
  const snippet = `<script src="${await appOrigin()}/widget.js" data-relay-key="${ch.external_id}" async></script>`;
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <Link href={`/w/${slug}/channels`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("backToList")}
      </Link>
      <SectionHeader title={ch.name} description={t("pageHelp")} />
      {sp.created && <Notice tone="success" title={t("created")}>{t("createdBody")}</Notice>}
      {sp.saved && <Notice tone="success" title={t("saved")} />}
      {error && <Notice tone="error" title={t(`errors.${error === "needName" ? "needName" : error === "notAllowed" ? "notAllowed" : "failed"}`)} />}

      <section className="grid gap-3 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border">
        <h2 className="font-semibold">{t("installTitle")}</h2>
        <p className="text-sm text-muted">{t("installHelp")}</p>
        <pre className="overflow-x-auto rounded-[var(--radius-control)] bg-surface-2 p-4 text-sm" dir="ltr"><code>{snippet}</code></pre>
        <p className="text-xs text-muted">{t("installNote")}</p>
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">{t("lookTitle")}</h2>
        <WebchatForm
          action={updateWebchat}
          slug={slug}
          id={ch.id}
          initial={{ name: ch.name, site: s.domains ?? "", color: s.color ?? "#006ACC", greeting: s.greeting ?? "", position: s.position ?? "right" }}
          submit={t("save")}
          disabled={!canManage}
        />
        {!canManage && <p className="text-sm text-muted">{t("readOnly")}</p>}
      </section>
    </SettingsFrame>
  );
}

const STEPS = ["one", "two", "three"] as const;
/** Shared mailbox providers: nobody but the provider can verify these domains, so we don't offer it. */
const FREE_MAIL = ["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "zoho.com"];
const EMAIL_ERRORS = ["needName", "badAddress", "notAllowed", "domainNotConfigured", "domainFailed"] as const;

/* An email channel: the forwarding address to point the business's mailbox at, then how replies look. */
async function EmailChannel({ slug, ch, sp, workspaceId }: {
  slug: string;
  ch: { id: string; name: string; external_id: string | null; settings: unknown };
  sp: Record<string, string | string[] | undefined>;
  workspaceId: string;
}) {
  const t = await getT("emailSetup");
  const canManage = await can(workspaceId, "numbers.manage");
  const s = (ch.settings ?? {}) as {
    address?: string; fromName?: string; signature?: string; domainVerified?: boolean;
    domain?: { name: string; dkimHost: string; dkimValue: string; returnPathHost: string; returnPathTarget: string; verified: boolean };
  };
  const domainName = (s.address ?? "").split("@")[1] ?? "";
  const pending = s.domain && s.domain.name === domainName && !s.domain.verified ? s.domain : null;
  const freeMail = FREE_MAIL.includes(domainName.toLowerCase());
  const domain = serverEnv().INBOUND_EMAIL_DOMAIN;
  const forward = domain ? `${ch.external_id}@${domain}` : null;
  const error = typeof sp.error === "string" ? (EMAIL_ERRORS.find((e) => e === sp.error) ?? "failed") : null;

  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspaceId, "members.manage")}>
      <Link href={`/w/${slug}/channels`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("backToList")}
      </Link>
      <SectionHeader title={ch.name} description={t("pageHelp", { address: s.address ?? "" })} />
      {sp.created && <Notice tone="success" title={t("created")}>{t("createdBody")}</Notice>}
      {sp.saved && <Notice tone="success" title={t("saved")} />}
      {error && <Notice tone="error" title={t(`errors.${error}`)} />}

      <section className="grid gap-3 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border">
        <h2 className="font-semibold">{t("forwardTitle")}</h2>
        {forward ? (
          <>
            <p className="text-sm text-muted">{t("forwardHelp", { address: s.address ?? "" })}</p>
            <p className="break-all rounded-[var(--radius-control)] bg-surface-2 p-4 font-mono text-sm" dir="ltr">{forward}</p>
            <ol className="grid list-decimal gap-1.5 ps-5 text-sm">
              {STEPS.map((k) => <li key={k}>{t(`forwardSteps.${k}`, { address: s.address ?? "" })}</li>)}
            </ol>
          </>
        ) : (
          <p className="text-sm text-muted">{t("notConfigured")}</p>
        )}
      </section>

      {sp.verified && <Notice tone="success" title={t("verifiedNow", { domain: domainName })} />}
      {sp.checked && <Notice tone="warn" title={t("notYet")}>{t("notYetBody")}</Notice>}
      <section className="grid gap-3 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border">
        <h2 className="font-semibold">{t("fromTitle")}</h2>
        <p className="text-sm text-muted">
          {s.domainVerified ? t("fromVerified", { address: s.address ?? "" }) : freeMail ? t("fromFreeMail", { domain: domainName, address: s.address ?? "" }) : t("fromPending", { address: s.address ?? "" })}
        </p>
        {!s.domainVerified && !freeMail && pending && (
          <div className="grid gap-2 text-sm">
            <p>{t("recordsIntro", { domain: domainName })}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-start" dir="ltr">
                <thead><tr className="border-b border-border text-xs text-muted"><th className="py-2 pe-3 text-start font-medium">{t("recordType")}</th><th className="py-2 pe-3 text-start font-medium">{t("recordHost")}</th><th className="py-2 text-start font-medium">{t("recordValue")}</th></tr></thead>
                <tbody className="font-mono text-xs">
                  <tr className="border-b border-border align-top"><td className="py-2 pe-3">TXT</td><td className="break-all py-2 pe-3">{pending.dkimHost}</td><td className="break-all py-2">{pending.dkimValue}</td></tr>
                  <tr className="align-top"><td className="py-2 pe-3">CNAME</td><td className="break-all py-2 pe-3">{pending.returnPathHost}</td><td className="break-all py-2">{pending.returnPathTarget}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">{t("recordsNote")}</p>
          </div>
        )}
        {!s.domainVerified && !freeMail && canManage && (
          <form action={verifyEmailDomain}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={ch.id} />
            <Submit variant={pending ? "secondary" : "primary"}>{pending ? t("checkAgain") : t("verify", { domain: domainName })}</Submit>
          </form>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">{t("settingsTitle")}</h2>
        <EmailForm
          action={updateEmailChannel}
          slug={slug}
          id={ch.id}
          initial={{ name: ch.name, address: s.address ?? "", fromName: s.fromName ?? "", signature: s.signature ?? "" }}
          submit={t("save")}
          disabled={!canManage}
        />
        {!canManage && <p className="text-sm text-muted">{t("readOnly")}</p>}
      </section>
    </SettingsFrame>
  );
}
