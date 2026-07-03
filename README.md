# BRIDGE

The fifth seat at the leadership table. A phone-first, voice-first, no-scroll
instrument for a four person leadership team: the market move, the priorities,
one move per priority per week, and where the table disagrees, in ninety
seconds a day.

Built by Mindmaker. Amperity is design partner one.

## The five rooms

Today, Radar, Priorities, Table, Ask. Plus the Assumption Ledger one tap from
Radar. Every authenticated screen fits the viewport; depth is a tap, never a
scroll.

## Stack

Next.js 15 PWA on Vercel. Supabase (Postgres, RLS, Realtime, Storage,
pgvector). Anthropic for reasoning, OpenAI for transcription and embeddings,
ElevenLabs for the office voice. GDELT, Hacker News, a curated RSS allowlist,
and Brave Search feed the radar.

## Running it

See `docs/RUNBOOK.md`. Build gates and their acceptance checks live in the
product brief; decisions made during the build are in `docs/DECISIONS.md`;
the boardroom demo script is in `docs/DEMO.md`.
