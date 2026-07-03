/* Haptic ticks via the vibration API where available. Reduced motion kills them. */

function reduced(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function tick() {
  if (reduced()) return;
  try {
    navigator.vibrate?.(8);
  } catch {
    /* unsupported */
  }
}

export function confirm() {
  if (reduced()) return;
  try {
    navigator.vibrate?.([12, 40, 12]);
  } catch {
    /* unsupported */
  }
}
