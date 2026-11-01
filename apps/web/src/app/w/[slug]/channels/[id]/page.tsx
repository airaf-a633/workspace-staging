import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { WebchatForm } from "@/components/channels/webchat-form";
import { EmailForm } from "@/components/channels/email-form";
import { serverEnv } from "@/env";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { appOrigin } from "@/lib/app-origin";
import { can, loadWorkspace } from "@/lib/workspace";
import { updateWebchat } from "../webchat-actions";
import { ApiRotate } from "@/components/channels/api-inbox";
import { rotateApiKey, updateApiInbox } from "../api-actions";
import { TelegramReplaceToken } from "@/components/channels/telegram-forms";
import { disconnectTelegram, replaceTelegramToken, updateTelegram } from "../telegram-actions";
import { CopyField } from "@/components/ui/copy-button";
import { getWebhookInfo } from "@/lib/channels/telegram-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { LineReplaceCredentials } from "@/components/channels/line-forms";
import { disconnectLine, replaceLineCredentials, updateLine } from "../line-actions";
import { getBotInfo } from "@/lib/channels/line-api";
import { SmsReplaceCredentials } from "@/components/channels/sms-forms";
import { disconnectSms, replaceSmsCredentials, updateSms } from "../sms-actions";
import { getAccount } from "@/lib/channels/twilio";
import { requestNow } from "@/lib/now";
import { updateEmailChannel, verifyEmailDomain } from "../email-actions";
import { Submit } from "@/components/ui/submit";

export async function generateMetadata() {
  return { title: (await getT("settings"))("channels") };
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
  if (ch.type === "api") return <ApiChannel slug={slug} ch={ch} sp={sp} workspaceId={workspace.id} />;
  if (ch.type === "telegram") return <TelegramChannel slug={slug} ch={ch} sp={sp} workspaceId={workspace.id} />;
  if (ch.type === "line") return <LineChannel slug={slug} ch={ch} sp={sp} workspaceId={workspace.id} />;
  if (ch.type === "sms") return <SmsChannel slug={slug} ch={ch} sp={sp} workspaceId={workspace.id} />;
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
  ch: { id: string; name: string; external_id: string | null; settings: unknown; status: string };
  sp: Record<string, string | string[] | undefined>;
  workspaceId: string;
}) {
  const t = await getT("emailSetup");
  const canManage = await can(workspaceId, "numbers.manage");
  const s = (ch.settings ?? {}) as {
    provider?: string; account?: string;
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

      {s.provider === "outlook" || s.provider === "gmail" ? (
        <section className="grid gap-3 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border">
          <h2 className="font-semibold">{t(s.provider === "gmail" ? "gmailTitle" : "outlookTitle")}</h2>
          <p className="text-sm text-muted">
            {ch.status === "disconnected"
              ? t(s.provider === "gmail" ? "gmailBroken" : "outlookBroken", { address: s.address ?? "" })
              : t(s.provider === "gmail" ? "gmailOk" : "outlookOk", { address: s.address ?? "", account: s.account ?? "" })}
          </p>
          {ch.status === "disconnected" && canManage && (
            <a href={`/api/oauth/${s.provider === "gmail" ? "google" : "microsoft"}/start?slug=${slug}`} className="w-fit rounded-[var(--radius-control)] bg-primary px-4 py-2.5 text-sm font-medium text-on-primary">
              {t(s.provider === "gmail" ? "reconnectGmail" : "reconnect")}
            </a>
          )}
        </section>
      ) : (<>
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
      </>)}

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

/* An API inbox: where messages go in, where replies go out, and the key. */
async function ApiChannel({ slug, ch, sp, workspaceId }: {
  slug: string;
  ch: { id: string; name: string; settings: unknown };
  sp: Record<string, string | string[] | undefined>;
  workspaceId: string;
}) {
  const t = await getT("apiSetup");
  const canManage = await can(workspaceId, "numbers.manage");
  const s = (ch.settings ?? {}) as { webhook_key?: string; webhook_url?: string };
  const endpoint = `${await appOrigin()}/api/v1/inboxes/${s.webhook_key}/messages`;
  const error = typeof sp.error === "string" ? sp.error : null;
  const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal";
  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspaceId, "members.manage")}>
      <Link href={`/w/${slug}/channels`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("backToList")}
      </Link>
      <SectionHeader title={ch.name} description={t("pageHelp")} />
      {sp.saved && <Notice tone="success" title={t("saved")} />}
      {error && <Notice tone="error" title={t(error === "needName" ? "errors.needName" : error === "needHttps" ? "errors.needHttps" : error === "notAllowed" ? "errors.notAllowed" : "errors.failed")} />}

      <section className="grid gap-3 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border">
        <h2 className="font-semibold">{t("sendTitle")}</h2>
        <p className="text-sm text-muted">{t("sendHelp")}</p>
        <pre className="overflow-x-auto rounded-[var(--radius-control)] bg-surface-2 p-4 text-sm" dir="ltr"><code>POST {endpoint}</code></pre>
      </section>

      <section className="grid gap-3">
        <h2 className="font-semibold">{t("repliesTitle")}</h2>
        <form action={updateApiInbox} className="grid gap-4 sm:max-w-lg">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={ch.id} />
          <fieldset disabled={!canManage} className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              {t("name")}
              <input name="name" defaultValue={ch.name} required maxLength={80} className={field} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {t("webhook")}
              <input name="webhook" type="url" defaultValue={s.webhook_url ?? ""} placeholder="https://example.com/relay-replies" dir="ltr" maxLength={2000} className={field} />
              <span className="text-xs font-normal text-muted">{t("webhookHelp")}</span>
            </label>
          </fieldset>
          {canManage && <div><Submit>{t("save")}</Submit></div>}
        </form>
      </section>

      {canManage && (
        <section className="grid gap-3">
          <h2 className="font-semibold">{t("keyTitle")}</h2>
          <ApiRotate action={rotateApiKey} slug={slug} id={ch.id} />
        </section>
      )}
    </SettingsFrame>
  );
}

