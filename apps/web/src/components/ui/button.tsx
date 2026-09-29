import Link from "next/link";
import type { ComponentProps } from "react";

export type Variant = "primary" | "secondary" | "ghost" | "destructive" | "light" | "glass";
export type Size = "md" | "sm" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[filter,background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";
const sizes: Record<Size, string> = {
  lg: "min-h-13 px-7 text-base", // hero calls to action
  md: "min-h-11 px-5 text-base", // 44px: comfortable touch target
  sm: "min-h-9 px-3.5 text-sm",
};
const variants: Record<Variant, string> = {
  primary: "bg-button text-on-primary shadow-[var(--shadow-1)] hover:brightness-110 hover:shadow-[var(--shadow-2)]",
  secondary: "border border-input bg-surface text-text hover:bg-surface-2",
  ghost: "text-primary hover:bg-primary-soft",
  destructive: "bg-destructive text-on-destructive hover:brightness-110",
  // On the dark hero gradient: a white pill with navy text, and a frosted outline pill.
  light: "bg-white text-[#0F2537] shadow-[var(--shadow-2)] hover:bg-[#EAF6F4]",
  glass: "glass text-white hover:bg-white/25",
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
