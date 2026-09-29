import Link from "next/link";
import type { ComponentProps } from "react";

export type Variant = "primary" | "secondary" | "ghost" | "destructive";
export type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";
const sizes: Record<Size, string> = {
  md: "min-h-11 px-4 text-base", // 44px: comfortable touch target
  sm: "min-h-9 px-3 text-sm",
};
const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:brightness-110",
  secondary: "border border-input bg-surface text-text hover:bg-surface-2",
  ghost: "text-primary hover:bg-primary-soft",
  destructive: "bg-destructive text-on-destructive hover:brightness-110",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra = "") {
  return `${base} ${sizes[size]} ${variants[variant]} ${extra}`;
}

export function Button({ variant = "secondary", size = "md", className = "", ...rest }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({ variant = "secondary", size = "md", className = "", ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />;
}
