/* The Ledger's arithmetic. Five material supporting signals move confidence
   about eight points; unwatched beliefs drift toward fifty, not false comfort. */

export const K = 0.8;
export const FLIP_FLOOR = 35;

export function applyEvidence(confidence: number, direction: -1 | 1, weight: 1 | 2 | 3): number {
  return Math.max(0, Math.min(100, confidence + direction * weight * K));
}

/* One point per quiet fortnight toward fifty. Runs in the weekly job. */
export function decayTowardFifty(confidence: number, quietFortnights: number): number {
  if (quietFortnights <= 0) return confidence;
  const drift = Math.min(Math.abs(confidence - 50), quietFortnights);
  return confidence > 50 ? confidence - drift : confidence + drift;
}

export function nextStatus(args: {
  prev: number;
  next: number;
  status: string;
  heavyChallenges14d: number;
  delta14d: number;
}): string {
  const { prev, next, status, heavyChallenges14d, delta14d } = args;
  if (status === "retired") return status;
  if (next < FLIP_FLOOR && prev >= FLIP_FLOOR) return "weakening";
  if (heavyChallenges14d >= 3) return "weakening";
  if (next < FLIP_FLOOR) return "flipped";
  if (delta14d >= 5) return "strengthening";
  if (delta14d <= -5) return "weakening";
  return "holding";
}
