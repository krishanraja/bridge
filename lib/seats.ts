/* The four seats. Brief section 2. Hard-allowlisted; emails come from env, never code. */

export type SeatId = 1 | 2 | 3 | 4;
export type SeatRole = "principal" | "operator";

export interface Seat {
  id: SeatId;
  name: string;
  shortName: string;
  initials: string;
  role: SeatRole;
  location: string;
}

export const SEATS: Record<SeatId, Seat> = {
  1: {
    id: 1,
    name: "Kabir Shahani",
    shortName: "Kabir",
    initials: "KS",
    role: "principal",
    location: "New York",
  },
  2: {
    id: 2,
    name: "Derek Slager",
    shortName: "Derek",
    initials: "DS",
    role: "principal",
    location: "Seattle",
  },
  3: {
    id: 3,
    name: "Amy Pelly",
    shortName: "Amy",
    initials: "AP",
    role: "principal",
    location: "Seattle",
  },
  4: {
    id: 4,
    name: "Krish Raja",
    shortName: "Krish",
    initials: "KR",
    role: "operator",
    location: "New York",
  },
};

export const SEAT_IDS = [1, 2, 3, 4] as SeatId[];

/* SEAT_ALLOWLIST is four comma-separated positions, seat order 1..4.
   Empty positions keep that seat unloginable until filled. */
export function allowlistedEmails(): Map<string, SeatId> {
  const raw = process.env.SEAT_ALLOWLIST ?? "";
  const map = new Map<string, SeatId>();
  raw.split(",").forEach((email, i) => {
    const e = email.trim().toLowerCase();
    if (e && i < 4) map.set(e, (i + 1) as SeatId);
  });
  return map;
}

export function seatForEmail(email: string): SeatId | null {
  return allowlistedEmails().get(email.trim().toLowerCase()) ?? null;
}
