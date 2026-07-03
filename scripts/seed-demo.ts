/* Loads the demo dataset: ontology, assumptions, and fourteen days of clearly
   illustrative history. Run: pnpm seed:demo
   Wipes existing rows first; demo and live data never mix. */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import ontology from "../supabase/seed/ontology.json";
import assumptionsSeed from "../supabase/seed/assumptions.json";
import signalsSeed from "../supabase/seed/demo/signals.json";
import prioritiesSeed from "../supabase/seed/demo/priorities.json";
import decisionsSeed from "../supabase/seed/demo/decisions.json";
import pulsesSeed from "../supabase/seed/demo/pulses.json";
import briefsSeed from "../supabase/seed/demo/briefs.json";
import threadsSeed from "../supabase/seed/demo/threads.json";
import receiptsSeed from "../supabase/seed/demo/receipts.json";
import historySeedJson from "../supabase/seed/demo/assumption_history.json";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

function dayISO(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
function ts(offset: number, hour = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function isoWeekOf(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
function weekShift(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset * 7);
  return isoWeekOf(d);
}

async function wipe() {
  /* Reverse dependency order. */
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
    const col = table === "receipts" ? "seen_at" : "created_at";
    const { error } = await sb.from(table).delete().gte(col, "1970-01-01");
    if (error) console.warn(`wipe ${table}: ${error.message}`);
  }
}

async function seedSeats() {
  const emails = (process.env.SEAT_ALLOWLIST ?? "").split(",").map((e) => e.trim().toLowerCase());
  const names = ["Kabir Shahani", "Derek Slager", "Amy Pelly", "Krish Raja"];
  const roles = ["principal", "principal", "principal", "operator"];
  for (let i = 0; i < 4; i++) {
    const { error } = await sb.from("seats").upsert(
      {
        id: i + 1,
        email: emails[i] || null,
        name: names[i],
        role: roles[i],
        lane_order: null,
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(`seats: ${error.message}`);
  }
  console.log("seats: 4");
}

async function seedSources() {
  const rows = (ontology.sources as {
    name: string; kind: string; url: string; lane: number | null; tier: number;
  }[]).map((s) => ({ ...s, weight: 1.0, active: true }));
  const { error } = await sb.from("sources").insert(rows);
  if (error) throw new Error(`sources: ${error.message}`);
  console.log(`sources: ${rows.length}`);
}

async function main() {
  console.log("Wiping existing rows.");
  await wipe();
  await seedSeats();
  await seedSources();

  /* Assumptions and forces */
  const assumptionIds = new Map<string, string>();
  const history = historySeedJson as unknown as Record<string, [number, number][]>;
  const assumptionRows = [
    ...assumptionsSeed.assumptions.map((a) => ({ ...a, kind: "assumption" })),
    ...assumptionsSeed.forces.map((f) => ({ ...f, kind: "force" })),
  ].map((a) => {
    const id = randomUUID();
    assumptionIds.set(a.key, id);
    return {
      id,
      statement: a.statement,
      rationale: a.rationale,
      sponsor_seat: "sponsor_seat" in a ? a.sponsor_seat : null,
      confidence: a.confidence,
      status: a.status ?? "holding",
      kind: a.kind,
      history: (history[a.key] ?? []).map(([off, conf]) => ({
        day: dayISO(off),
        confidence: conf,
      })),
      created_at: ts(-90),
      illustrative: false,
    };
  });
  {
    const { error } = await sb.from("assumptions").insert(assumptionRows);
    if (error) throw new Error(`assumptions: ${error.message}`);
    console.log(`assumptions: ${assumptionRows.length}`);
  }

  /* Signals and evidence */
  const signalRows = signalsSeed.map((s) => ({
    id: randomUUID(),
    day: dayISO(s.day_offset),
    lane: s.lane,
    headline: s.headline,
    for_amperity: s.for_amperity,
    posture: s.posture ?? null,
    score: s.score,
    corroboration: s.corroboration,
    cluster: s.cluster.map((c) => ({ ...c, published_at: dayISO(s.day_offset) })),
    assumption_id: s.assumption_key ? assumptionIds.get(s.assumption_key) : null,
    assumption_direction: s.assumption_direction ?? null,
    created_at: ts(s.day_offset, 6),
    illustrative: true,
  }));
  {
    const { error } = await sb.from("signals").insert(signalRows);
    if (error) throw new Error(`signals: ${error.message}`);
    console.log(`signals: ${signalRows.length}`);
  }
  const evidenceRows = signalsSeed
    .map((s, i) => ({ s, row: signalRows[i] }))
    .filter(({ s }) => s.assumption_key && s.assumption_direction)
    .map(({ s, row }) => ({
      assumption_id: assumptionIds.get(s.assumption_key!),
      signal_id: row.id,
      direction: s.assumption_direction,
      weight: s.assumption_weight || 1,
      created_at: row.created_at,
    }));
  {
    const { error } = await sb.from("assumption_evidence").insert(evidenceRows);
    if (error) throw new Error(`assumption_evidence: ${error.message}`);
    console.log(`assumption_evidence: ${evidenceRows.length}`);
  }

  /* Priorities and moves */
  const priorityIds = new Map<string, string>();
  for (const p of prioritiesSeed) {
    const id = randomUUID();
    priorityIds.set(p.key, id);
    const { error } = await sb.from("priorities").insert({
      id,
      name: p.name,
      sponsor_seat: p.sponsor_seat,
      state: p.state,
      display_order: p.display_order,
      blocker: p.blocker,
      blocker_owner_seat: p.blocker_owner_seat,
      created_at: ts(-30),
      illustrative: true,
    });
    if (error) throw new Error(`priorities: ${error.message}`);
    const moves = p.moves.map((m) => ({
      priority_id: id,
      iso_week: weekShift(m.week_offset),
      text: m.text,
      owner_seat: m.owner_seat,
      state: m.state,
      outcome_note: (m as { outcome_note?: string }).outcome_note ?? null,
      created_at: ts(m.week_offset * 7),
    }));
    const mv = await sb.from("moves").insert(moves);
    if (mv.error) throw new Error(`moves: ${mv.error.message}`);
  }
  console.log(`priorities: ${prioritiesSeed.length} with moves`);

  /* Decisions */
  const decisionRows = decisionsSeed.map((d) => ({
    text: d.text,
    owner_seat: d.owner_seat,
    due_date: d.due_in_days != null ? dayISO(d.due_in_days) : null,
    state: d.state,
    logged_by: d.logged_by,
    logged_via: d.logged_via,
    transcript: d.transcript ?? null,
    created_at: ts(d.day_offset, 15),
    illustrative: true,
  }));
  {
    const { error } = await sb.from("decisions").insert(decisionRows);
    if (error) throw new Error(`decisions: ${error.message}`);
    console.log(`decisions: ${decisionRows.length}`);
  }

  /* Pulses */
  const pulseRows = pulsesSeed.map((p) => ({
    iso_week: weekShift(p.week_offset),
    seat: p.seat,
    priority_id: priorityIds.get(p.priority_key),
    confidence: p.confidence,
    created_at: ts(p.week_offset * 7, 8),
  }));
  {
    const { error } = await sb.from("pulses").insert(pulseRows);
    if (error) throw new Error(`pulses: ${error.message}`);
    console.log(`pulses: ${pulseRows.length}`);
  }

  /* Briefs */
  for (const b of briefsSeed) {
    const { error } = await sb.from("briefs").insert({
      day: dayISO(b.day_offset),
      kind: b.kind,
      script: b.script,
      released_at: ts(b.day_offset, 7),
      edited_by_operator: false,
    });
    if (error) throw new Error(`briefs: ${error.message}`);
  }
  console.log(`briefs: ${briefsSeed.length}`);

  /* Threads */
  const threadRows = threadsSeed.map((t) => ({
    name: t.name,
    org: t.org,
    seat_owner: t.seat_owner,
    next_touch_date: t.next_touch_in_days != null ? dayISO(t.next_touch_in_days) : null,
    next_touch_note: t.next_touch_note ?? null,
    last_touch_date: t.last_touch_days_ago != null ? dayISO(-t.last_touch_days_ago) : null,
    status: t.status,
    linked_priority_id: t.linked_priority_key ? priorityIds.get(t.linked_priority_key) : null,
    created_at: ts(-30),
  }));
  {
    const { error } = await sb.from("threads").insert(threadRows);
    if (error) throw new Error(`threads: ${error.message}`);
    console.log(`threads: ${threadRows.length}`);
  }

  /* Receipts: today's brief, this week's pulse */
  const day = dayISO(0);
  const week = weekShift(0);
  const receiptRows: object[] = [];
  for (const r of receiptsSeed) {
    if (r.brief) receiptRows.push({ seat: r.seat, artifact_type: "brief", artifact_id: day });
    if (r.pulse) receiptRows.push({ seat: r.seat, artifact_type: "pulse", artifact_id: week });
  }
  {
    const { error } = await sb.from("receipts").insert(receiptRows);
    if (error) throw new Error(`receipts: ${error.message}`);
    console.log(`receipts: ${receiptRows.length}`);
  }

  console.log("Demo seed complete. Every historical row is marked illustrative.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
