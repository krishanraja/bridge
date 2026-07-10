"use client";

/* The desktop left rail. Replaces the phone's bottom tab bar at wide widths: the
   rooms as icon and label rows, the table's live presence, and the operator's
   tools at the foot. Shown only on desktop (CSS gates .sidebar on data-desktop). */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PresenceDots } from "@/components/rooms/PresenceDots";
import { SignOutButton } from "@/components/rooms/SignOutButton";
import type { SeatId } from "@/lib/seats";

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/today", label: "Overview", icon: "today" },
  { href: "/radar", label: "Radar", icon: "radar" },
  { href: "/priorities", label: "Priorities", icon: "priorities" },
  { href: "/table", label: "Table", icon: "table" },
  { href: "/ask", label: "Ask", icon: "ask" },
];

function NavRow({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: IconName;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5 transition-colors"
      style={{
        background: active ? "var(--mint-wash)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-2)",
      }}
    >
      <span style={{ color: active ? "var(--mint-deep)" : "var(--ink-3)" }}>
        <Icon name={icon} size={20} />
      </span>
      <span className="text-[15px] font-medium">{label}</span>
    </Link>
  );
}

export function SideNav({ seat, demo }: { seat: SeatId | null; demo: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="sidebar px-3 pt-6 pb-5">
      <div className="px-3 pb-5">
        <span className="t-title tracking-[0.04em] text-ink">BRIDGE</span>
        <div className="eyebrow mt-0.5">The leadership table</div>
      </div>

      <div className="flex flex-col gap-1">
        {ITEMS.map((it) => (
          <NavRow key={it.href} {...it} active={pathname.startsWith(it.href)} />
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        {seat && (
          <div className="flex items-center justify-between px-3 pt-2">
            <span className="eyebrow">The table</span>
            <PresenceDots demo={demo} currentSeat={seat} seedPresent={[2, 3]} />
          </div>
        )}
        <NavRow
          href="/settings"
          label="Settings"
          icon="settings"
          active={pathname.startsWith("/settings")}
        />
        <div className="px-1">
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
