"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ChatsCircle, CheckSquare, Gear, House, Handshake, SignOut, UsersThree } from "@phosphor-icons/react";

interface Props {
  /** Where the app lives: `/w/<slug>` for real workspaces, `/preview/<person>` for the design preview. */
  base: string;
  workspaceName: string;
  memberName: string;
  roleName: string;
  /** Real workspaces sign out; the preview passes its own footer instead. */
  signOut?: () => Promise<void>;
  footer?: ReactNode;
  /** A bar above every screen (the preview's "Viewing as" switch). */
  banner?: ReactNode;
  children: ReactNode;
}

/* Five to six destinations, each with an icon AND a label. Nothing is icon-only. */
function navItems(base: string) {
  return [
    { href: base, label: "Home", Icon: House, match: (p: string) => p === base },
    { href: `${base}/inbox`, label: "Inbox", Icon: ChatsCircle, match: (p: string) => p.startsWith(`${base}/inbox`) },
    { href: `${base}/customers`, label: "Customers", Icon: UsersThree, match: (p: string) => p.startsWith(`${base}/customers`) },
    { href: `${base}/deals`, label: "Deals", Icon: Handshake, match: (p: string) => p.startsWith(`${base}/deals`) },
    { href: `${base}/tasks`, label: "Tasks", Icon: CheckSquare, match: (p: string) => p.startsWith(`${base}/tasks`) },
    {
      href: `${base}/settings`,
      label: "Settings",
      Icon: Gear,
      match: (p: string) => ["settings", "members", "teams", "roles", "whatsapp", "account"].some((s) => p.startsWith(`${base}/${s}`)),
    },
  ];
}

export function AppShell({ base, workspaceName, memberName, roleName, signOut, footer, banner, children }: Props) {
  const path = usePathname();
  const items = navItems(base);
  // Phones get the five most-used destinations; Tasks is reachable from Home.
  const mobile = items.filter((i) => i.label !== "Tasks");
  // Work screens with their own panes (the inbox) fill the window instead of sitting in a page column.
  const fullBleed = path.startsWith(`${base}/inbox`);
  const rail = fullBleed;
  const initial = workspaceName.trim().charAt(0).toUpperCase();

  return (
    <div className={`min-h-dvh lg:grid ${rail ? "lg:grid-cols-[64px_1fr]" : "lg:grid-cols-[256px_1fr]"}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:p-3">
        Skip to content
      </a>

      {/* Desktop side menu. In the Inbox it shrinks to an icon rail so the conversation gets the room (decided 2026-09-30). */}
      <aside className="hidden border-e border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col" aria-label="Main">
        <div className={`flex items-center gap-3 ${rail ? "h-14 justify-center" : "px-5 py-5"}`}>
          <span className="bg-hero grid size-9 shrink-0 place-items-center rounded-full font-serif text-lg text-white" aria-hidden={!rail} title={rail ? workspaceName : undefined}>
            {initial}
          </span>
          {rail ? <span className="sr-only">{workspaceName}</span> : <p className="title truncate text-lg" title={workspaceName}>{workspaceName}</p>}
        </div>
        <nav className={`grid gap-1 ${rail ? "justify-items-center px-2 pt-2" : "px-3"}`}>
          {items.map(({ href, label, Icon, match }) => {
            const active = match(path);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                title={rail ? label : undefined}
                className={`flex min-h-11 items-center rounded-full text-base transition-colors ${rail ? "w-11 justify-center" : "gap-3 px-4"} ${
                  active ? "bg-primary-soft font-semibold text-primary" : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                <Icon size={22} weight={active ? "fill" : "regular"} aria-hidden="true" />
                <span className={rail ? "sr-only" : ""}>{label}</span>
              </Link>
            );
          })}
        </nav>
        {rail ? (
          <div className="mt-auto grid justify-items-center gap-2 pb-4">
            <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary" title={`${memberName}, ${roleName}`}>
              {memberName.trim().charAt(0).toUpperCase()}
              <span className="sr-only">{memberName}, {roleName}</span>
            </span>
            {signOut && (
              <form action={signOut}>
                <button type="submit" className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label="Sign out" title="Sign out">
                  <SignOut size={20} aria-hidden="true" />
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="mt-auto grid gap-2 border-t border-border p-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{memberName}</p>
              <p className="truncate text-sm text-muted">{roleName}</p>
            </div>
            {footer}
            {signOut && (
              <form action={signOut}>
                <button type="submit" className="flex min-h-11 items-center gap-2 text-sm text-muted hover:text-text">
                  <SignOut size={20} aria-hidden="true" /> Sign out
                </button>
              </form>
            )}
          </div>
        )}
      </aside>

      <div className={`flex flex-col lg:pb-0 ${fullBleed ? "h-dvh pb-[calc(4rem+1px+env(safe-area-inset-bottom))]" : "min-h-dvh pb-20"}`}>
        {banner}
        {/* Phone top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
          <p className="title truncate text-lg">{workspaceName}</p>
          <p className="truncate text-sm text-muted">{memberName}</p>
        </header>

        <main id="main" className={fullBleed ? "min-h-0 flex-1" : "mx-auto grid w-full max-w-5xl content-start gap-6 px-4 py-6 lg:px-8 lg:py-10"}>
          {children}
        </main>
      </div>

      {/* Phone bottom bar: five destinations */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {mobile.map(({ href, label, Icon, match }) => {
          const active = match(path);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${active ? "font-semibold text-primary" : "text-muted"}`}
            >
              <Icon size={24} weight={active ? "fill" : "regular"} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
