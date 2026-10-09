"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/i18n/client";
import { buttonClass, type Size, type Variant } from "./button";

/** Submit button for server-action forms: disables itself and says what's happening while the form is sent. */
export function Submit({ children, pending, variant = "primary", size = "md", className = "" }: { children: ReactNode; pending?: string; variant?: Variant; size?: Size; className?: string }) {
  const status = useFormStatus();
  const t = useT("common");
  return (
    <button type="submit" disabled={status.pending} aria-busy={status.pending} className={buttonClass(variant, size, className)}>
      {status.pending ? (pending ?? t("saving")) : children}
    </button>
  );
}
