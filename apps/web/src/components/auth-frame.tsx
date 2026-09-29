import type { ReactNode } from "react";

/** Centred single-task frame for sign-in, sign-up, workspace creation and invites. */
export function AuthFrame({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="grid w-full max-w-md gap-6">
        <p className="text-center text-lg font-semibold text-primary">Workspace</p>
        <section className="grid gap-5 rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-[var(--shadow-1)] sm:p-8">
          <header className="grid gap-1">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {description && <p className="text-muted">{description}</p>}
          </header>
          {children}
        </section>
        {footer && <div className="text-center text-sm">{footer}</div>}
      </div>
    </main>
  );
}