/* A Telegram bot: its link, whether Telegram is delivering, the greeting, the token and disconnecting. */
async function TelegramChannel({ slug, ch, sp, workspaceId }: {
  slug: string;
  ch: { id: string; name: string; settings: unknown; status: string };
  sp: Record<string, string | string[] | undefined>;
  workspaceId: string;
}) {
  const t = await getT("telegramSetup");
  const canManage = await can(workspaceId, "numbers.manage");
  const s = (ch.settings ?? {}) as { username?: string | null; greeting?: string; webhook_key?: string };
  const disconnected = ch.status === "disconnected";
  const error = typeof sp.error === "string" ? sp.error : null;
  const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal";

  // What Telegram itself says about delivery. Only managers see it; the token is read here and never shown.
  let health: "ok" | "none" | "rejected" | "unknown" | { error: string } = "unknown";
  let pending = 0;
  if (canManage && !disconnected) {
    const { data: secrets } = await createAdminClient().rpc("channel_secrets", { p_channel: ch.id });
    const token = (secrets as { bot_token?: string } | null)?.bot_token;
    if (token) {
      const info = await getWebhookInfo(fetch, token);
      if (info.ok) {
        pending = info.value.pending;
        health = !info.value.url ? "none" : info.value.lastError && info.value.lastErrorAt && requestNow() - info.value.lastErrorAt.getTime() < 3_600_000 ? { error: info.value.lastError } : "ok";
      } else if (info.reason === "rejected") health = "rejected";
    }
  }

  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspaceId, "members.manage")}>
      <Link href={`/w/${slug}/channels`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("backToList")}
      </Link>
      <SectionHeader title={ch.name} description={t("pageHelp")} />
      {sp.created && <Notice tone="success" title={t("created")}>{t("createdBody")}</Notice>}
      {sp.saved && <Notice tone="success" title={t("saved")} />}
      {error && <Notice tone="error" title={t(error === "needName" ? "errors.needName" : error === "notAllowed" ? "errors.notAllowed" : "errors.failed")} />}
      {disconnected && <Notice tone="warn" title={t("disconnected")}>{t("disconnectedBody")}</Notice>}

      {!disconnected && s.username && (
        <section className="grid gap-2">
          <h2 className="font-semibold">{t("linkTitle")}</h2>
          <CopyField value={`https://t.me/${s.username}`} label={t("linkTitle")} />
        </section>
      )}

      {canManage && !disconnected && (
        <section className="grid gap-2">
          <h2 className="font-semibold">{t("healthTitle")}</h2>
          {health === "ok" && <Notice tone="success" title={t("healthOk")}>{pending > 0 ? t("healthPending", { count: pending }) : null}</Notice>}
          {health === "none" && <Notice tone="error" title={t("healthNone")} />}
          {health === "rejected" && <Notice tone="error" title={t("healthRejected")} />}
          {health === "unknown" && <Notice tone="warn" title={t("healthUnknown")} />}
          {typeof health === "object" && <Notice tone="error" title={t("healthError", { error: health.error })} />}
        </section>
      )}

      <section className="grid gap-3">
        <form action={updateTelegram} className="grid gap-4 sm:max-w-lg">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={ch.id} />
          <fieldset disabled={!canManage} className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              {t("nameLabel")}
              <input name="name" defaultValue={ch.name} required maxLength={80} className={field} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {t("greeting")}
              <textarea name="greeting" rows={3} maxLength={1000} defaultValue={s.greeting ?? ""} placeholder={t("greetingPlaceholder")} className={`${field} py-2`} />
              <span className="text-xs font-normal text-muted">{t("greetingHelp")}</span>
            </label>
          </fieldset>
          {canManage && <div><Submit>{t("save")}</Submit></div>}
        </form>
      </section>

      {canManage && (
        <section className="grid gap-3">
          <h2 className="font-semibold">{t("replaceTitle")}</h2>
          <TelegramReplaceToken action={replaceTelegramToken} slug={slug} id={ch.id} reconnect={disconnected} />
        </section>
      )}

      {canManage && !disconnected && (
        <section className="grid gap-3">
          <h2 className="font-semibold">{t("disconnectTitle")}</h2>
          <p className="text-sm text-muted">{t("disconnectHelp")}</p>
          <form action={disconnectTelegram}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={ch.id} />
            <Submit variant="secondary">{t("disconnect")}</Submit>
          </form>
        </section>
      )}
    </SettingsFrame>
  );
}

