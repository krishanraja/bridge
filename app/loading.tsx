/* The quiet loading state. A calm pulse, never a spinner storm. */

export default function Loading() {
  return (
    <div className="app-frame flex items-center justify-center">
      <div
        className="h-10 w-10 rounded-full"
        style={{ background: "var(--mint-wash)", border: "1px solid var(--mint-bd)" }}
      >
        <div className="h-full w-full animate-ping rounded-full" style={{ background: "var(--mint)", opacity: 0.4 }} />
      </div>
    </div>
  );
}
