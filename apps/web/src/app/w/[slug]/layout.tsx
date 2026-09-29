import { AppShell } from "@/components/app-shell";
import { loadWorkspace } from "@/lib/workspace";
import { signOut } from "../../(auth)/actions";

export default async function WorkspaceLayout(props: LayoutProps<"/w/[slug]">) {
  const { slug } = await props.params;
  const { workspace, me } = await loadWorkspace(slug);
  const role = Array.isArray(me.roles) ? me.roles[0] : me.roles;

  return (
    <AppShell slug={slug} workspaceName={workspace.name} memberName={me.display_name} roleName={role?.name ?? ""} signOut={signOut}>
      {props.children}
    </AppShell>
  );
}
