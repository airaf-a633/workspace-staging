import { AccountPage } from "@/components/account-page";
import { getT } from "@/i18n/server";
import { can, loadWorkspace } from "@/lib/workspace";
import { setupSteps, type TeamShape } from "@/lib/setup";

export async function generateMetadata() {
  return { title: (await getT("account"))("title") };
}

export default async function Account(props: PageProps<"/w/[slug]/account">) {
  const { slug } = await props.params;
  const { supabase, workspace } = await loadWorkspace(slug);
  const isOwner = await can(workspace.id, "members.manage");
  const { data: ws } = await supabase.from("workspaces").select("team_shape").eq("id", workspace.id).single();
  const { count } = await supabase.from("members").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "active");
  const steps = setupSteps(await getT("setup"), await getT("common"), { shape: (ws?.team_shape ?? null) as TeamShape, memberCount: count ?? 0, connected: false, base: `/w/${slug}` });
  return <AccountPage base={`/w/${slug}`} workspaceName={workspace.name} isOwner={isOwner} steps={steps} saveLanguageToProfile />;
}
