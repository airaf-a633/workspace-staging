import Link from "next/link";
import { CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";
import { Card, PageHeader } from "@/components/ui/surface";
import { loadWorkspace } from "@/lib/workspace";

/* The five-step setup checklist (PRODUCT_DECISIONS §14). Every step is skippable; unfinished features say when they arrive. */
export default async function WorkspaceHome(props: PageProps<"/w/[slug]">) {
  const { slug } = await props.params;
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const { count: memberCount } = await supabase.from("members").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "active");
  const firstName = me.display_name.split(" ")[0];

  const steps = [
    { title: "Connect WhatsApp", body: "Link your business number and keep using the WhatsApp app on your phone.", done: false, href: null, soon: "Available when the inbox launches" },
    { title: "Invite your team", body: "Add managers and agents, and choose what each can see.", done: (memberCount ?? 0) > 1, href: `/w/${slug}/members`, soon: null },
    { title: "Set working hours", body: "So customers get an out-of-hours reply and reply targets are fair.", done: false, href: null, soon: "Coming soon" },
    { title: "Import your customers", body: "Upload a spreadsheet or bring contacts from your phone.", done: false, href: null, soon: "Coming soon" },
    { title: "Connect your store and email", body: "Shopify or WooCommerce orders and Outlook or Gmail, next to every chat.", done: false, href: null, soon: "Coming soon" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <>
      <PageHeader title={`Welcome, ${firstName}`} description={`This is ${workspace.name}. Here's what's left to set up.`} />
      <Card title="Get set up" description={`${doneCount} of ${steps.length} done. Skip anything you don't need; you can come back any time.`}>
        <ol className="grid gap-2">
          {steps.map((s) => {
            const Icon = s.done ? CheckCircle : Circle;
            const inner = (
              <div className="flex items-start gap-3">
                <Icon size={24} weight={s.done ? "fill" : "regular"} className={`mt-0.5 shrink-0 ${s.done ? "text-done" : "text-muted"}`} aria-hidden="true" />
                <div className="grid gap-0.5">
                  <p className={`font-medium ${s.done ? "text-muted line-through" : ""}`}>
                    {s.title}
                    <span className="sr-only">{s.done ? " (done)" : ""}</span>
                  </p>
                  <p className="text-sm text-muted">{s.body}</p>
                  {s.soon && !s.done && <p className="text-sm text-muted italic">{s.soon}</p>}
                </div>
              </div>
            );
            return (
              <li key={s.title}>
                {s.href && !s.done ? (
                  <Link href={s.href} className="block rounded-[var(--radius-control)] p-3 hover:bg-surface-2">{inner}</Link>
                ) : (
                  <div className="p-3">{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      </Card>
    </>
  );
}
