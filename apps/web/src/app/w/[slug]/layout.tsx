import { AppShell } from "@/components/app-shell";
import { CurrencyProvider } from "@/i18n/client";
import { loadNotices } from "@/lib/notices-live";
import { requestNow } from "@/lib/now";
import { can, loadWorkspace, scopeOf } from "@/lib/workspace";
import { signOut } from "../../(auth)/actions";
import { markNoticesRead } from "./notifications-actions";

export default async function WorkspaceLayout(props: LayoutProps<"/w/[slug]">) {
  const { slug } = await props.params;
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const role = Array.isArray(me.roles) ? me.roles[0] : me.roles;
  const [notices, reports, campaignsManage, campaignsApprove, cannedUse] = await Promise.all([
    loadNotices(supabase, workspace.id, `/w/${slug}`),
    can(workspace.id, "reports.view"),
    scopeOf(workspace.id, "campaigns.manage"),
    scopeOf(workspace.id, "campaigns.send_imported"),
    scopeOf(workspace.id, "canned.use"),
  ]);

  return (
    <AppShell
      base={`/w/${slug}`}
      workspaceName={workspace.name}
      memberName={me.display_name}
      roleName={role?.name ?? ""}
      signOut={signOut}
      reports={reports}
      campaigns={campaignsManage !== "none" || campaignsApprove === "all"}
      help={cannedUse !== "none"}
      notifications={notices}
      now={requestNow()}
      noticesLive={{ workspaceId: workspace.id, memberId: me.id, read: markNoticesRead.bind(null, slug) }}
    >
      <CurrencyProvider currency={workspace.currency ?? "USD"}>{props.children}</CurrencyProvider>
    </AppShell>
  );
}
