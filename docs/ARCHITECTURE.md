# Bridge — Architecture & Component Reference

This document explains **what every component of Bridge is and does**, for a
reader (human or AI agent) with zero prior context. It is the map of the whole
system. For working conventions and safety rules, read [`/AGENTS.md`](../AGENTS.md)
first; for operations, [`RUNBOOK.md`](./RUNBOOK.md); for the reasoning behind
choices, [`DECISIONS.md`](./DECISIONS.md).

---

## 1. What Bridge is

Bridge is a **phone-first leadership instrument** for a fixed four-person
executive team (the "table"). Every day it gives them, in about ninety seconds:
the market moves that matter, the live priorities, one move per priority per
week, where the table (dis)agrees, and a voice assistant. It also **learns from
their feedback** — what each leader finds important, what the table agrees on —
and re-ranks itself accordingly.

The four seats are fixed and hard-allowlisted (`lib/seats.ts`): three principals
and one **operator** (seat 4), who has curation powers the principals don't.

**Mental model:** the app is a small set of full-screen "rooms" reached by a
bottom tab bar. A server-side data layer shapes database rows into view models;
a background intelligence pipeline fills the database with market signals; a
learning layer turns user reactions into personalization and a knowledge graph.

---

## 2. Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router, RSC), React 19, TypeScript |
| Styling | Tailwind CSS **v4** (config-in-CSS; there is **no** `tailwind.config`) |
| Package manager | pnpm |
| Database / auth / realtime / storage | Supabase (Postgres 17, RLS, Realtime, Storage, pgvector) |
| Reasoning LLM | Anthropic (Claude) — briefs, filtering, synthesis, intent |
| Embeddings / transcription | OpenAI (embeddings, `gpt-4o-transcribe`/`whisper-1`) |
| Voice (TTS) | ElevenLabs, cached in a private bucket |
| Market sources | GDELT, Hacker News, a curated RSS allowlist, Brave Search |
| Hosting | Vercel (cron drives the weekly loop) |
| PWA | `app/manifest.ts` + `public/sw.js`; installable, offline shell |

Path alias: `@/*` → repo root (e.g. `@/components/...`).

---

## 3. Runtime & rendering model (read this — it is unusual)

Three deliberate, load-bearing decisions govern layout. Break them and the app
looks broken.

1. **Root-zoom to a 412px design canvas.** A blocking head script in
   `app/layout.tsx` sets `document.documentElement.style.zoom = min(2.6,
   innerWidth / 412)`. The entire UI is designed at a **412px width** and scaled
   to fill the real viewport. Consequence: every fixed pixel value scales as one.
   Because CSS `zoom` multiplies viewport units, the CSS avoids `dvh`/`vw` and
   uses percentages (`app/globals.css`).

2. **The page never scrolls.** `html, body { overflow: hidden; height: 100% }`.
   Rooms fit the viewport; depth is a tap (a bottom `Sheet`), never a page
   scroll. This invariant is enforced by `scripts/audit-noscroll.ts`
   (`pnpm audit:noscroll`) at 390×844, 430×932, 1280×800.

