import Link from "next/link";
import { CaretRight, CheckCircle, Circle } from "@phosphor-icons/react/dist/ssr";
import { ListSurface } from "@/components/settings-frame";
import type { SetupStep } from "@/lib/setup";

/** The setup checklist as a plain list with progress (Home before connecting, and Settings › Account). */
export function SetupChecklist({ steps, title = "Get set up" }: { steps: SetupStep[]; title?: string }) {
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <section aria-labelledby="setup" className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="setup" className="text-lg font-semibold">{title}</h2>
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
                <Link href={s.href} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-2">
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
  );
}
