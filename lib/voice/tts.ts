/* Text to speech: one neutral office voice, cached by content hash in the
   private audio bucket, served by short lived signed URLs. */

import "server-only";
import { createHash } from "node:crypto";
import { supabaseService } from "@/lib/supabase/service";

const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

export async function speak(text: string): Promise<{ url: string; path: string }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("voice is not configured");
  const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;

  const hash = createHash("sha256").update(`${voice}:${text}`).digest("hex").slice(0, 32);
  const path = `tts/${hash}.mp3`;
  const sb = supabaseService();

  const cached = await sb.storage.from("audio").createSignedUrl(path, 600);
  if (cached.data?.signedUrl) return { url: cached.data.signedUrl, path };

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.7 },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`elevenlabs ${res.status}: ${(await res.text()).slice(0, 120)}`);
  }
  const audio = Buffer.from(await res.arrayBuffer());

  const up = await sb.storage
    .from("audio")
    .upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  if (up.error) throw new Error(`storage: ${up.error.message}`);

  const signed = await sb.storage.from("audio").createSignedUrl(path, 600);
  if (!signed.data?.signedUrl) throw new Error("could not sign audio url");
  return { url: signed.data.signedUrl, path };
}
