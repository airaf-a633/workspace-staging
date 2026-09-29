import Link from "next/link";
import { CaretRight, CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";
import { ListSurface } from "@/components/settings-frame";
import { loadWorkspace } from "@/lib/workspace";

/*
 * Home before WhatsApp connects: the five-step setup checklist (PRODUCT_DECISIONS §14).
 * Once a number is connected (M2.8), Home becomes the manager home (components/home/manager-home.tsx)
 * and unfinished setup shrinks to a "Setup 3 of 5" link at the top (decided 2026-09-30).
 */
export default async function WorkspaceHome(props: PageProps<"/w/[slug]">) {
  const { slug } = await props.params;
  const { supabase, workspace, me } = await loadWorkspace(slug);
  const { data: ws } = await supabase.from("workspaces").select("team_shape").eq("id", workspace.id).single();
  const shape = ws?.team_shape as "solo" | "small" | "split" | "delivery" | null;
  const { count: memberCount } = await supabase.from("members").select("id", { count: "exact", head: true }).eq("workspace_id", workspace.id).eq("status", "active");
  const firstName = me.display_name.split(" ")[0];

  const steps = [
    { title: "Connect WhatsApp", body: "Link your business number and keep using the WhatsApp app on your phone.", done: false, href: null, soon: "Opens as soon as Meta approves our platform. We'll email you. Your trial starts then." },
    {
      title: shape === "solo" ? "Invite your team (optional)" : "Invite your team",
      body:
        shape === "solo" ? "Skip this if it's just you. You can add people any time."
        : shape === "split" ? "Add your sales and support managers, then put each in their own team."
        : "Add managers and agents, and choose what each can see.",
      done: (memberCount ?? 0) > 1,
      href: `/w/${slug}/members?invite=1`,
      soon: null,
    },
    { title: "Set working hours", body: "So customers get an out-of-hours reply and reply targets are fair.", done: false, href: null, soon: "Coming soon" },
    { title: "Import your customers", body: "Upload a spreadsheet or bring contacts from your phone.", done: false, href: null, soon: "Coming soon" },
    { title: "Connect your store and email", body: "Shopify or WooCommerce orders and Outlook or Gmail, next to every chat.", done: false, href: null, soon: "Coming soon" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <>
      <header className="grid gap-2">
        <h1 className="display text-4xl sm:text-5xl">Welcome, {firstName}</h1>
        <p className="text-muted">Let&apos;s get {workspace.name} ready. Skip anything you don&apos;t need; you can come back any time.</p>
      </header>

      <section aria-labelledby="setup" className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="setup" className="text-lg font-semibold">Get set up</h2>
          <span className="flex items-center gap-3 text-sm text-muted">
            {doneCount} of {steps.length} done
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </span>
          </span>
        </div>
        <ListSurface>
          {steps.map((s) => {
            const Icon = s.done ? CheckCircle : Circle;
            const inner = (
              <>
                <Icon size={22} weight={s.done ? "fill" : "regular"} className={`mt-0.5 shrink-0 ${s.done ? "text-done" : "text-muted"}`} aria-hidden="true" />
                <span className="grid flex-1 gap-0.5">
                  <span className={`font-medium ${s.done ? "text-muted line-through" : ""}`}>
                    {s.title}
                    <span className="sr-only">{s.done ? " (done)" : ""}</span>
                  </span>
                  <span className="text-sm text-muted">{s.body}</span>
                  {s.soon && !s.done && <span className="text-xs text-muted">{s.soon}</span>}
                </span>
              </>
            );
            return (
              <li key={s.title} className="border-b border-border last:border-0">
                {s.href && !s.done ? (
                  <Link href={s.href} className="group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-2">
                    {inner}
                    <CaretRight size={18} className="mt-1 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-5 py-4">{inner}</div>
                )}
              </li>
            );
          })}
        </ListSurface>
      </section>

      {shape === "delivery" && (
        <p className="rounded-[var(--radius-panel)] bg-surface-2 p-4 text-sm">
          <strong className="font-medium">Orders &amp; Delivery.</strong> You said you deliver orders. This add-on handles dispatch, a rider page and end-of-day cash. It becomes available after launch.
        </p>
      )}
    </>
  );
}
