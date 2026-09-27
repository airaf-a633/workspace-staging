import Link from "next/link";
import { loadWorkspace } from "@/lib/workspace";
import { signOut } from "../../(auth)/actions";

export default async function WorkspaceLayout(props: LayoutProps<"/w/[slug]">) {
  const { slug } = await props.params;
  const { workspace, me } = await loadWorkspace(slug);
  const role = Array.isArray(me.roles) ? me.roles[0] : me.roles;

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-3">
        <nav className="flex gap-4" aria-label="Workspace">
          <Link className="font-semibold" href={`/w/${slug}`}>{workspace.name}</Link>
          <Link className="underline" href={`/w/${slug}/members`}>Team</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span>{me.display_name}, {role?.name}</span>
          <form action={signOut}>
            <button type="submit" className="underline">Sign out</button>
          </form>
        </div>
      </header>
      {props.children}
    </div>
  );
}
