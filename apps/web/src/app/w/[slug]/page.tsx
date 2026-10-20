import { SetupChecklist } from "@/components/setup-checklist";
import { loadWorkspace } from "@/lib/workspace";
import { setupSteps, type TeamShape } from "@/lib/setup";
import { getT } from "@/i18n/server";

/*
 * Home before WhatsApp connects: the five-step setup checklist (PRODUCT_DECISIONS §14).
 * Once a number is connected (M2.8), Home becomes the manager home (components/home/manager-home.tsx)
 * and unfinished setup shrinks to a dismissable "Setup 3 of 5" chip (decided 2026-09-30).
 */
export default async function WorkspaceHome(props: PageProps<"/w/[slug]">) {
  const { slug } = await props.params;
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const { data: ws } = await supabase.from("workspaces").select("team_shape").eq("id", workspace.id).single();
  const shape = (ws?.team_shape ?? null) as TeamShape;
  const { count: memberCount } = await supabase.from("members").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "active");
  const firstName = me.display_name.split(" ")[0];
  const t = await getT("home");
  const steps = setupSteps(await getT("setup"), await getT("common"), { shape, memberCount: memberCount ?? 0, connected: false, base: `/w/${slug}` });

  return (
    <>
      <header className="grid gap-2">
        <h1 className="display text-4xl sm:text-5xl">{t("welcome", { name: firstName })}</h1>
        <p className="text-muted">{t("welcomeBody", { workspace: workspace.name })}</p>
      </header>
      <SetupChecklist steps={steps} />
      {shape === "delivery" && (
        <p className="rounded-[var(--radius-panel)] bg-surface-2 p-4 text-sm">
          {t.rich("deliveryNote", { title: <strong className="font-medium">{t("deliveryTitle")}</strong> })}
        </p>
      )}
    </>
  );
}
