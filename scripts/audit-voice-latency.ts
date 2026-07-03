/* Voice latency audit. Budgets (brief 9.2): release to first streamed text
   under 1.8s p50; to first audio under 3.5s p50. This measures the server
   legs: transcription time and ask time-to-first-token, over 10 runs, plus
   one end to end decision utterance correctness check.
   Run: BASE_URL=http://localhost:3100 tsx scripts/audit-voice-latency.ts */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const REF = new URL(url).hostname.split(".")[0];
const RUNS = Number(process.env.RUNS ?? 10);

function p50(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function mintCookie(): Promise<string> {
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "krish@themindmaker.ai",
  });
  if (error) throw error;
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data: v, error: vErr } = await sb.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "email",
  });
  if (vErr) throw vErr;
  const value = "base64-" + Buffer.from(JSON.stringify(v.session)).toString("base64url");
  return `sb-${REF}-auth-token=${value}`;
}

/* A spoken fixture from OpenAI TTS so the loop tests real speech. */
async function makeFixture(text: string): Promise<Blob> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "alloy", input: text }),
  });
  if (!res.ok) throw new Error(`fixture tts ${res.status}`);
  return new Blob([await res.arrayBuffer()], { type: "audio/mpeg" });
}

async function main() {
  const cookie = await mintCookie();
  const utterance =
    "Log a decision: we run the lakehouse partner review this quarter. Derek owns it, due September thirtieth.";
  const fixture = await makeFixture(utterance);
  writeFileSync("/tmp/voice-fixture.mp3", Buffer.from(await fixture.arrayBuffer()));
  console.log(`fixture: ${Math.round(fixture.size / 1024)}kb of spoken audio\n`);

  /* Leg one: transcription. */
  const sttTimes: number[] = [];
  let lastText = "";
  for (let i = 0; i < RUNS; i++) {
    const form = new FormData();
    form.append("audio", fixture, "fixture.mp3");
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/voice/transcribe`, {
      method: "POST",
      headers: { cookie },
      body: form,
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      console.error(`stt run ${i}: HTTP ${res.status}`);
      continue;
    }
    const data = (await res.json()) as { text: string; model: string };
    lastText = data.text;
    sttTimes.push(ms);
    console.log(`stt run ${i}: ${ms}ms (${data.model})`);
  }
  console.log(`\ntranscription p50: ${p50(sttTimes)}ms`);
  console.log(`heard: "${lastText.slice(0, 90)}"\n`);

  /* Leg two: ask time to first token. */
  const askTimes: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/ask`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ q: "Where do we disagree this week?" }),
    });
    if (!res.ok || !res.body) {
      console.error(`ask run ${i}: HTTP ${res.status}`);
      continue;
    }
    const reader = res.body.getReader();
    await reader.read();
    const ms = Date.now() - t0;
    askTimes.push(ms);
    /* Drain to completion; canceling mid-stream poisons the kept-alive socket
       in this harness, which a browser client never does. */
    for (;;) {
      const { done } = await reader.read();
      if (done) break;
    }
    console.log(`ask run ${i}: first token ${ms}ms`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log(`\nask first-token p50: ${p50(askTimes)}ms`);

  /* End to end: does the decision utterance route with the right owner and date. */
  const res = await fetch(`${BASE}/api/ask`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ q: lastText || utterance }),
  });
  const body = (await res.json()) as {
    intent?: { kind: string; owner_seat?: number; due_date?: string; text?: string };
  };
  const it = body.intent;
  const ownerOk = it?.owner_seat === 2;
  const dateOk = (it?.due_date ?? "").endsWith("-09-30");
  console.log(`\ndecision utterance -> intent=${it?.kind} owner=${it?.owner_seat} due=${it?.due_date}`);
  console.log(`owner is Derek: ${ownerOk ? "PASS" : "FAIL"}; due end of September: ${dateOk ? "PASS" : "FAIL"}`);

  const sttOk = p50(sttTimes) < 1800;
  const askOk = p50(askTimes) < 1800;
  console.log(`\nbudgets: transcription p50 ${sttOk ? "within" : "OVER"}, ask first token p50 ${askOk ? "within" : "OVER"}`);
  process.exit(it?.kind === "log_decision" && ownerOk && dateOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
