import Link from "next/link";
import { redirect } from "next/navigation";
import { Field, Notice, Page, Submit } from "@/components/plain";
import { createClient, getUser } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { createWorkspace } from "./actions";

export default async function AppHome(props: PageProps<"/app">) {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/app");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: workspaces } = await supabase.from("workspaces").select("id, name, slug").order("name");

  if (workspaces && workspaces.length === 1 && !sp.error) redirect(`/w/${workspaces[0]!.slug}`);

  return (
    <Page title={workspaces?.length ? "Your workspaces" : "Set up your business"}>
      {typeof sp.error === "string" && <Notice tone="error">{sp.error}</Notice>}
      {workspaces && workspaces.length > 0 && (
        <ul className="grid gap-2">
          {workspaces.map((w) => (
            <li key={w.id}>
              <Link className="underline" href={`/w/${w.slug}`}>{w.name}</Link>
            </li>
          ))}
        </ul>
      )}
      <form action={createWorkspace} className="grid gap-4">
        <Field label="Business name" name="name" required />
        <Submit>{workspaces?.length ? "Create another workspace" : "Create workspace"}</Submit>
      </form>
      <form action={signOut}>
        <Submit variant="secondary">Sign out</Submit>
      </form>
    </Page>
  );
}
