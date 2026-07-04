# BRIDGE

The fifth seat at the leadership table. A phone-first, voice-first, no-scroll
instrument for a four-person leadership team: the market move, the priorities,
one move per priority per week, and where the table disagrees, in ninety
seconds a day — and an app that **learns from every leader's feedback**.

Built by Mindmaker. Amperity is design partner one.

## The rooms

**Today, Radar, Priorities, Table, Ask.** Plus the Assumption Ledger one tap
from Radar, and Settings. Every authenticated screen fits the viewport; depth is
a tap, never a scroll.

- **Today** — the ~90-second morning brief (audio + text), today's focus, the week's moves.
- **Radar** — the market signal deck: swipe through cards, filter by lane, Act/Hold/Kill, and give quick 👍/👎 feedback with reason chips. The deck re-ranks to what each leader cares about.
- **Priorities** — the 3–5 live priorities, each with a confidence dial and this week's move.
- **Table** — alignment (where the table agrees), decisions with per-decision "who's seen it / who concurred" receipts and a consensus read, and the weekly pulse.
- **Ask** — a voice/text assistant grounded in the house's own data.

## Learns from feedback

A universal, haptic feedback primitive (thumbs + intelligent reason chips)
feeds an attributed store. From it the app derives **per-leader taste** (the
radar personalizes), **team consensus** (surfaced on decisions), and a **team
knowledge graph** of market themes (importance × agreement). Learned signals
also self-heal the pipeline's scoring — operator-gated.

## Stack

Next.js 15 PWA on Vercel. Supabase (Postgres, RLS, Realtime, Storage,
pgvector). Anthropic for reasoning, OpenAI for transcription and embeddings,
ElevenLabs for the office voice. GDELT, Hacker News, a curated RSS allowlist,
and Brave Search feed the radar.

## Documentation

- **[`AGENTS.md`](AGENTS.md)** — start here: how to run, verify, and work on the
  app safely (for humans and AI agents). Mirrored at [`CLAUDE.md`](CLAUDE.md).
- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** — the exhaustive,
  component-by-component reference: every route, component, module, table, and
  invariant.
- **[`docs/RUNBOOK.md`](docs/RUNBOOK.md)** — operating the app.
- **[`docs/DECISIONS.md`](docs/DECISIONS.md)** — decisions made during the build.
- **[`docs/DEMO.md`](docs/DEMO.md)** — the boardroom demo script.

## Running it

```bash
pnpm install
DEMO_MODE=true pnpm dev      # local preview on seed data, no database or auth
```

See [`AGENTS.md`](AGENTS.md) and [`docs/RUNBOOK.md`](docs/RUNBOOK.md) for full
setup, environment variables, and the seed/migration workflow.
