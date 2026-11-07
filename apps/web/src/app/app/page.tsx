import Link from "next/link";
import { redirect } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { AuthFrame } from "@/components/auth-frame";
import { TeamShapeField } from "@/components/team-shape-field";
import { Submit } from "@/components/ui/submit";
import { TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { createWorkspace } from "./actions";

export async function generateMetadata() {
  return { title: (await getT("onboarding"))("chooseTitle") };
}

export default async function AppHome(props: PageProps<"/app">) {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/app");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: workspaces } = await supabase.from("workspaces").select("id, name, slug").order("name");
  const t = await getT("onboarding");
  const nav = await getT("nav");

  if (workspaces && workspaces.length === 1 && !sp.error && !sp.new) redirect(`/w/${workspaces[0]!.slug}`);
  const hasAny = !!workspaces?.length;
  const error = sp.error === "needName" || sp.error === "createFailed" ? t(`errors.${sp.error}`) : sp.error ? t("errors.createFailed") : null;

  return (
    <AuthFrame
      title={hasAny ? t("chooseTitle") : t("title")}
      description={hasAny ? undefined : t("description")}
      footer={<form action={signOut}><button type="submit" className="min-h-11 text-muted underline-offset-4 hover:underline">{nav("signOut")}</button></form>}
    >
      {error && <Notice tone="error" title={error} />}
      {hasAny && (
        <ul className="grid gap-2">
          {workspaces!.map((w) => (
            <li key={w.id}>
              <Link href={`/w/${w.slug}`} className="flex min-h-12 items-center justify-between rounded-[var(--radius-control)] border border-border px-4 hover:bg-surface-2">
                <span className="font-medium">{w.name}</span>
                <CaretRight size={20} className="text-muted rtl:rotate-180" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <form action={createWorkspace} className={`grid gap-4 ${hasAny ? "border-t border-border pt-5" : ""}`}>
        <TextInput label={t("businessName")} name="name" placeholder={t("businessPlaceholder")} required />
        {!hasAny && <TeamShapeField />}
        <Submit variant={hasAny ? "secondary" : "primary"} pending={t("creating")}>{hasAny ? t("createAnother") : t("create")}</Submit>
      </form>
    </AuthFrame>
  );
}
