/* The one card. A soft paper surface with a hairline and a quiet lift.
   An optional accent paints the 3px left edge that marks lane and state. */

import type { ElementType, ReactNode, CSSProperties } from "react";

interface CardProps {
  children: ReactNode;
  accent?: string;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerLeave?: (e: React.PointerEvent) => void;
}

export function Card({
  children,
  accent,
  className = "",
  style,
  as,
  ...rest
}: CardProps) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag
      className={`rounded-[var(--r-lg)] border border-line bg-paper shadow-[var(--elev-card)] ${className}`}
      style={{
        padding: "var(--space-4)",
        ...(accent ? { borderLeft: `3px solid ${accent}` } : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
