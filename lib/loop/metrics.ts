/* The learning metrics the operator watches in Settings. Section 10.4. */

import "server-only";
import { supabaseService } from "@/lib/supabase/service";

export interface LearnMetrics {
  actRate: number | null;
  killRate: number | null;
  briefCompletion: number | null;
  missedStories: number | null;
  window: string;
}

export async function learnMetrics(): Promise<LearnMetrics> {
  const sb = supabaseService();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [verdicts, briefEvents, retros, deckCount] = await Promise.all([
    sb
      .from("events")
      .select("type")
      .in("type", ["signal_act", "signal_hold", "signal_kill"])
      .gte("created_at", weekAgo),
    sb.from("events").select("type").in("type", ["brief_play"]).gte("created_at", weekAgo),
    sb
      .from("learn_proposals")
      .select("proposal, week")
      .like("week", "%:retro")
      .order("created_at", { ascending: false })
      .limit(2),
    sb
      .from("signals")
      .select("id", { count: "exact", head: true })
      .eq("illustrative", false)
      .eq("channel", "act")
      .gte("created_at", weekAgo),
  ]);

  const v = verdicts.data ?? [];
  const total = v.length;
  const acts = v.filter((e) => e.type === "signal_act").length;
  const kills = v.filter((e) => e.type === "signal_kill").length;

  const missed = (retros.data ?? []).filter(
    (r) => (r.proposal as { missedUrl?: string | null })?.missedUrl,
  ).length;

  const briefsPlayed = (briefEvents.data ?? []).length;

  return {
    actRate: total > 0 ? Math.round((acts / total) * 100) : null,
    killRate: total > 0 ? Math.round((kills / total) * 100) : null,
    briefCompletion: briefsPlayed > 0 ? Math.min(briefsPlayed, 4) : null,
    missedStories: missed,
    window: `${deckCount.count ?? 0} cards this week`,
  };
}