/* A LINE account: the address to paste into LINE, whether LINE accepts the token, the greeting, the token and disconnecting. */
async function LineChannel({ slug, ch, sp, workspaceId }: {
  slug: string;
  ch: { id: string; name: string; settings: unknown; status: string };
  sp: Record<string, string | string[] | undefined>;
  workspaceId: string;
}) {
  const t = await getT("lineSetup");
  const canManage = await can(workspaceId, "numbers.manage");
  const s = (ch.settings ?? {}) as { greeting?: string; webhook_key?: string };
  const disconnected = ch.status === "disconnected";
  const error = typeof sp.error === "string" ? sp.error : null;
  const address = `${await appOrigin()}/api/webhooks/line/${s.webhook_key}`;
  const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal";

  // What LINE itself says about the token. Only managers see it; the token is read here and never shown.
  let health: "ok" | "rejected" | "unknown" = "unknown";
  if (canManage && !disconnected) {
    const { data: secrets } = await createAdminClient().rpc("channel_secrets", { p_channel: ch.id });
    const token = (secrets as { access_token?: string } | null)?.access_token;
    if (token) {
      const bot = await getBotInfo(fetch, token);
      health = bot.ok ? "ok" : bot.reason === "rejected" ? "rejected" : "unknown";
    }
  }

  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspaceId, "members.manage")}>
      <Link href={`/w/${slug}/channels`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("backToList")}
      </Link>
      <SectionHeader title={ch.name} description={t("pageHelp")} />
      {sp.created && <Notice tone="success" title={t("created")}>{t("createdBody")}</Notice>}
      {sp.saved && <Notice tone="success" title={t("saved")} />}
      {error && <Notice tone="error" title={t(error === "needName" ? "errors.needName" : error === "notAllowed" ? "errors.notAllowed" : "errors.failed")} />}
      {disconnected && <Notice tone="warn" title={t("disconnected")}>{t("disconnectedBody")}</Notice>}

      {!disconnected && (
        <section className="grid gap-3 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border">
          <h2 className="font-semibold">{t("finishTitle")}</h2>
          <ol className="grid list-decimal gap-1.5 ps-5 text-sm">
            <li>{t("finish1")}</li>
            <li>{t("finish2")}</li>
            <li>{t("finish3")}</li>
            <li>{t("finish4")}</li>
            <li>{t("finish5")}</li>
          </ol>
          <div className="grid gap-1.5 text-sm font-medium">
            {t("addressLabel")}
            <CopyField value={address} label={t("addressLabel")} />
            {!address.startsWith("https://") && <span className="text-xs font-normal text-muted">{t("needHttpsNote")}</span>}
          </div>
        </section>
      )}

      {canManage && !disconnected && (
        <section className="grid gap-2">
          <h2 className="font-semibold">{t("healthTitle")}</h2>
          {health === "ok" && <Notice tone="success" title={t("healthOk")}>{t("healthNote")}</Notice>}
          {health === "rejected" && <Notice tone="error" title={t("healthRejected")} />}
          {health === "unknown" && <Notice tone="warn" title={t("healthUnknown")} />}
        </section>
      )}

      <Notice tone="info" title={t("costPageTitle")}>{t("costBody")}</Notice>

      <section className="grid gap-3">
        <form action={updateLine} className="grid gap-4 sm:max-w-lg">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={ch.id} />
          <fieldset disabled={!canManage} className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              {t("nameLabel")}
              <input name="name" defaultValue={ch.name} required maxLength={80} className={field} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              {t("greeting")}
              <textarea name="greeting" rows={3} maxLength={1000} defaultValue={s.greeting ?? ""} placeholder={t("greetingPlaceholder")} className={`${field} py-2`} />
              <span className="text-xs font-normal text-muted">{t("greetingHelp")}</span>
            </label>
          </fieldset>
          {canManage && <div><Submit>{t("save")}</Submit></div>}
        </form>
      </section>

      {canManage && (
        <section className="grid gap-3">
          <h2 className="font-semibold">{t("replaceTitle")}</h2>
          <LineReplaceCredentials action={replaceLineCredentials} slug={slug} id={ch.id} reconnect={disconnected} />
        </section>
      )}

      {canManage && !disconnected && (
        <section className="grid gap-3">
          <h2 className="font-semibold">{t("disconnectTitle")}</h2>
          <p className="text-sm text-muted">{t("disconnectHelp")}</p>
          <form action={disconnectLine}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={ch.id} />
            <Submit variant="secondary">{t("disconnect")}</Submit>
          </form>
        </section>
      )}
    </SettingsFrame>
  );
}

