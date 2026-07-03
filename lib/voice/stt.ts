/* Speech to text: gpt-4o-transcribe first, whisper-1 as the fallback.
   The client never holds provider keys; audio arrives here and is not kept. */

import "server-only";

export interface Transcription {
  text: string;
  confidence: number | null;
  model: string;
}

async function callOpenAi(model: string, audio: Blob, filename: string) {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", model);
  if (model === "whisper-1") form.append("response_format", "verbose_json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
  return res.json();
}

export async function transcribe(audio: Blob, filename = "audio.webm"): Promise<Transcription> {
  try {
    const data = await callOpenAi("gpt-4o-transcribe", audio, filename);
    return { text: (data.text ?? "").trim(), confidence: null, model: "gpt-4o-transcribe" };
  } catch {
    const data = await callOpenAi("whisper-1", audio, filename);
    /* Segment-level confidence: mean of exp(avg_logprob) across segments. */
    const segs = (data.segments ?? []) as { avg_logprob?: number }[];
    const confidence =
      segs.length > 0
        ? segs.reduce((s, x) => s + Math.exp(x.avg_logprob ?? -1), 0) / segs.length
        : null;
    return { text: (data.text ?? "").trim(), confidence, model: "whisper-1" };
  }
}
