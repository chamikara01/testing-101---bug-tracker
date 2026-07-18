import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-[color,background-color,box-shadow,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-blue text-white hover:bg-brand-blue-dark hover:shadow-sm",
  secondary:
    "bg-white text-brand-charcoal ring-1 ring-line hover:bg-slate-50 hover:shadow-sm",
  outline:
    "bg-white text-brand-charcoal ring-1 ring-line hover:bg-slate-50 hover:shadow-sm",
  ghost: "bg-transparent text-brand-charcoal hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700 hover:shadow-sm",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-base",
  icon: "h-9 w-9",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
}: { variant?: Variant; size?: Size } = {}) {
  return cn(base, VARIANTS[variant], SIZES[size]);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
