/* Loads live mode: ontology and assumptions only, empty history, designed
   cold-start states everywhere else. Run: pnpm seed:live */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import ontology from "../supabase/seed/ontology.json";
import assumptionsSeed from "../supabase/seed/assumptions.json";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function wipe() {
  for (const table of [
    "learn_proposals",
    "audit_log",
    "push_subscriptions",
    "receipts",
    "events",
    "briefs",
    "pulses",
    "threads",
    "decisions",
    "moves",
    "priorities",
    "assumption_evidence",
    "signals",
    "assumptions",
    "sources",
  ]) {
    const { error } = await sb.from(table).delete().gte("created_at", "1970-01-01");
    if (error) {
      const fallback = await sb.from(table).delete().neq("id", -1 as never);
      if (fallback.error) console.warn(`wipe ${table}: ${fallback.error.message}`);
    }
  }
}

async function main() {
  console.log("Wiping existing rows. The sample comes out; your priorities go in.");
  await wipe();

  const emails = (process.env.SEAT_ALLOWLIST ?? "").split(",").map((e) => e.trim().toLowerCase());
  const names = ["Kabir Shahani", "Derek Slager", "Amy Pelly", "Krish Raja"];
  const roles = ["principal", "principal", "principal", "operator"];
  for (let i = 0; i < 4; i++) {
    const { error } = await sb.from("seats").upsert(
      { id: i + 1, email: emails[i] || null, name: names[i], role: roles[i], lane_order: null },
      { onConflict: "id" },
    );
    if (error) throw new Error(`seats: ${error.message}`);
  }
  console.log("seats: 4");

  const sourceRows = (ontology.sources as {
    name: string; kind: string; url: string; lane: number | null; tier: number;
  }[]).map((s) => ({ ...s, weight: 1.0, active: true }));
  {
    const { error } = await sb.from("sources").insert(sourceRows);
    if (error) throw new Error(`sources: ${error.message}`);
    console.log(`sources: ${sourceRows.length}`);
  }

  const assumptionRows = [
    ...assumptionsSeed.assumptions.map((a) => ({ ...a, kind: "assumption" })),
    ...assumptionsSeed.forces.map((f) => ({ ...f, kind: "force" })),
  ].map((a) => ({
    id: randomUUID(),
    statement: a.statement,
    rationale: a.rationale,
    sponsor_seat: "sponsor_seat" in a ? a.sponsor_seat : null,
    confidence: a.confidence,
    status: a.status ?? "holding",
    kind: a.kind,
    history: [],
    illustrative: false,
  }));
  {
    const { error } = await sb.from("assumptions").insert(assumptionRows);
    if (error) throw new Error(`assumptions: ${error.message}`);
    console.log(`assumptions: ${assumptionRows.length}`);
  }

  console.log("Live seed complete. History is empty by design; the pipeline fills it.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
