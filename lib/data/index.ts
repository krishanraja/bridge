/* The data layer rooms talk to. Picks the seed reader until the database is configured,
   then the database source. Same view models either way. */

import { useSeedData } from "@/lib/mode";
import type { Decision, SeatPrefs } from "@/lib/types";
import type { SeatId } from "@/lib/seats";
import type {
  DeckView,
  LedgerData,
  PriorityView,
  TableData,
  ThemeView,
  TodayData,
} from "./views";
import {
  demoDeck,
  demoDecisionLog,
  demoLedger,
  demoPriorityViews,
  demoPrefs,
  demoAllPrefs,
  demoTable,
  demoThemes,
  demoToday,
} from "./demo";

export async function getToday(): Promise<TodayData> {
  if (useSeedData()) return demoToday();
  const db = await import("./db");
  return db.dbToday();
}

export async function getDeck(): Promise<DeckView> {
  if (useSeedData()) return demoDeck();
  const db = await import("./db");
  return db.dbDeck();
}

export async function getPriorities(): Promise<PriorityView[]> {
  if (useSeedData()) return demoPriorityViews();
  const db = await import("./db");
  return db.dbPriorityViews();
}

export async function getTable(): Promise<TableData> {
  if (useSeedData()) return demoTable();
  const db = await import("./db");
  return db.dbTable();
}

export async function getLedger(): Promise<LedgerData> {
  if (useSeedData()) return demoLedger();
  const db = await import("./db");
  return db.dbLedger();
}

export async function getDecisionLog(): Promise<Decision[]> {
  if (useSeedData()) return demoDecisionLog();
  const db = await import("./db");
  return db.dbDecisionLog();
}

export async function getThemes(): Promise<ThemeView[]> {
  if (useSeedData()) return demoThemes();
  const db = await import("./db");
  return db.dbThemes();
}

export async function getSeatPrefs(seat: SeatId): Promise<SeatPrefs | null> {
  if (useSeedData()) return demoPrefs(seat);
  const db = await import("./db");
  return db.dbSeatPrefs(seat);
}

export async function getAllSeatPrefs(): Promise<SeatPrefs[]> {
  if (useSeedData()) return demoAllPrefs();
  const db = await import("./db");
  return db.dbAllSeatPrefs();
}
