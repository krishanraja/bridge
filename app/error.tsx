"use client";

/* The one honest error surface. No stack traces to a principal; a plain line
   and a way back. */

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="app-frame flex flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="num-display text-[27px] font-medium text-ink">
        Something did not load.
      </div>
      <p className="text-[15px] leading-snug text-ink2">
        The instrument hit a snag reading this room. It is not your fault and
        nothing was lost.
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-bg"
      >
        Try again
      </button>
    </div>
  );
}
