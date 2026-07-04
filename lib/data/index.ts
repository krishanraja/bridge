/* The data layer rooms talk to. Picks the seed reader until the database is configured,
   then the database source. Same view models either way. */

import { useSeedData } from "@/lib/mode";
import type { Decision } from "@/lib/types";
import type {
  DeckView,
  LedgerData,
  PriorityView,
  TableData,
  TodayData,
} from "./views";
import {
  demoDeck,
  demoDecisionLog,
  demoLedger,
  demoPriorityViews,
  demoTable,
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
