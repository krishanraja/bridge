/* The room-level loading fallback. Because the rooms are server-rendered on
   demand (fresh, seat-scoped data), a tab tap has to wait for a round-trip.
   This skeleton shows instantly in the content area — the tab bar stays put —
   so the tap is acknowledged the moment it lands, not when the data returns. */

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <span
      className={`block ${className}`}
      style={{
        background:
          "linear-gradient(90deg, var(--line) 0%, var(--bg) 50%, var(--line) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s ease-in-out infinite",
      }}
    />
  );
}

export default function RoomLoading() {
  return (
    <div className="room-canvas" aria-busy="true">
      <div className="flex items-center justify-between">
        <Shimmer className="h-3 w-20 rounded" />
        <Shimmer className="h-3 w-12 rounded" />
      </div>
      <div className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-line bg-paper p-[var(--space-5)] shadow-[var(--elev-card)]">
        <div className="flex gap-1.5">
          <Shimmer className="h-5 w-16 rounded-full" />
          <Shimmer className="h-5 w-20 rounded-full" />
        </div>
        <Shimmer className="h-6 w-4/5 rounded" />
        <Shimmer className="h-6 w-3/5 rounded" />
        <div className="mt-2 flex flex-col gap-2">
          <Shimmer className="h-4 w-full rounded" />
          <Shimmer className="h-4 w-11/12 rounded" />
          <Shimmer className="h-4 w-2/3 rounded" />
        </div>
      </div>
    </div>
  );
}
