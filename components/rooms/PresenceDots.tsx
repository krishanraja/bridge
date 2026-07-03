"use client";

/* The four-dot presence strip. A dot fills when that seat has opened the app today.
   Live over Realtime presence once the database is configured; seeded facts in demo mode. */

import { useEffect, useState } from "react";
import { SEAT_IDS, SEATS, type SeatId } from "@/lib/seats";

interface PresenceDotsProps {
  demo: boolean;
  currentSeat: SeatId;
  seedPresent?: SeatId[];
}

export function PresenceDots({ demo, currentSeat, seedPresent = [] }: PresenceDotsProps) {
  const [present, setPresent] = useState<Set<SeatId>>(
    () => new Set(demo ? [...seedPresent, currentSeat] : [currentSeat]),
  );

  useEffect(() => {
    if (demo) return;
    let active = true;
    let cleanup: (() => void) | undefined;

    (async () => {
      const { supabaseBrowser } = await import("@/lib/supabase/client");
      const sb = supabaseBrowser();
      const day = new Date().toISOString().slice(0, 10);
      const channel = sb.channel(`presence:${day}`, {
        config: { presence: { key: String(currentSeat) } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (!active) return;
          const state = channel.presenceState();
          const seats = new Set<SeatId>([currentSeat]);
          Object.keys(state).forEach((k) => {
            const n = Number(k);
            if (n >= 1 && n <= 4) seats.add(n as SeatId);
          });
          setPresent(seats);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ seat: currentSeat, at: Date.now() });
          }
        });

      cleanup = () => {
        sb.removeChannel(channel);
      };
    })();

    return () => {
      active = false;
      cleanup?.();
    };
  }, [demo, currentSeat]);

  return (
    <div className="flex items-center gap-1.5" aria-label="who has opened today">
      {SEAT_IDS.map((id) => {
        const here = present.has(id);
        return (
          <span
            key={id}
            title={SEATS[id].shortName}
            className="h-2 w-2 rounded-full"
            style={{
              background: here ? "var(--mint)" : "transparent",
              border: here ? "1px solid var(--mint-deep)" : "1px solid var(--ink-3)",
            }}
          />
        );
      })}
    </div>
  );
}
