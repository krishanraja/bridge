/* The one icon. A typed name maps to an inline SVG drawn in a single line idiom:
   24x24 box, no fill, stroke is currentColor, round caps and joins. Callers set
   the color by setting text/`color` on an ancestor, so lane hues, ink ramps, and
   mint all flow in with no per-icon color prop. Server-safe; no client hooks.

   This consolidates the SVGs that were scattered inline across the rooms, and
   gives the eight lanes real marks instead of a text word. */

import type { CSSProperties } from "react";

export type IconName =
  // Tabs
  | "today"
  | "radar"
  | "priorities"
  | "table"
  | "ask"
  // Lanes (1..8)
  | "moat"
  | "platform"
  | "category"
  | "agentic"
  | "vertical"
  | "capital"
  | "trust"
  | "talent"
  // Focus kinds
  | "decision"
  | "move"
  | "signal"
  | "thread"
  // Utility
  | "settings"
  | "chevron-right"
  | "sparkle"
  | "bolt"
  | "bookmark"
  | "play"
  | "pause"
  | "close";

const PATHS: Record<IconName, React.ReactNode> = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </>
  ),
  radar: (
    <>
      <path d="M12 12 L19 5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <path d="M4 12a8 8 0 1 0 8-8" />
      <path d="M8 12a4 4 0 1 0 4-4" opacity="0.55" />
    </>
  ),
  priorities: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2.3 5-4.7 2 2.3-5z" />
    </>
  ),
  table: (
    <>
      <circle cx="8" cy="8" r="2.2" />
      <circle cx="16" cy="8" r="2.2" />
      <circle cx="8" cy="16" r="2.2" />
      <circle cx="16" cy="16" r="2.2" />
    </>
  ),
  ask: (
    <>
      <rect x="9.2" y="3.5" width="5.6" height="10" rx="2.8" />
      <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21" />
    </>
  ),
  moat: <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" />,
  platform: (
    <>
      <path d="M12 4l8 4-8 4-8-4z" />
      <path d="M4 12l8 4 8-4" />
    </>
  ),
  category: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.3" />
      <rect x="13" y="4" width="7" height="7" rx="1.3" />
      <rect x="4" y="13" width="7" height="7" rx="1.3" />
      <rect x="13" y="13" width="7" height="7" rx="1.3" />
    </>
  ),
  agentic: (
    <>
      <circle cx="12" cy="6" r="2.2" />
      <circle cx="6" cy="17" r="2.2" />
      <circle cx="18" cy="17" r="2.2" />
      <path d="M10.6 7.7l-3.2 7.6M13.4 7.7l3.2 7.6M8.2 17h7.6" />
    </>
  ),
  vertical: (
    <>
      <path d="M3 21h18" />
      <path d="M6 21V12M12 21V5M18 21v-6" />
    </>
  ),
  capital: (
    <>
      <ellipse cx="12" cy="7" rx="7" ry="3" />
      <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
      <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" opacity="0.55" />
    </>
  ),
  trust: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" />
      <path d="M9 11.8l2 2 4-4.2" />
    </>
  ),
  talent: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.8 20a6.2 6.2 0 0 1 12.4 0" />
    </>
  ),
  decision: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.4 12.2l2.6 2.6 4.6-5.2" />
    </>
  ),
  move: (
    <>
      <path d="M6 21V4" />
      <path d="M6 5h11l-2 3 2 3H6" />
    </>
  ),
  signal: (
    <>
      <circle cx="12" cy="10" r="2" fill="currentColor" stroke="none" />
      <path d="M12 13v7" />
      <path d="M8.3 6.3a5.5 5.5 0 0 0 0 7.4M15.7 6.3a5.5 5.5 0 0 1 0 7.4" />
    </>
  ),
  thread: (
    <>
      <path d="M9.5 14.5l5-5" />
      <path d="M11 6.8l1-1a3.6 3.6 0 0 1 5.1 5.1l-2 2" />
      <path d="M13 17.2l-1 1a3.6 3.6 0 0 1-5.1-5.1l2-2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  sparkle: (
    <>
      <path d="M12 3l1.7 5.1L19 9.8l-5.3 1.7L12 17l-1.7-5.5L5 9.8l5.3-1.7z" />
      <path d="M18.2 14.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6z" />
    </>
  ),
  bolt: <path d="M13 2.5L5.5 13H11l-1 8.5L18.5 10.5H12z" />,
  bookmark: <path d="M6.5 4h11v16l-5.5-3.6L6.5 20z" />,
  play: <path d="M7 5v14l11-7z" />,
  pause: <path d="M9 5v14M15 5v14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
};

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.7,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
