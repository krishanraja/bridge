/* Gather: GDELT, Hacker News, the RSS allowlist, and Brave, normalized to one
   shape. Every fetch is best effort; a dead source never kills the run. */

import "server-only";
import ontology from "@/supabase/seed/ontology.json";
import type { LaneId } from "@/lib/copy/lanes";
import { LANE_IDS } from "@/lib/copy/lanes";
import type { RawItem, SourceRow } from "./types";

const WINDOW_HOURS = 48;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url: string, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function laneQueries(): Record<LaneId, string[]> {
  const lanes = ontology.lanes as Record<string, { queries: string[] }>;
  const out = {} as Record<LaneId, string[]>;
  for (const id of LANE_IDS) out[id] = lanes[String(id)]?.queries ?? [];
  return out;
}

/* GDELT DOC 2.0 */
async function gatherGdelt(weightOf: (host: string) => { tier: number; weight: number }) {
  const items: RawItem[] = [];
  const queries = laneQueries();
  await Promise.all(
    LANE_IDS.map(async (lane) => {
      const q = queries[lane].slice(0, 4).map((s) => `"${s}"`).join(" OR ");
      const url =
        "https://api.gdeltproject.org/api/v2/doc/doc?query=" +
        encodeURIComponent(`(${q}) sourcelang:english`) +
        "&mode=artlist&format=json&maxrecords=25&timespan=2d";
      try {
        const data = await fetchJson(url);
        for (const a of data.articles ?? []) {
          const w = weightOf(hostOf(a.url));
          items.push({
            title: a.title ?? "",
            url: a.url,
            source: a.domain ?? hostOf(a.url),
            published_at: a.seendate
              ? `${a.seendate.slice(0, 4)}-${a.seendate.slice(4, 6)}-${a.seendate.slice(6, 8)}`
              : null,
            snippet: "",
            laneHint: lane,
            tier: w.tier,
            weight: w.weight,
            engagement: 0,
          });
        }
      } catch {
        /* quiet source */
      }
    }),
  );
  return items;
}

/* Hacker News via Algolia, lanes 2 3 4 */
async function gatherHn(weightOf: (host: string) => { tier: number; weight: number }) {
  const items: RawItem[] = [];
  const since = Math.floor(Date.now() / 1000) - WINDOW_HOURS * 3600;
  const queries: [LaneId, string][] = [
    [2, "Databricks OR Snowflake"],
    [3, "customer data platform OR Segment OR Hightouch"],
    [4, "AI agents enterprise"],
  ];
  await Promise.all(
    queries.map(async ([lane, q]) => {
      try {
        const data = await fetchJson(
          `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=story&numericFilters=created_at_i>${since}&hitsPerPage=20`,
        );
        for (const h of data.hits ?? []) {
          if (!h.url) continue;
          const w = weightOf(hostOf(h.url));
          items.push({
            title: h.title ?? "",
            url: h.url,
            source: hostOf(h.url),
            published_at: h.created_at?.slice(0, 10) ?? null,
            snippet: "",
            laneHint: lane,
            tier: Math.max(w.tier, 2),
            weight: w.weight,
            engagement: Math.min((h.points ?? 0) / 100, 2),
          });
        }
      } catch {
        /* quiet source */
      }
    }),
  );
  return items;
}

/* Minimal RSS and Atom item extraction. */
function parseFeed(xml: string): { title: string; url: string; date: string | null; snippet: string }[] {
  const out: { title: string; url: string; date: string | null; snippet: string }[] = [];
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/\1>/g) ?? [];
  for (const block of blocks.slice(0, 20)) {
    const pick = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
      return m
        ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim()
        : "";
    };
    const linkTag = block.match(/<link[^>]*href="([^"]+)"/i);
    const url = linkTag ? linkTag[1] : pick("link");
    const title = pick("title");
    const date = pick("pubDate") || pick("published") || pick("updated") || null;
    if (title && url) {
      out.push({
        title,
        url,
        date: date ? new Date(date).toISOString() : null,
        snippet: pick("description").slice(0, 300),
      });
    }
  }
  return out;
}

async function gatherRss(sources: SourceRow[]) {
  const items: RawItem[] = [];
  const cutoff = Date.now() - WINDOW_HOURS * 3600 * 1000;
  const feeds = sources.filter((s) => s.kind === "rss" && s.active);
  await Promise.all(
    feeds.map(async (feed) => {
      try {
        const xml = await fetchText(feed.url);
        for (const it of parseFeed(xml)) {
          if (it.date && new Date(it.date).getTime() < cutoff) continue;
          items.push({
            title: it.title,
            url: it.url,
            source: feed.name,
            published_at: it.date?.slice(0, 10) ?? null,
            snippet: it.snippet,
            laneHint: (feed.lane as LaneId | null) ?? null,
            tier: feed.tier,
            weight: Number(feed.weight),
            engagement: 0,
          });
        }
      } catch {
        /* quiet source */
      }
    }),
  );
  return items;
}

/* Brave, one query per lane, throttled to the free tier's pace. */
async function gatherBrave(weightOf: (host: string) => { tier: number; weight: number }) {
  const items: RawItem[] = [];
  const key = process.env.BRAVE_API_KEY;
  if (!key) return items;
  const queries = laneQueries();
  for (const lane of LANE_IDS) {
    const q = queries[lane][0];
    if (!q) continue;
    try {
      const data = await fetchJson(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&freshness=pw&count=8`,
        { headers: { "X-Subscription-Token": key, Accept: "application/json" } },
      );
      for (const r of data.web?.results ?? []) {
        const w = weightOf(hostOf(r.url));
        items.push({
          title: r.title ?? "",
          url: r.url,
          source: hostOf(r.url),
          published_at: null,
          snippet: (r.description ?? "").replace(/<[^>]+>/g, "").slice(0, 300),
          laneHint: lane,
          tier: w.tier,
          weight: w.weight,
          engagement: 0,
        });
      }
    } catch {
      /* quiet source */
    }
    await new Promise((r) => setTimeout(r, 1100));
  }
  return items;
}

export async function gather(sources: SourceRow[]): Promise<RawItem[]> {
  const byHost = new Map<string, { tier: number; weight: number }>();
  for (const s of sources) {
    if (s.kind !== "rss") continue;
    byHost.set(hostOf(s.url), { tier: s.tier, weight: Number(s.weight) });
  }
  const weightOf = (host: string) => byHost.get(host) ?? { tier: 1, weight: 1.0 };

  const [gdelt, hn, rss, brave] = await Promise.all([
    gatherGdelt(weightOf),
    gatherHn(weightOf),
    gatherRss(sources),
    gatherBrave(weightOf),
  ]);
  const all = [...gdelt, ...hn, ...rss, ...brave].filter(
    (i) => i.title.length > 12 && i.url.startsWith("http"),
  );
  /* Drop our own domain and dedupe exact URLs. */
  const seen = new Set<string>();
  return all.filter((i) => {
    const key = i.url.replace(/[?#].*$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
