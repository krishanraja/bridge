/* The one button. Three weights, two sizes, always a pill.
   primary  — ink fill, the single decisive action on a screen.
   secondary — hairline outline, the reversible action.
   ghost    — quiet, low-commitment. */

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  full?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-bg border border-ink",
  secondary: "bg-paper text-ink2 border border-line",
  ghost: "bg-transparent text-ink3 border border-transparent",
};

const SIZE: Record<Size, string> = {
  sm: "px-3.5 py-1.5 text-[var(--t-secondary)]",
  md: "px-4 py-2.5 text-[var(--t-body)]",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  full,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-[var(--r-pill)] font-medium transition-opacity disabled:opacity-60 ${VARIANT[variant]} ${SIZE[size]} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
