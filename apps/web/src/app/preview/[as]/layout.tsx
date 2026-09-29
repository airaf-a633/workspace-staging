import Link from "next/link";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "@/components/app-shell";
import { PreviewBar } from "@/components/preview/preview-bar";
import { PREVIEW_WORKSPACE, previewMembers, previewPerson } from "@/lib/preview";

export default async function PreviewApp(props: LayoutProps<"/preview/[as]">) {
  const { as } = await props.params;
  const me = previewPerson(as);

  return (
    <AppShell
      base={`/preview/${as}`}
      workspaceName={PREVIEW_WORKSPACE.name}
      memberName={me.name}
      roleName={me.role}
      banner={<PreviewBar current={as} people={previewMembers().map(({ key, name, role }) => ({ key, name, role }))} />}
      footer={
        <Link href="/" className="flex min-h-11 items-center gap-2 text-sm text-muted hover:text-text">
          <SignOut size={20} aria-hidden="true" /> Leave the preview
        </Link>
      }
    >
      {props.children}
    </AppShell>
  );
}
