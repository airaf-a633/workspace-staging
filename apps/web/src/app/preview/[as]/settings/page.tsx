import Link from "next/link";
import { CaretRight, ChatsCircle, IdentificationBadge, ShieldCheck, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/ui/surface";
import { previewScope } from "@/lib/preview";

export const metadata = { title: "Settings" };

export default async function PreviewSettings(props: PageProps<"/preview/[as]/settings">) {
  const { as } = await props.params;
  const base = `/preview/${as}`;
  const isOwner = previewScope(as, "members.manage") !== "none";

  const groups = [
    { href: `${base}/members`, Icon: UsersThree, title: "Team members", body: "Invite people, change roles, remove access." },
    { href: `${base}/teams`, Icon: IdentificationBadge, title: "Teams and branches", body: "Group people by team or location." },
    ...(isOwner ? [{ href: `${base}/roles`, Icon: ShieldCheck, title: "Roles and permissions", body: "What each role can see and do." }] : []),
  ];

  return (
    <>
      <PageHeader title="Settings" />
      <ul className="grid gap-3">
        {groups.map(({ href, Icon, title, body }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-5 transition-colors hover:bg-surface-2">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><Icon size={24} aria-hidden="true" /></span>
              <span className="grid flex-1 gap-0.5">
                <span className="font-semibold">{title}</span>
                <span className="text-sm text-muted">{body}</span>
              </span>
              <CaretRight size={20} className="shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-4 rounded-[var(--radius-panel)] border border-dashed border-border p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-muted"><ChatsCircle size={24} aria-hidden="true" /></span>
          <span className="grid gap-0.5">
            <span className="font-semibold">WhatsApp numbers</span>
            <span className="text-sm text-muted">Available when the inbox launches.</span>
          </span>
        </li>
      </ul>
    </>
  );
}
