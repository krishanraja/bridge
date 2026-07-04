/* The header row every card and section shares: an eyebrow label on the left,
   optional actions on the right, on one baseline. */

import type { ReactNode } from "react";

export function SectionLabel({
  children,
  right,
  className = "",
  color,
}: {
  children: ReactNode;
  right?: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <span className="eyebrow" style={color ? { color } : undefined}>
        {children}
      </span>
      {right != null && <div className="flex items-center gap-2.5">{right}</div>}
    </div>
  );
}
