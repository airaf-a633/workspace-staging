import { Badge, Notice } from "@/components/ui/surface";
import { ListSurface, SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { GetReady } from "@/components/whatsapp/get-ready";
import { Submit } from "@/components/ui/submit";
import { TextInput } from "@/components/ui/field";
import { errorText } from "@/i18n/labels";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";
import { connectTestNumber } from "./actions";

export async function generateMetadata() {
  return { title: (await getT("settings"))("whatsapp") };
}

const TONE = { connected: "done", connecting: "warn", disconnected: "fail" } as const;

/*
 * Real numbers (M2.2). Until Meta approves our platform, owners connect Meta's test number with the form
 * below; the get-ready checklist stays underneath for their real number (decided 2026-10-02).
 */
export default async function WhatsAppNumbers(props: PageProps<"/w/[slug]/whatsapp">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const { supabase, workspace } = await loadWorkspace(slug);
  const isOwner = await can(workspace.id, "numbers.manage");
  const t = await getT("numbers");
  const tAll = await getT();
  const { data: accounts } = await supabase
    .from("whatsapp_accounts")
    .select("id, display_phone, verified_name, quality_rating, is_test, channels(status, teams(name))")
    .eq("workspace_id", workspace.id)
    .order("created_at");
  const error = errorText(tAll, "numbers", sp.error);

  return (
    <SettingsFrame base={`/w/${slug}`} active="channels" isOwner={await can(workspace.id, "members.manage")}>
      <SectionHeader title={t("title")} description={isOwner ? t("descriptionBefore") : t("ownerOnly")} />
      {error && <Notice tone="error" title={error} />}
      {sp.connected && <Notice tone="success" title={t("connectedTitle")}>{t("connectedBody")}</Notice>}

      {accounts && accounts.length > 0 && (
        <ListSurface>
          {accounts.map((a) => {
            const channel = (Array.isArray(a.channels) ? a.channels[0] : a.channels) as unknown as { status: string; teams: { name: string } | null } | null;
            const team = channel?.teams;
            const status = channel?.status ?? "connecting";
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4 last:border-0">
                <span className="bg-primary grid size-10 shrink-0 place-items-center rounded-full font-semibold text-lg text-white" aria-hidden="true">
                  {(a.verified_name ?? a.display_phone).charAt(0)}
                </span>
                <span className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {a.verified_name ?? a.display_phone}
                    <Badge tone={TONE[status as keyof typeof TONE] ?? "warn"}>{t(`status.${status === "connecting" ? "attention" : (status as "connected" | "disconnected")}`)}</Badge>
                    {a.is_test && <Badge tone="transit">{t("testBadge")}</Badge>}
                  </span>
                  <span className="text-sm text-muted">
                    <span dir="ltr" className="tabular-nums">{a.display_phone}</span>
                    {team?.name && <> · {team.name}</>}
                    {a.quality_rating && <> · {t("qualityIs", { quality: a.quality_rating.toLowerCase() })}</>}
                  </span>
                </span>
              </li>
            );
          })}
        </ListSurface>
      )}

      {isOwner && (
        <details className="group rounded-[var(--radius-panel)] bg-surface p-5 shadow-[var(--shadow-1)] ring-1 ring-border" open={!accounts?.length}>
          <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">{t("test.title")}</summary>
          <p className="mt-2 text-sm text-muted">{t("test.body")}</p>
          <form action={connectTestNumber} className="mt-4 grid gap-4 sm:max-w-lg">
            <input type="hidden" name="slug" value={slug} />
            <TextInput label={t("test.phoneNumberId")} name="phoneNumberId" inputMode="numeric" dir="ltr" autoComplete="off" required />
            <TextInput label={t("test.wabaId")} name="wabaId" inputMode="numeric" dir="ltr" autoComplete="off" required />
            <TextInput label={t("test.token")} name="token" type="password" dir="ltr" autoComplete="off" help={t("test.tokenHelp")} required />
            <Submit pending={t("test.checking")}>{t("test.submit")}</Submit>
          </form>
        </details>
      )}

      <GetReady teamsHref={`/w/${slug}/teams`} />
    </SettingsFrame>
  );
}
