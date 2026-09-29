import { SetupChecklist } from "@/components/setup-checklist";
import { loadWorkspace } from "@/lib/workspace";
import { setupSteps, type TeamShape } from "@/lib/setup";

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
  const steps = setupSteps({ shape, memberCount: memberCount ?? 0, connected: false, base: `/w/${slug}` });

  return (
    <>
      <header className="grid gap-2">
        <h1 className="display text-4xl sm:text-5xl">Welcome, {firstName}</h1>
        <p className="text-muted">Let&apos;s get {workspace.name} ready. Skip anything you don&apos;t need; you can come back any time.</p>
      </header>
      <SetupChecklist steps={steps} />
      {shape === "delivery" && (
        <p className="rounded-[var(--radius-panel)] bg-surface-2 p-4 text-sm">
          <strong className="font-medium">Orders &amp; Delivery.</strong> You said you deliver orders. This add-on handles dispatch, a rider page and end-of-day cash. It becomes available after launch.
        </p>
      )}
    </>
  );
}
