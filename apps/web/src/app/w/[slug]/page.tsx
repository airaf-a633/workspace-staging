import { Page } from "@/components/plain";
import { loadWorkspace } from "@/lib/workspace";

export default async function WorkspaceHome(props: PageProps<"/w/[slug]">) {
  const { slug } = await props.params;
  const { workspace, me } = await loadWorkspace(slug);
  return (
    <Page title={`Hello, ${me.display_name}`}>
      <p>
        This is the {workspace.name} workspace. The inbox arrives in M2 and the CRM in M3; manager homes follow in M5.
      </p>
    </Page>
  );
}
