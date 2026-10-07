import Link from "next/link";
import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { AppShell } from "@/components/app-shell";
import { PreviewBar } from "@/components/preview/preview-bar";
import { roleLabel } from "@/i18n/labels";
import { getT, getTimeZone } from "@/i18n/server";
import { PREVIEW_WORKSPACE, previewMembers, previewPerson, previewScope } from "@/lib/preview";
import { previewAiWorld } from "@/lib/ai-sample";

export default async function PreviewApp(props: LayoutProps<"/preview/[as]">) {
  const { as } = await props.params;
  const tz = await getTimeZone();
  const me = previewPerson(as);
  const tAll = await getT();
  const t = await getT("preview");

  return (
    <AppShell
      base={`/preview/${as}`}
      workspaceName={PREVIEW_WORKSPACE.name}
      memberName={me.name}
      roleName={roleLabel(tAll, me.role)}
      ai={previewAiWorld(as, tz)}
      reports={previewScope(as, "reports.view") !== "none"}
      help={previewScope(as, "canned.use") !== "none"}
      banner={<PreviewBar current={as} people={previewMembers().map(({ key, name, role }) => ({ key, name, role: roleLabel(tAll, role) }))} />}
      footer={
        <Link href="/" className="flex min-h-11 items-center gap-2 text-sm text-muted hover:text-text">
          <SignOut size={20} aria-hidden="true" /> {t("leave")}
        </Link>
      }
    >
      {props.children}
    </AppShell>
  );
}
