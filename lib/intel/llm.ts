/* Model calls for the pipeline. Plain fetch, no SDKs: haiku for the filter,
   sonnet for synthesis, small embeddings for resonance and retrieval. */

import "server-only";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const FILTER_MODEL = "claude-haiku-4-5-20251001";
const SYNTH_MODEL = "claude-sonnet-5";

interface ClaudeParams {
  model?: string;
  system: string;
  user: string;
  maxTokens?: number;
  thinking?: boolean;
  attempts?: number;
  maxBackoffSeconds?: number;
}

export async function claude({
  model = SYNTH_MODEL,
  system,
  user,
  maxTokens = 2000,
  thinking = false,
  attempts = 4,
  maxBackoffSeconds = 60,
}: ClaudeParams): Promise<string> {
  let lastErr = "";
  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      signal: AbortSignal.timeout(45000),
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
        /* Plumbing calls want fast deterministic JSON, not deliberation. */
        ...(thinking ? {} : { thinking: { type: "disabled" } }),
      }),
    }).catch((e) => {
      throw new Error(`anthropic timeout/network: ${(e as Error).message.slice(0, 80)}`);
    });
    if (res.ok) {
      const data = await res.json();
      return (data.content ?? [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("");
    }
    lastErr = `anthropic ${res.status}: ${(await res.text()).slice(0, 160)}`;
    /* Rate limits and transient errors back off; hard errors stop. Interactive
       callers cap the backoff so a room never hangs on a rate limit. */
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Math.min(
        Number(res.headers.get("retry-after")) || 2 ** attempt * 4,
        maxBackoffSeconds,
      );
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }
    break;
  }
  throw new Error(lastErr);
}

/* Run thunks with bounded concurrency; a tier one key cannot take a stampede. */
export async function pool<T>(
  thunks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const out: T[] = new Array(thunks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, thunks.length) }, async () => {
    while (next < thunks.length) {
      const i = next++;
      out[i] = await thunks[i]();
    }
  });
  await Promise.all(workers);
  return out;
}

export const MODELS = { filter: FILTER_MODEL, synth: SYNTH_MODEL };

/* Pull the first JSON value out of a model reply, tolerant of fences. */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error("no JSON in model reply");
  return JSON.parse(body.slice(start)) as T;
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texts }),
  });
  if (!res.ok) {
    throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return data.data.map((d: { embedding: number[] }) => d.embedding);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den === 0 ? 0 : dot / den;
}

export function centroid(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
  const out = new Array(vectors[0].length).fill(0);
  for (const v of vectors) for (let i = 0; i < v.length; i++) out[i] += v[i];
  return out.map((x) => x / vectors.length);
}
