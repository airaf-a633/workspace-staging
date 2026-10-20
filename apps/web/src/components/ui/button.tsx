import Link from "next/link";
import type { ComponentProps } from "react";

export type Variant = "primary" | "secondary" | "ghost" | "destructive" | "light" | "glass";
export type Size = "md" | "sm" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-medium transition-[filter,background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";
const sizes: Record<Size, string> = {
  lg: "min-h-12 px-6 text-base", // hero calls to action
  md: "min-h-11 px-4 text-[15px]", // 44px: comfortable touch target
  sm: "min-h-9 px-3 text-sm",
};
const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-[var(--shadow-1)] hover:brightness-110",
  secondary: "border border-input bg-surface text-text hover:bg-surface-2",
  ghost: "text-text hover:bg-surface-2",
  destructive: "bg-destructive text-on-destructive hover:brightness-110",
  // On dark brand surfaces: a white button with ink text, and a quiet outline button.
  light: "bg-white text-[#111518] hover:bg-[#EEF3F5]",
  glass: "border border-white/30 text-white hover:bg-white/10",
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
