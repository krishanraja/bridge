/* Haptic vocabulary via the vibration API where available. One kill-switch:
   reduced motion silences every verb. Patterns are tuned so the decisive verbs
   (impact, success, warning) feel distinct from the light ones (selection,
   navigation) under a thumb.

   `tick` and `confirm` are kept as aliases so existing call sites are unchanged;
   new code should reach for the named verb that fits the action. */

function reduced(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function buzz(pattern: number | number[]) {
  if (reduced()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

/* A light tap: chip toggles, snap-paging, opening a card, slider release. */
export function selection() {
  buzz(6);
}

/* The lightest tick: moving between rooms. */
export function navigation() {
  buzz(4);
}

/* A firm, single knock: the one decisive primary action on a screen. */
export function impact() {
  buzz(14);
}

/* A rising pattern that reads as done: logged, shipped, acted, saved. */
export function success() {
  buzz([10, 30, 10, 30, 16]);
}

/* A heavier double: killing, holding, acknowledging something at risk. */
export function warning() {
  buzz([20, 60, 20]);
}

/* Back-compat aliases. */
export const tick = selection;
export const confirm = success;
