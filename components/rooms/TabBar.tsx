"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/today", label: "Today" },
  { href: "/radar", label: "Radar" },
  { href: "/priorities", label: "Priorities" },
  { href: "/table", label: "Table" },
  { href: "/ask", label: "Ask" },
] as const;

function TabIcon({ tab, active }: { tab: string; active: boolean }) {
  const stroke = active ? "var(--ink)" : "var(--ink-3)";
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (tab) {
    case "/today":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
        </svg>
      );
    case "/radar":
      return (
        <svg {...common}>
          <path d="M12 12 L19 5" />
          <circle cx="12" cy="12" r="1.2" fill={stroke} stroke="none" />
          <path d="M4 12a8 8 0 1 0 8-8" />
          <path d="M8 12a4 4 0 1 0 4-4" opacity="0.55" />
        </svg>
      );
    case "/priorities":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15.5 8.5l-2.3 5-4.7 2 2.3-5z" />
        </svg>
      );
    case "/table":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2.2" />
          <circle cx="16" cy="8" r="2.2" />
          <circle cx="8" cy="16" r="2.2" />
          <circle cx="16" cy="16" r="2.2" />
        </svg>
      );
    case "/ask":
      return (
        <svg {...common}>
          <rect x="9.2" y="3.5" width="5.6" height="10" rx="2.8" />
          <path d="M6 11.5a6 6 0 0 0 12 0M12 17.5V21" />
        </svg>
      );
    default:
      return null;
  }
}

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar grid grid-cols-5">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className="flex flex-col items-center justify-center gap-0.5"
            aria-current={active ? "page" : undefined}
          >
            <TabIcon tab={t.href} active={active} />
            <span
              className="text-[10.5px] tracking-[0.02em]"
              style={{
                color: active ? "var(--ink)" : "var(--ink-3)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {t.label}
            </span>
            <span
              className="h-[3px] w-8 rounded-full"
              style={{ background: active ? "var(--mint)" : "transparent" }}
            />
          </Link>
        );
      })}
    </nav>
  );
}
