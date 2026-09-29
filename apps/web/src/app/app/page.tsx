import Link from "next/link";
import { redirect } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { AuthFrame } from "@/components/auth-frame";
import { Submit } from "@/components/ui/submit";
import { TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { createClient, getUser } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { createWorkspace } from "./actions";

export const metadata = { title: "Your workspaces" };

export default async function AppHome(props: PageProps<"/app">) {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/app");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const { data: workspaces } = await supabase.from("workspaces").select("id, name, slug").order("name");

  if (workspaces && workspaces.length === 1 && !sp.error && !sp.new) redirect(`/w/${workspaces[0]!.slug}`);
  const hasAny = !!workspaces?.length;

  return (
    <AuthFrame
      title={hasAny ? "Choose a workspace" : "Set up your business"}
      description={hasAny ? undefined : "Start with your business name. You can change it later."}
      footer={<form action={signOut}><button type="submit" className="min-h-11 text-muted underline-offset-4 hover:underline">Sign out</button></form>}
    >
      {typeof sp.error === "string" && <Notice tone="error" title={sp.error} />}
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
        <TextInput label="Business name" name="name" placeholder="e.g. Qamar Electronics" required />
        {!hasAny && (
          <fieldset className="grid gap-1">
            <legend className="text-sm font-medium">What does your team look like? <span className="font-normal text-muted">(optional)</span></legend>
            <p className="text-sm text-muted">We&apos;ll tailor your setup steps. You can change this later.</p>
            <div className="mt-1 grid gap-2">
              {[
                ["solo", "Just me", "I handle customers myself"],
                ["small", "A small team", "2 to 5 people sharing the work"],
                ["split", "Separate sales and support", "Different people for new customers and existing ones"],
                ["delivery", "We also deliver orders", "Our own riders or drivers take orders to customers"],
              ].map(([value, title, hint]) => (
                <label key={value} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                  <input type="radio" name="teamShape" value={value} className="mt-1 size-5 accent-[var(--primary)]" />
                  <span className="grid">
                    <span className="font-medium">{title}</span>
                    <span className="text-sm text-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <Submit variant={hasAny ? "secondary" : "primary"} pending="Creating…">{hasAny ? "Create another workspace" : "Create workspace"}</Submit>
      </form>
    </AuthFrame>
  );
}
