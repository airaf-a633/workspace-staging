import Link from "next/link";
import { CaretRight, ChatsCircle, IdentificationBadge, ShieldCheck, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/surface";
import { can, loadWorkspace } from "@/lib/workspace";

export default async function Settings(props: PageProps<"/w/[slug]/settings">) {
  const { slug } = await props.params;
  const { workspace } = await loadWorkspace(slug);
  const isOwner = await can(workspace.id, "members.manage");

  const groups = [
    { href: `/w/${slug}/members`, Icon: UsersThree, title: "Team members", body: "Invite people, change roles, remove access." },
    { href: `/w/${slug}/teams`, Icon: IdentificationBadge, title: "Teams and branches", body: "Group people by team or location." },
    ...(isOwner ? [{ href: `/w/${slug}/roles`, Icon: ShieldCheck, title: "Roles and permissions", body: "What each role can see and do." }] : []),
  ];

  return (
    <>
      <PageHeader title="Settings" />
      <ul className="grid gap-3">
        {groups.map(({ href, Icon, title, body }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-4 hover:bg-surface-2">
              <Icon size={28} className="shrink-0 text-primary" aria-hidden="true" />
              <span className="grid flex-1 gap-0.5">
                <span className="font-semibold">{title}</span>
                <span className="text-sm text-muted">{body}</span>
              </span>
              <CaretRight size={20} className="shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-4 rounded-[var(--radius-panel)] border border-dashed border-border p-4">
          <ChatsCircle size={28} className="shrink-0 text-muted" aria-hidden="true" />
          <span className="grid gap-0.5">
            <span className="font-semibold">WhatsApp numbers</span>
            <span className="text-sm text-muted">Available when the inbox launches.</span>
          </span>
        </li>
      </ul>
    </>
  );
}
