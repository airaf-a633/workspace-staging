"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ChatsCircle, CheckSquare, Gear, House, Handshake, SignOut, UsersThree } from "@phosphor-icons/react";

interface Props {
  slug: string;
  workspaceName: string;
  memberName: string;
  roleName: string;
  signOut: () => Promise<void>;
  children: ReactNode;
}

/* Five to six destinations, each with an icon AND a label. Nothing is icon-only. */
function navItems(slug: string) {
  const base = `/w/${slug}`;
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
      match: (p: string) => ["settings", "members", "teams", "roles"].some((s) => p.startsWith(`${base}/${s}`)),
    },
  ];
}

export function AppShell({ slug, workspaceName, memberName, roleName, signOut, children }: Props) {
  const path = usePathname();
  const items = navItems(slug);
  // Phones get the five most-used destinations; Tasks is reachable from Home.
  const mobile = items.filter((i) => i.label !== "Tasks");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:p-3">
        Skip to content
      </a>

      {/* Desktop side menu */}
      <aside className="hidden border-e border-border bg-surface lg:flex lg:flex-col" aria-label="Main">
        <div className="border-b border-border px-5 py-4">
          <p className="truncate font-semibold" title={workspaceName}>{workspaceName}</p>
        </div>
        <nav className="grid gap-1 p-3">
          {items.map(({ href, label, Icon, match }) => {
            const active = match(path);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-base ${
                  active ? "bg-primary-soft font-semibold text-primary" : "text-text hover:bg-surface-2"
                }`}
              >
                <Icon size={22} weight={active ? "fill" : "regular"} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto grid gap-2 border-t border-border p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{memberName}</p>
            <p className="truncate text-sm text-muted">{roleName}</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="flex min-h-11 items-center gap-2 text-sm text-muted hover:text-text">
              <SignOut size={20} aria-hidden="true" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col pb-20 lg:pb-0">
        {/* Phone top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
          <p className="truncate font-semibold">{workspaceName}</p>
          <p className="truncate text-sm text-muted">{memberName}</p>
        </header>

        <main id="main" className="mx-auto grid w-full max-w-5xl content-start gap-6 px-4 py-6 lg:px-8 lg:py-8">
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
