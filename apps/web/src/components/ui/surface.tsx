import type { ReactNode } from "react";
import { CheckCircle, Info, WarningCircle } from "@phosphor-icons/react/dist/ssr";

/** A card: only for things people act on as a unit (a team, a member list, a form). */
export function Card({ title, description, actions, children, className = "" }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`grid gap-4 rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-[var(--shadow-1)] ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

const tones = {
  error: { cls: "border-fail bg-fail-soft", Icon: WarningCircle, role: "alert" as const },
  warn: { cls: "border-warn bg-warn-soft", Icon: WarningCircle, role: "alert" as const },
  success: { cls: "border-done bg-done-soft", Icon: CheckCircle, role: "status" as const },
  info: { cls: "border-border bg-surface-2", Icon: Info, role: "status" as const },
};

/** Messages about the page as a whole. Field errors go under their field instead. */
export function Notice({ tone, title, children }: { tone: keyof typeof tones; title?: string; children?: ReactNode }) {
  const t = tones[tone];
  return (
    <div role={t.role} className={`flex gap-3 rounded-[var(--radius-control)] border p-4 ${t.cls}`}>
      <t.Icon size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="grid gap-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-sm">{children}</div>}
      </div>
    </div>
  );
}

export function Badge({ tone = "new", children }: { tone?: "new" | "transit" | "done" | "warn" | "fail"; children: ReactNode }) {
  const map = { new: "bg-new-soft text-new", transit: "bg-transit-soft text-transit", done: "bg-done-soft text-done", warn: "bg-warn-soft text-warn", fail: "bg-fail-soft text-fail" };
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-medium ${map[tone]}`}>{children}</span>;
}

/** Page title with one short explanation and, at most, one primary action. */
export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <h1 className="title text-3xl sm:text-4xl">{title}</h1>
        {description && <p className="max-w-2xl text-muted">{description}</p>}
      </div>
      {action}
    </header>
  );
}

/** Empty screens always say what will appear and offer the next step. */
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-border bg-surface px-6 py-12 text-center">
      {icon && <div className="text-muted" aria-hidden="true">{icon}</div>}
      <h2 className="text-lg font-semibold">{title}</h2>
      {children && <p className="max-w-md text-muted">{children}</p>}
      {action}
    </div>
  );
}
