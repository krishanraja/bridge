"use client";

/* Bottom sheet: depth is a tap away, never a scroll. Content taller than the
   sheet paginates inside it. */

import { useEffect } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <button
        aria-label="Close"
        className="absolute inset-0 h-full w-full"
        style={{ background: "rgba(12, 28, 44, 0.4)" }}
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[82%] w-full max-w-[430px] flex-col rounded-t-2xl border-t border-line bg-paper"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          animation: "sheet-up 200ms ease-out",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="eyebrow">{title}</span>
          <button
            onClick={onClose}
            aria-label="Close sheet"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink2"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}
