"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

const control =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base text-text placeholder:text-muted";

/** Label above, control, then help or error text below (linked with aria-describedby). */
export function Field({ label, help, error, children, id }: { label: string; help?: ReactNode; error?: string; children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode; id?: string }) {
  const auto = useId();
  const fieldId = id ?? auto;
  const noteId = `${fieldId}-note`;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-medium">{label}</label>
      {children({ id: fieldId, describedBy: help || error ? noteId : undefined, invalid: !!error })}
      {error ? (
        <p id={noteId} role="alert" className="text-sm text-fail">{error}</p>
      ) : help ? (
        <p id={noteId} className="text-sm text-muted">{help}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ label, help, error, ...rest }: ComponentProps<"input"> & { label: string; help?: ReactNode; error?: string }) {
  return (
    <Field label={label} help={help} error={error} id={rest.id}>
      {({ id, describedBy, invalid }) => <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={control} {...rest} />}
    </Field>
  );
}

export function SelectInput({ label, help, error, children, ...rest }: ComponentProps<"select"> & { label: string; help?: ReactNode; error?: string }) {
  return (
    <Field label={label} help={help} error={error} id={rest.id}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={control} {...rest}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function Checkbox({ label, ...rest }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-base">
      <input type="checkbox" className="size-5 accent-[var(--primary)]" {...rest} />
      <span>{label}</span>
    </label>
  );
}
