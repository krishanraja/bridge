/* Nightly TTS pre-render so morning playback is instant. Best effort: if the
   voice provider is down or unconfigured, the brief still ships as text. */

import "server-only";
import { speak } from "@/lib/voice/tts";
import { supabaseService } from "@/lib/supabase/service";

export async function prerenderBrief(day: string, kind: "morning" | "close") {
  const sb = supabaseService();
  const { data: brief } = await sb
    .from("briefs")
    .select("script")
    .eq("day", day)
    .eq("kind", kind)
    .maybeSingle();
  if (!brief) return { ok: false, reason: "no brief" };

  /* Speak the words, not the reference codes. */
  const spoken = brief.script.replace(/\[[A-Z]\d+\]/g, "").replace(/\s+/g, " ").trim();
  try {
    const { path } = await speak(spoken);
    await sb.from("briefs").update({ audio_path: path }).eq("day", day).eq("kind", kind);
    return { ok: true, path };
  } catch (e) {
    return { ok: false, reason: (e as Error).message.slice(0, 120) };
  }
}
