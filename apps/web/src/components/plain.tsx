/**
 * Plain building blocks for M1–M3 screens. Deliberately simple: the design system
 * replaces these in M4. Keep them accessible (labels, focus, errors near fields).
 */
import type { ReactNode } from "react";

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto grid max-w-xl gap-6 px-4 py-10">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}

export function Notice({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={tone === "error" ? "rounded border border-red-700 p-3 text-red-800" : "rounded border border-slate-400 p-3"}>
      {children}
    </p>
  );
}

export function Field(props: { label: string; name: string; type?: string; autoComplete?: string; required?: boolean; defaultValue?: string; minLength?: number }) {
  const { label, name, ...rest } = props;
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input name={name} className="rounded border border-slate-500 px-3 py-2 font-normal" {...rest} />
    </label>
  );
}

export function Submit({ children, variant = "primary" }: { children: ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <button
      type="submit"
      className={variant === "primary" ? "rounded bg-indigo-800 px-4 py-2 font-medium text-white" : "rounded border border-slate-500 px-4 py-2 font-medium"}
    >
      {children}
    </button>
  );
}