/* An SMS number: the address to paste into Twilio, whether Twilio accepts the credentials, STOP handling and disconnecting. */
async function SmsChannel({ slug, ch, sp, workspaceId }: {
  slug: string;
  ch: { id: string; name: string; settings: unknown; status: string };
  sp: Record<string, string | string[] | undefined>;
  workspaceId: string;
}) {
  const t = await getT("smsSetup");
  const canManage = await can(workspaceId, "numbers.manage");
  const s = (ch.settings ?? {}) as { webhook_key?: string };
  const disconnected = ch.status === "disconnected";
  const error = typeof sp.error === "string" ? sp.error : null;
  const address = `${await appOrigin()}/api/webhooks/twilio/${s.webhook_key}`;
  const field = "min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 font-normal";

  // What Twilio itself says about the credentials. Only managers see it; the token is read here and never shown.
  let health: "ok" | "rejected" | "unknown" = "unknown";
  if (canManage && !disconnected) {
    const { data: secrets } = await createAdminClient().rpc("channel_secrets", { p_channel: ch.id });
    const c = secrets as { account_sid?: string; auth_token?: string } | null;
    if (c?.account_sid && c.auth_token) {
      const account = await getAccount(fetch, c.account_sid, c.auth_token);
      health = account.ok ? "ok" : account.reason === "rejected" ? "rejected" : "unknown";
    }
  }

  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspaceId, "members.manage")}>
      <Link href={`/w/${slug}/channels`} className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" /> {t("backToList")}
      </Link>
      <SectionHeader title={ch.name} description={t("pageHelp")} />
      {sp.created && <Notice tone="success" title={t("created")}>{t("createdBody")}</Notice>}
      {sp.saved && <Notice tone="success" title={t("saved")} />}
      {error && <Notice tone="error" title={t(error === "needName" ? "errors.needName" : error === "notAllowed" ? "errors.notAllowed" : "errors.failed")} />}
      {disconnected && <Notice tone="warn" title={t("disconnected")}>{t("disconnectedBody")}</Notice>}

      {!disconnected && (
        <section className="grid gap-3 rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border">
          <h2 className="font-semibold">{t("finishTitle")}</h2>
          <ol className="grid list-decimal gap-1.5 ps-5 text-sm">
            <li>{t("finish1")}</li>
            <li>{t("finish2")}</li>
            <li>{t("finish3")}</li>
            <li>{t("finish4")}</li>
          </ol>
          <div className="grid gap-1.5 text-sm font-medium">
            {t("addressLabel")}
            <CopyField value={address} label={t("addressLabel")} />
            {!address.startsWith("https://") && <span className="text-xs font-normal text-muted">{t("needHttpsNote")}</span>}
          </div>
        </section>
      )}

      {canManage && !disconnected && (
        <section className="grid gap-2">
          <h2 className="font-semibold">{t("healthTitle")}</h2>
          {health === "ok" && <Notice tone="success" title={t("healthOk")}>{t("healthNote")}</Notice>}
          {health === "rejected" && <Notice tone="error" title={t("healthRejected")} />}
          {health === "unknown" && <Notice tone="warn" title={t("healthUnknown")} />}
        </section>
      )}

      <Notice tone="info" title={t("stopTitle")}>{t("stopBody")}</Notice>
      <Notice tone="info" title={t("costTitle")}>{t("costBody")}</Notice>

      <section className="grid gap-3">
        <form action={updateSms} className="grid gap-4 sm:max-w-lg">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={ch.id} />
          <fieldset disabled={!canManage} className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              {t("nameLabel")}
              <input name="name" defaultValue={ch.name} required maxLength={80} className={field} />
            </label>
          </fieldset>
          {canManage && <div><Submit>{t("save")}</Submit></div>}
        </form>
      </section>

      {canManage && (
        <section className="grid gap-3">
          <h2 className="font-semibold">{t("replaceTitle")}</h2>
          <SmsReplaceCredentials action={replaceSmsCredentials} slug={slug} id={ch.id} reconnect={disconnected} />
        </section>
      )}

      {canManage && !disconnected && (
        <section className="grid gap-3">
          <h2 className="font-semibold">{t("disconnectTitle")}</h2>
          <p className="text-sm text-muted">{t("disconnectHelp")}</p>
          <form action={disconnectSms}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="id" value={ch.id} />
            <Submit variant="secondary">{t("disconnect")}</Submit>
          </form>
        </section>
      )}
    </SettingsFrame>
  );
}
