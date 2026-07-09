"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { navigation } from "@/lib/haptics";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/radar", label: "Radar", icon: "radar" },
  { href: "/priorities", label: "Priorities", icon: "priorities" },
  { href: "/table", label: "Table", icon: "table" },
  { href: "/ask", label: "Ask", icon: "ask" },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar grid grid-cols-5">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          onClick={() => navigation()}
          className="flex flex-col items-center justify-center gap-0.5 transition-opacity active:opacity-60"
          aria-current={pathname.startsWith(t.href) ? "page" : undefined}
        >
          <TabInner
            icon={t.icon}
            label={t.label}
            routeActive={pathname.startsWith(t.href)}
          />
        </Link>
      ))}
    </nav>
  );
}

/* Rendered inside <Link>, so it can read the navigation's pending state and
   light the tapped tab the instant it is pressed — before the new room's
   server round-trip finishes — instead of only once the page commits. */
function TabInner({
  icon,
  label,
  routeActive,
}: {
  icon: IconName;
  label: string;
  routeActive: boolean;
}) {
  const { pending } = useLinkStatus();
  const active = routeActive || pending;
  return (
    <>
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${active ? "pop" : ""}`}
        style={{
          color: active ? "var(--ink)" : "var(--ink-3)",
          background: active ? "var(--mint-wash)" : "transparent",
        }}
      >
        <Icon name={icon} size={21} />
      </span>
      <span
        className="text-[12px] tracking-[0.02em]"
        style={{
          color: active ? "var(--ink)" : "var(--ink-3)",
          fontWeight: active ? 600 : 400,
        }}
      >
        {label}
      </span>
      <span
        className="h-[3px] w-8 rounded-full transition-colors"
        style={{ background: active ? "var(--mint)" : "transparent" }}
      />
    </>
  );
}
