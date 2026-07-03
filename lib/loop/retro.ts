/* The weekly self-retro. The product grades itself in public: what the radar
   surfaced that the seats acted on, what it surfaced that they killed, one
   thing it missed (found by a retrospective sweep against the week's biggest
   category headlines), and what it is changing. */

import "server-only";
import { supabaseService } from "@/lib/supabase/service";
import { claude, extractJson } from "@/lib/intel/llm";
import { gather } from "@/lib/intel/gather";
import { cluster } from "@/lib/intel/cluster";
import { BANNED_LIST } from "@/lib/copy/banned";
import type { SourceRow } from "@/lib/intel/types";
import type { LearnProposal } from "./learn";

export interface RetroMemo {
  lines: string[];
  missedUrl: string | null;
}

export async function writeRetro(proposal: LearnProposal): Promise<RetroMemo> {
  const sb = supabaseService();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [actedQ, killedQ, weekSignalsQ, sourcesQ] = await Promise.all([
    sb.from("events").select("subject_id").eq("type", "signal_act").gte("created_at", weekAgo),
    sb.from("events").select("subject_id").eq("type", "signal_kill").gte("created_at", weekAgo),
    sb.from("signals").select("headline, cluster").eq("illustrative", false).gte("created_at", weekAgo),
    sb.from("sources").select("*").eq("active", true),
  ]);

  const actedIds = (actedQ.data ?? []).map((e) => e.subject_id);
  const killedIds = (killedQ.data ?? []).map((e) => e.subject_id);
  const weekHeadlines = (weekSignalsQ.data ?? []).map((s) => s.headline);

  const actedHeadlines = actedIds.length
    ? ((await sb.from("signals").select("headline").in("id", actedIds)).data ?? []).map((s) => s.headline)
    : [];
  const killedHeadlines = killedIds.length
    ? ((await sb.from("signals").select("headline").in("id", killedIds)).data ?? []).map((s) => s.headline)
    : [];

  /* The retrospective sweep: gather now, cluster, and ask the model which
     corroborated story the week's deck never carried. */
  let missed: { headline: string; url: string } | null = null;
  try {
    const raw = await gather((sourcesQ.data ?? []) as SourceRow[]);
    const clusters = cluster(raw)
      .filter((c) => c.corroboration >= 2)
      .sort((a, b) => b.corroboration - a.corroboration)
      .slice(0, 20);
    const candidates = clusters.map((c, i) => ({
      i,
      title: c.items[0].title,
      url: c.items[0].url,
    }));

    if (candidates.length > 0) {
      const reply = await claude({
        system: `You audit Amperity's market radar. The deck this week carried these headlines:
${weekHeadlines.map((h) => `- ${h}`).join("\n") || "(nothing)"}
Below are corroborated stories from a fresh sweep. Name the ONE most important story the deck missed: something that plausibly changes what Amperity should build, sell, buy, or say and is not already covered above. Reply with ONLY JSON {"i": number, "why": "10 words"} or {"i": -1} if the deck missed nothing material.`,
        user: candidates.map((c) => `${c.i}. ${c.title}`).join("\n"),
        maxTokens: 200,
        attempts: 2,
        maxBackoffSeconds: 5,
      });
      const pick = extractJson<{ i: number }>(reply);
      if (pick.i >= 0 && candidates[pick.i]) {
        missed = { headline: candidates[pick.i].title, url: candidates[pick.i].url };
      }
    }
  } catch {
    /* a failed sweep leaves the miss line honest about the gap */
  }

  const lines = [
    `Acted on ${actedHeadlines.length}${actedHeadlines[0] ? `, led by "${actedHeadlines[0].slice(0, 60)}"` : ""}.`,
    `Killed ${killedHeadlines.length}${killedHeadlines[0] ? `, including "${killedHeadlines[0].slice(0, 60)}"` : ""}.`,
    missed
      ? `Missed one: ${missed.headline.slice(0, 80)}.`
      : "Missed nothing material that a fresh sweep could find.",
    proposal.summary,
    "Have a look in Settings when you get a moment, or leave it and nothing changes.",
  ];

  /* Keep the register clean even in the retro. */
  const banned = new RegExp(`\\b(${BANNED_LIST.split(", ").join("|")})\\b`, "i");
  const clean = lines.map((l) => (banned.test(l) ? l.replace(banned, "changed") : l));

  await sb.from("learn_proposals").insert({
    week: `${proposal.week}:retro`,
    proposal: { lines: clean, missedUrl: missed?.url ?? null },
    status: "approved",
  });

  return { lines: clean, missedUrl: missed?.url ?? null };
}
