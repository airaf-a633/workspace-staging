import { SectionHeader, SettingsFrame, ListSurface } from "@/components/settings-frame";
import { SetupChecklist } from "@/components/setup-checklist";
import { PREVIEW_WORKSPACE, previewMembers, previewScope } from "@/lib/preview";
import { setupSteps } from "@/lib/setup";

export const metadata = { title: "Account" };

const LATER = [
  ["Billing and plan", "Your plan, seats and invoices."],
  ["Security", "Two-step sign-in and active sessions."],
  ["Data", "Export, erasure and how long chats are kept."],
  ["Your preferences", "Language and light or dark theme."],
];

export default async function PreviewAccount(props: PageProps<"/preview/[as]/account">) {
  const { as } = await props.params;
  const isOwner = previewScope(as, "members.manage") !== "none";
  const base = `/preview/${as}`;
  // The sample business has connected WhatsApp and invited its team.
  const steps = setupSteps({ shape: "split", memberCount: previewMembers().length, connected: true, base });

  return (
    <SettingsFrame base={base} active="account" isOwner={isOwner}>
      <SectionHeader title="Account" description={`Settings for ${PREVIEW_WORKSPACE.name} and for you.`} />
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
