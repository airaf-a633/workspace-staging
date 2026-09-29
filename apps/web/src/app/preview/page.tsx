import Link from "next/link";
import { ArrowRight, ChatsCircle, House, Gear, UserPlus } from "@phosphor-icons/react/dist/ssr";
import { PREVIEW_PEOPLE, previewMembers } from "@/lib/preview";

export const metadata = { title: { absolute: "Preview the app · Workspace" } };

export default function PreviewIndex() {
  const members = previewMembers();
  return (
    <main className="min-h-dvh">
      <section className="bg-hero drift rounded-b-[2.5rem] text-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-20 pt-10">
          <Link href="/" className="font-serif text-2xl tracking-tight">Workspace</Link>
          <div className="grid max-w-3xl gap-5 pt-10">
            <h1 className="display text-5xl sm:text-6xl">Walk through the app</h1>
            <p className="text-lg text-white/85">
              A sample electronics business with two shops in Dubai. Pick someone to see the app as they would: their home, their inbox, and what their role lets them do. Nothing you do here is saved.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-14">
        <h2 className="text-lg font-semibold">View as</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PREVIEW_PEOPLE.map((p) => {
            const m = members.find((x) => x.key === p.key)!;
            return (
              <li key={p.key}>
                <div className="grid h-full content-start gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-[var(--shadow-1)]">
                  <div className="flex items-center gap-3">
                    <span className="bg-hero grid size-12 place-items-center rounded-full font-serif text-xl text-white" aria-hidden="true">{p.name[0]}</span>
                    <div>
                      <p className="title text-2xl">{p.name}</p>
                      <p className="text-sm text-muted">{m.role}</p>
                    </div>
                  </div>
                  <p className="text-muted">{p.sees}</p>
                  <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
                    <Link href={`/preview/${p.key}`} className="inline-flex min-h-11 items-center gap-1.5 text-primary hover:underline"><House size={18} aria-hidden="true" />Home</Link>
                    <Link href={`/preview/${p.key}/inbox`} className="inline-flex min-h-11 items-center gap-1.5 text-primary hover:underline"><ChatsCircle size={18} aria-hidden="true" />Inbox</Link>
                    <Link href={`/preview/${p.key}/settings`} className="inline-flex min-h-11 items-center gap-1.5 text-primary hover:underline"><Gear size={18} aria-hidden="true" />Settings</Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-6 text-lg font-semibold">Getting started</h2>
        <Link href="/preview/sign-up" className="group flex items-center gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-6 transition-colors hover:bg-surface-2">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><UserPlus size={24} aria-hidden="true" /></span>
          <span className="grid flex-1 gap-0.5">
            <span className="font-semibold">Sign up and set up a business</span>
            <span className="text-sm text-muted">Create an account, answer the team question, and see the setup checklist it shapes.</span>
          </span>
          <ArrowRight size={20} className="text-muted transition-transform group-hover:translate-x-1 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