3. **`.room-canvas` distributes space; it does not clip.** Each room's content
   lives in a `.room-canvas` (`app/globals.css`): a flex column at natural
   height with a consistent vertical rhythm (`--space-5` between sections). On a
   normal phone content is shorter than the room, so nothing scrolls (invariant
   #2 holds). On a short device it scrolls **inside the canvas** as a safety
   valve — the document itself still never scrolls, so the audit still passes.
   The radar deck is the one intentional exception: it is a vertical
   scroll-snap pager (`.snap-pager` / `.snap-page`).

The shell is `components/rooms/AppShell.tsx`: a two-row grid of
`<main class="room">{children}</main>` + `<TabBar/>`, wrapped around every
authenticated route by `app/(rooms)/layout.tsx`.

---

## 4. Directory map

```
app/                Next.js App Router: routes, API handlers, layouts
  (auth)/login/     Magic-link login (own route group, no shell)
  (rooms)/          The five tab rooms; share AppShell + TabBar
  ledger/           Assumption Ledger (reached from Radar header, not the tab bar)
  settings/         Settings, learning readout, threads, audit
  api/              Route handlers (pipeline, loop, voice, brief, ask, push, learn)
  actions.ts        ALL server actions (the write paths)
  layout.tsx        Root layout: fonts, root-zoom + night + service-worker scripts
  globals.css       Design tokens, type/space scales, layout laws, utilities
components/
  rooms/            One component per room + shared room pieces
  ui/               Shared primitives (Card, Button, Chip, Sheet, Avatar, Reaction, ...)
  dial/             The Dial (the signature confidence meter)
  auth/             Login form
lib/
  data/             The data layer rooms talk to (index → demo | db → derive → views)
  intel/            The market intelligence pipeline (gather → ... → write)
  learn/            The learning layer (affinity, reflection, themes)
  loop/             The weekly/daily scheduled beats (compose, drift, learn, retro, decay, ...)
  ledger/           Assumption-confidence arithmetic
  voice/            Speech-to-text, text-to-speech, intent routing
  ground/           Retrieval/grounding for the Ask room
  push/             Web Push (rationed)
  copy/             Fixed vocabularies: lanes, states, reasons, voice, styles, banned words
  supabase/         Three Supabase clients: browser, server (RLS), service (bypass)
  seats.ts          The four seats + email allowlist
  types.ts          Domain row types (mirror the DB)
  mode.ts weeks.ts haptics.ts auth.ts   Small shared utilities
supabase/
  migrations/       SQL migrations (source of truth for the schema)
  seed/             ontology.json (sources + lane queries), assumptions, demo/*.json
scripts/            seed-demo, seed-live, gen-icons, and the audits
docs/               This file, RUNBOOK, DECISIONS, DEMO
middleware.ts       Session refresh + auth front door (skipped in demo mode)
```

---

## 5. Routes & rooms

All five tab rooms are `export const dynamic = "force-dynamic"` and gate on
`currentSeat()` (redirect to `/login`). Nav is defined in
`components/rooms/TabBar.tsx`.

| Tab | Route | Page | Room component | What it is |
|---|---|---|---|---|
| Today | `/today` | `app/(rooms)/today/page.tsx` | `BriefBlock` | The morning read: a ~90-second audio+text brief, today's focus, the week's moves. |
| Radar | `/radar` | `app/(rooms)/radar/page.tsx` | `Deck` | The market signal deck: swipeable cards, lane filter, Act/Hold/Kill, and the feedback primitive. |
| Priorities | `/priorities` | `app/(rooms)/priorities/page.tsx` | `PriorityBoard` | The 3–5 live priorities; each with a confidence dial and this week's move. |
| Table | `/table` | `app/(rooms)/table/page.tsx` | `TableRoom` | The multiplayer room: alignment plot, decisions with per-decision receipts/consensus, weekly pulse. |
| Ask | `/ask` | `app/(rooms)/ask/page.tsx` | `AskRoom` | Voice/text assistant grounded in the house's own data. |

Non-tab routes:

- `/ledger` (`app/ledger/`, `components/rooms/LedgerDeck.tsx`) — the **Assumption
  Ledger**: one belief per viewport, its confidence, evidence, and (now) a
  reaction. Reached via an icon in the Radar header.
- `/settings` (`app/settings/`) — seats, what's running, the operator's weekly
  **learning review**, learning metrics, **"What Bridge is learning"** and
  **"What the market's doing"** readouts, push toggle, threads, audit trail.
- `/login` (`app/(auth)/login/`) — magic-link login.
- Root `app/page.tsx` redirects into the app; `error.tsx`, `not-found.tsx`,
  `loading.tsx`, `manifest.ts`, `icon.png` are standard Next files.

### API route handlers (`app/api/`)

| Route | Purpose |
|---|---|
| `pipeline/run` | Runs the intel pipeline (`lib/intel/run.ts`) — the radar "Run a sweep now". |
| `loop` | The scheduled beats, selected by `?step=` (see §10). Cron-authorized. |
| `brief/{compose,edit,release}` | Compose the morning brief, operator edits, release it. |
| `ask` | The Ask assistant turn (grounded answer). |
| `voice/{speak,transcribe}` | TTS and STT endpoints. |
| `learn/decide` | Operator approves/skips a staged learning proposal. |
| `push/subscribe` | Register a Web Push subscription. |

---

## 6. Components

### Shared primitives (`components/ui/`)

| Component | What it is |
|---|---|
| `Card.tsx` | The one card surface: paper background, hairline, soft elevation, optional 3px colored left `accent`. |
| `Button.tsx` | The one button: `primary` (ink) / `secondary` (outline) / `ghost`, sizes `sm`/`md`, pill radius. |
| `Chip.tsx` | The universal pill/badge/filter. Renders `<button>` if `onClick`, else `<span>`. |
| `Sheet.tsx` | The bottom-sheet modal — the app's single "depth is a tap" pattern. |
| `SectionLabel.tsx` | An eyebrow label + optional right-slot actions; the header row of most cards. |
| `Avatar.tsx` | A seat's initials in a state ring: unseen / seen / concurred (mint) / feedback (amber). |
| `Reaction.tsx` | **The universal feedback primitive.** Thumb up/down (haptic) + context-aware reason chips. Drops onto any subject. See §9. |

### The Dial (`components/dial/Dial.tsx`)

The signature confidence meter: a 270° SVG arc with a Space-Grotesk numeral,
in three sizes (`hero` 192px / `standard` 74px / `micro` 38px). Arc turns
`--risk` red below 35. Used on Priorities, the Ledger, and Today.

### Room components (`components/rooms/`)

| Component | Room / role |
|---|---|
| `AppShell.tsx` | The frame: content region + fixed `TabBar`. |
| `TabBar.tsx` | The five-tab bottom nav with hand-drawn SVG icons. |
| `BriefBlock.tsx` | Today's audio brief: a large play button, text-twin sheet, citation chips. |
| `Deck.tsx` | Radar: the snap-paged signal deck, lane filter, Act/Hold/Kill, `Reaction`, a per-seat "learned" banner, the sweep/skeleton loading experience, and a vertical page rail. |
| `PriorityBoard.tsx` | Priorities: the list → detail card, this-week's-move editor, blockers, sponsor, history/links sheet. |
| `TableRoom.tsx` | Table: the `AlignmentPlot` scatter (confidence × spread), decisions list + `DecisionDetailSheet` (per-decision Seen/Concurred/Feedback + consensus read), the weekly `PulseSheet`, the decision log. |
| `AskRoom.tsx` | Ask: a large hold-to-talk button, streaming grounded answer, citation chips, a phase state machine. |
| `LedgerDeck.tsx` | Ledger: one belief per viewport with confidence dial, sparkline, evidence, vote, and `Reaction`. |
| `LearnReview.tsx` | The operator's Sunday review of a staged learning proposal (approve / skip). |
| `PresenceDots.tsx` | A four-dot presence strip (mint = seat present today) over Supabase Realtime. |
| `ThreadsManager.tsx` | The operator's relationships desk (threads linked to priorities). |
| `ReviewCard.tsx` | Operator-only draft-brief review/release card. |
| `PushToggle.tsx`, `SignOutButton.tsx`, `RoomHeader.tsx` | Push opt-in, sign out, standard room header. |

---

## 7. Design system (`app/globals.css`)

All theming is CSS custom properties bridged to Tailwind via `@theme inline`
(Tailwind v4). Key token groups:

- **Color:** `--bg --paper --ink --ink-2 --ink-3 --line`; the single accent
  `--mint` (+ `--mint-deep --mint-wash --mint-bd`); `--risk` (+ wash);
  `--amber` (+ wash/bd, the "feedback" meaning); eight muted **lane hues**
  `--lane-1 … --lane-8`.
- **Night variant:** `:root[data-night="1"]` (auto 21:00–06:00 via a head
  script). Not a `prefers-color-scheme` toggle.
- **Type scale:** tokens `--t-display … --t-label` + utility classes
  `.t-display .t-title .t-headline .t-lede .t-body .t-secondary .t-label`, plus
  `.eyebrow` and `.num-display`.
- **Spacing / radius / elevation:** `--space-1 … --space-8`, `--pad-x` (the one
  canonical room inset), `--r-sm/md/lg/pill`, and `--elev-card`.
- **Layout classes:** `.app-shell .room .room-canvas .tabbar .snap-pager
  .snap-page`.

Fonts: Inter (`--font-body`), Space Grotesk (`--font-display`), via
`next/font` in `app/layout.tsx`.

---

## 8. The data layer (`lib/data/`)

Rooms never query Supabase directly; they call the data layer, which returns
**view models** and works identically in demo and live mode.

- `index.ts` — the dispatcher. `useSeedData()` (from `lib/mode.ts`) picks
  `demo.ts` (seed files) or `db.ts` (Supabase). Exposes `getToday`, `getDeck`,
  `getPriorities`, `getTable`, `getLedger`, `getDecisionLog`.
- `db.ts` — the live source. Reads Supabase (RLS-scoped server client), resolves
  the current seat, and builds view models. Notable: `dbDeck` re-ranks the deck
  per seat by learned appetite (§9); `dbTable` assembles per-decision receipts;
  `dbLedger` hydrates each seat's belief reactions.
- `demo.ts` — the seed reader (`supabase/seed/demo/*.json`), for local previews
  and audits without a database.
- `derive.ts` — **pure** functions that turn domain rows into view models,
  shared by both sources (the guarantee that demo and live behave the same).
- `views.ts` — the view-model types (`TodayData`, `TableData`, `DeckView`,
  `PriorityView`, `LedgerData`, `DecisionReceipt`, `SeatReaction`, ...).
- `seed-types.ts` — types for the seed JSON.

---

## 9. The learning layer (`lib/learn/`) & feedback

This is what makes the app adapt. Raw material is the **`reactions`** table
(one thumb up/down + optional reason tags, per seat per object).

- **Capture:** `components/ui/Reaction.tsx` + `lib/copy/reasons.ts` (the
  intelligent reason-chip taxonomy, per subject type). The `react()` server
  action (`app/actions.ts`) upserts to `reactions`, attributed to the seat.
  Surfaces today: radar signals (hydrated + re-ranking), ledger beliefs
  (hydrated). The store is polymorphic (`signal | decision | brief | move |
  assumption | theme`) so any surface can reuse it.
- `affinity.ts` — `computeAffinity(votes)` derives a seat's per-lane appetite;
  `personalize(signals, affinity)` re-ranks the deck by it (bounded so strong
  signals still surface). Consumed at read time in `dbDeck`.
- `reflection.ts` — `summarizeReactions()` produces the Settings readout: this
  seat's leaned-into / waved-off lanes, the table's collective lanes, top
  reason tags.
- `themes.ts` — **the team knowledge graph.** `computeThemes()` clusters recent
  signals by embedding proximity into **themes**, scoring each for
  **importance** (member scores + net team reactions) and **consensus** (how
  much the four seats agree). Writes the `themes` table; runs in the weekly loop.
- **Consensus on decisions** lives in `TableRoom.tsx` (`consensusOf`) from the
  `decision_signoffs` data: Aligned / Split / Pushback / Forming.

Team appetite also feeds the **pipeline** score (`lib/intel/score.ts`), so the
radar self-heals at the source, not only at read time (§10).

---

## 10. The intelligence pipeline (`lib/intel/`) & the weekly loop (`lib/loop/`)

### The daily pipeline (`lib/intel/run.ts`, invoked by `app/api/pipeline/run`)

A best-effort chain; a dead source never kills the run:

1. `gather.ts` — pull GDELT / Hacker News / RSS allowlist / Brave, normalized to
   one shape. Source lanes/weights come from the `sources` table (seeded from
   `supabase/seed/ontology.json`).
2. `cluster.ts` — collapse near-duplicate headlines; distinct source count is the
   `corroboration` signal.
3. `filter.ts` — one batched LLM question per candidate ("does this change what
   Amperity should build/sell/buy/say?"), which also **assigns the lane** (1–8).
4. `score.ts` — a linear score: corroboration + reputation (learned
   `sources.weight`) + freshness + engagement + **resonance** (embedding cosine
   vs what seats acted on/killed) + **teamTaste** (learned lane appetite).
   Coefficients live in `weights.ts`.
5. `synthesize.ts` — one card per survivor: `headline`, `for_amperity`,
   `posture` ("the move"), and an optional link to a house assumption
   (`direction` supports/challenges).
6. `balance.ts` — scarcity is the product: cap 12 cards, 3 per lane, inject one
   quiet-lane card, pair contradictions into tension cards.
7. Write to `signals`. `llm.ts` holds the model calls, embeddings, cosine,
   centroid, and a bounded concurrency `pool`.

`types.ts` defines the pipeline's intermediate shapes (`RawItem`, `Cluster`,
`FilteredCluster`, `ScoredCluster`, `CardDraft`).

### The scheduled beats (`app/api/loop?step=…`, cron-authorized)

| `step` | Module | What fires |
|---|---|---|
| `pulse_open` (Mon) | push | "The Monday pulse is open." |
| `drift` (Wed) | `loop/drift.ts` | Silent unless a move stalled / blocker unowned / belief status changed; one push to the responsible seat. |
| `close_notify` (Fri) | push | "The week is closed." |
| `learn` (Sun) | `loop/learn.ts` + `loop/retro.ts` + `loop/decay.ts` + `learn/themes.ts` | Stage a learning proposal, write the self-retro, **decay unwatched beliefs**, and **recompute the themes graph**. |
| `decay` | `loop/decay.ts` | Unwatched assumptions drift a gentle point toward 50 (self-limiting). |
| `themes` | `learn/themes.ts` | Recompute the knowledge graph on demand. |
| `morning_notify` | push | "The morning read is ready." |

Other loop modules: `compose.ts` (the brief composer — Opus, 220–280 words, four
sections, every sentence traceable), `prerender.ts` (nightly TTS pre-render),
`metrics.ts` (the Settings learning dashboard). Learning proposals are
**operator-gated**: `learn.ts` stages, `LearnReview.tsx` + `api/learn/decide`
approve, and only then does `applyProposal` change `sources.weight` etc.

---

## 11. Voice & Ask

- `lib/voice/stt.ts` — speech→text (`gpt-4o-transcribe`, `whisper-1` fallback);
  audio is never persisted.
- `lib/voice/tts.ts` — text→speech (one office voice), cached by content hash in
  a private bucket, served via short-lived signed URLs.
- `lib/voice/intent.ts` — a fast Haiku call routes an utterance into a command
  grammar; below the confidence floor it falls through to Ask (always safe).
- `lib/ground/retrieve.ts` — grounds Ask in the house view, priorities, moves,
  decisions, and the nearest signals by embedding (`match_signals` RPC). Cited
  or silent.
- `lib/copy/voice.ts` — the single definition of Bridge's voice, imported by
  every prompt so everything sounds like one person.

---

## 12. Domain model & database schema

Migrations in `supabase/migrations/` are the source of truth. Row types mirror
them in `lib/types.ts`. Every table has **RLS enabled**; helper functions
`public.current_seat()` and `public.is_operator()` back the policies.

### `00000000000001_bridge_core.sql` — the core

| Table | What it holds |
|---|---|
| `seats` | The four seats (id, role, `lane_order`). |
| `sources` | Market sources (kind, url, lane, tier, learned `weight`, active). |
| `signals` | Radar cards: `lane` (1–8), `headline`, `for_amperity`, `posture`, `score`, `corroboration`, `cluster` (jsonb), `embedding` vector(1536), assumption link. |
| `assumptions` | The house belief ledger: `statement`, `confidence`, `status`, `history`. |
| `assumption_evidence` | Directed, weighted edges from signals to beliefs (`direction`, `weight`). |
| `priorities` | The 3–5 live priorities (state, sponsor, confidence). |
| `moves` | One move per priority per ISO week (state: proposed/agreed/shipped/missed). |
| `pulses` | Weekly confidence votes (one per seat/priority/week). |
| `decisions` | Logged decisions (owner, due, logged_by, via). |
| `threads` | Relationships, optionally linked to a priority. |
| `briefs` | The morning/close brief (script, line refs, audio path, released). |
| `receipts` | Read receipts. `artifact_type in (brief, pulse, decision)`. |
| `events` | The general behavioral log (`type`, `subject_*`, `value`). |
| `learn_proposals` | Staged weekly learning proposals (operator-gated). |
| `push_subscriptions`, `audit_log` | Web Push subs; the operator audit trail. |

### `00000000000002_decision_receipts.sql`

Relaxes `receipts` to allow `artifact_type = 'decision'` (per-decision read
receipts), and adds **`decision_signoffs`** (seat, decision, `stance` in
`concur|feedback`, note) — the data behind "Who's Seen It / Who Concurred /
consensus" on the Table.

### `00000000000003_reactions.sql`

**`reactions`** — the universal feedback store: `(seat, subject_type,
subject_id)` unique, `sentiment` (±1), `reason_tags[]`, `note`, denormalized
`lane`. The raw material of the learning layer (§9).

### `00000000000004_themes.sql`

**`themes`** — the team knowledge graph snapshot: `label`, `lane`, `centroid`
(embedding, jsonb), `importance`, `consensus`, `member_ids`, `member_count`.
Written by `computeThemes` (service role); read by every seat.

---

## 13. Auth, seats, modes

- **Seats** (`lib/seats.ts`): four fixed seats; emails come from the
  `SEAT_ALLOWLIST` env var (never code), mapped by position to seat 1–4. Seat 4
  is the operator.
- **Auth** (`middleware.ts`, `lib/auth.ts`): Supabase magic-link. Middleware
  refreshes the session and gates every non-API route.
- **Demo mode** (`lib/mode.ts`): when no Supabase env is set, or `DEMO_MODE=true`
  off production, the app skips auth and reads seed files. Server actions refuse
  writes in demo. Used by audits and previews. **Never active in production.**
- **Three Supabase clients** (`lib/supabase/`): `client.ts` (browser),
  `server.ts` (RLS-scoped, per-request cookies), `service.ts` (service-role,
  bypasses RLS — server/cron/pipeline only; importing it into client code is a
  build error by design).

---

## 14. Configuration (env)

From `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `BRAVE_API_KEY`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SEAT_ALLOWLIST` (4 comma-separated
emails, seat order), `APP_TIMEZONE`, `DEMO_MODE`, `CRON_SECRET`.

---

## 15. Scripts & audits (`scripts/`, `package.json`)

| Command | What it does |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js dev / production build / serve. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm seed:demo` / `seed:live` | Seed demo data / seed live sources+assumptions (no signals — the pipeline fills them). |
| `pnpm audit:noscroll` | Playwright: assert no page-level scroll on every route (invariant #2). |
| `pnpm audit:rls` | Assert RLS is enabled/correct. |
| `pnpm audit:voice` | Voice latency budget. |
| `pnpm check:copy` | Enforce the banned-vocabulary rule (`lib/copy/banned.ts`). |
| `scripts/gen-icons.ts` | Generate PWA icons. |

---

## 16. Invariants an agent must not break

1. **Never introduce page scroll.** Content flows in `.room-canvas`; overflow is
   contained, not a `document` scroll. Verify with `pnpm audit:noscroll`.
2. **Don't use `dvh`/`vw`** — the root zoom multiplies them. Use `%` and the
   spacing tokens.
3. **Style with tokens**, not one-off hex or arbitrary `text-[Npx]` — use the
   type/space/radius scales and the shared `Card`/`Button`/`Chip` primitives.
4. **Respect the two Supabase trust boundaries:** RLS server client for anything
   user-scoped; service client only in server/cron/pipeline. Every new table
   gets RLS + policies mirroring the seat model.
5. **Learning proposals are operator-gated.** The pipeline may read learned
   signals, but changes to weights/appetite are staged and approved, not
   auto-applied.
6. **Feedback is attributed.** Anything a leader expresses goes through the
   `reactions`/`decision_signoffs`/`events` stores keyed to their seat.
7. **Run `pnpm typecheck` and `pnpm build` before committing**; add a migration
   file for any schema change and apply it (see RUNBOOK).
