import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { WebchatForm } from "@/components/channels/webchat-form";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { publicEnv } from "@/lib/public-env";
import { can, loadWorkspace } from "@/lib/workspace";
import { updateWebchat } from "../webchat-actions";

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
