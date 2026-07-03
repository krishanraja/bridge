/* RLS audit: an anon client must see zero rows on every table and a
   non-allowlisted address must not receive a code. Run: tsx scripts/audit-rls.ts */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first.");
  process.exit(1);
}

const TABLES = [
  "seats",
  "sources",
  "assumptions",
  "signals",
  "assumption_evidence",
  "priorities",
  "moves",
  "decisions",
  "threads",
  "pulses",
  "briefs",
  "events",
  "receipts",
  "push_subscriptions",
  "audit_log",
  "learn_proposals",
];

async function main() {
  const sb = createClient(url!, anon!);
  let failures = 0;

  for (const t of TABLES) {
    const { data, error } = await sb.from(t).select("*").limit(1);
    if (data && data.length > 0) {
      console.error(`✗ ${t}: anon can read rows`);
      failures++;
    } else {
      console.log(`✓ ${t}: anon sees nothing${error ? " (denied)" : ""}`);
    }
  }

  const writes: [string, object][] = [
    ["decisions", { text: "probe", owner_seat: 1, logged_by: 1 }],
    ["pulses", { iso_week: "2020-W01", seat: 1, priority_id: "00000000-0000-0000-0000-000000000000", confidence: 50 }],
    ["events", { seat: 1, type: "probe" }],
  ];
  for (const [t, row] of writes) {
    const { error } = await sb.from(t).insert(row);
    if (error) {
      console.log(`✓ ${t}: anon write denied`);
    } else {
      console.error(`✗ ${t}: anon write LANDED`);
      failures++;
    }
  }

  const { error: otpErr } = await sb.auth.signInWithOtp({
    email: `probe-${Date.now()}@example.com`,
    options: { shouldCreateUser: true },
  });
  if (otpErr) {
    console.log("✓ non-allowlisted address gets no code");
  } else {
    console.error("✗ non-allowlisted address was sent a code");
    failures++;
  }

  if (failures > 0) {
    console.error(`\nRLS audit failed: ${failures} findings.`);
    process.exit(1);
  }
  console.log("\nRLS audit passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
