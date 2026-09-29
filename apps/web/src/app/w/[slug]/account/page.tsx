import { SectionHeader, SettingsFrame, ListSurface } from "@/components/settings-frame";
import { SetupChecklist } from "@/components/setup-checklist";
import { can, loadWorkspace } from "@/lib/workspace";
import { setupSteps, type TeamShape } from "@/lib/setup";

export const metadata = { title: "Account" };

const LATER = [
  ["Billing and plan", "Your plan, seats and invoices."],
  ["Security", "Two-step sign-in and active sessions."],
  ["Data", "Export, erasure and how long chats are kept."],
  ["Your preferences", "Language and light or dark theme."],
];

export default async function Account(props: PageProps<"/w/[slug]/account">) {
  const { slug } = await props.params;
  const { supabase, workspace } = await loadWorkspace(slug);
  const isOwner = await can(workspace.id, "members.manage");
  const { data: ws } = await supabase.from("workspaces").select("team_shape").eq("id", workspace.id).single();
  const { count } = await supabase.from("members").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "active");
  const steps = setupSteps({ shape: (ws?.team_shape ?? null) as TeamShape, memberCount: count ?? 0, connected: false, base: `/w/${slug}` });

  return (
    <SettingsFrame base={`/w/${slug}`} active="account" isOwner={isOwner}>
      <SectionHeader title="Account" description={`Settings for ${workspace.name} and for you.`} />
      {isOwner && <SetupChecklist steps={steps} title="Setup checklist" />}
      <ListSurface>
        {LATER.map(([t, d]) => (
          <li key={t} className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 last:border-0">
            <span className="grid"><span className="font-medium">{t}</span><span className="text-sm text-muted">{d}</span></span>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">Soon</span>
          </li>
        ))}
      </ListSurface>
    </SettingsFrame>
  );
}
