# AGENTS.md — start here

You are working on **Bridge**, a phone-first leadership instrument for a fixed
four-person executive team. This file is the fast onboarding for any agent
(human or AI). Read it fully before editing. For the exhaustive component map,
read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What it is, in three sentences

Bridge gives four leaders their market, priorities, weekly moves, points of
(dis)agreement, and a voice assistant in ~90 seconds a day. A background
pipeline fills the database with scored market "signals"; a learning layer turns
each leader's feedback into per-person personalization and a team knowledge
graph. It is a Next.js 15 PWA on Supabase, designed as a 412px phone canvas
scaled to any screen.

## The mental model

- **Rooms** = full-screen pages reached by the bottom tab bar: Today, Radar,
  Priorities, Table, Ask (+ the Ledger, one tap from Radar; + Settings).
- **Data layer** (`lib/data/`) shapes DB rows into view models. Rooms call it;
  they never query Supabase directly. It works identically in demo and live.
- **Intel pipeline** (`lib/intel/`) gathers → clusters → filters → scores →
  synthesizes → balances → writes `signals`.
- **Learning layer** (`lib/learn/`) reads the `reactions` table into per-seat
  appetite (re-ranks the radar), a Settings reflection, and a `themes` graph.
- **Loop** (`lib/loop/`) runs the scheduled beats (brief, drift, learn, decay,
  themes) via `app/api/loop?step=…`.

## Run & verify

```bash
pnpm install
pnpm dev                       # dev server
DEMO_MODE=true pnpm start      # run against seed data, no DB/auth (after build)
pnpm typecheck                 # tsc --noEmit  — run before every commit
pnpm build                     # must pass before every commit
pnpm audit:noscroll            # the no-page-scroll invariant (needs a running server)
```

Demo mode (`DEMO_MODE=true`, or simply no Supabase env) reads
`supabase/seed/demo/*.json` and skips auth — use it for local previews and
screenshots. Writes are refused in demo.

To screenshot: launch a server and drive it with Playwright
(`executablePath: '/opt/pw-browsers/chromium'`). Note the sandbox may reap
long-lived servers between shell calls — start the server and take the shot in
**one** command.

## Supabase

The live project is **`bridge`** (`divrvqnzjffeegsmbugz`). Schema source of truth
is `supabase/migrations/`. For any schema change: write a new numbered migration
file **and** apply it (via the Supabase MCP `apply_migration`, or `supabase db
push`). Every table must have RLS enabled with policies mirroring the seat model
(`public.current_seat()`, `public.is_operator()`). Run the security advisors
after DDL.

Three clients, three trust levels (`lib/supabase/`): `client.ts` (browser),
`server.ts` (RLS, per-request), `service.ts` (bypasses RLS — server/cron/pipeline
only; never import into client code).

## Hard invariants (breaking these looks like a bug)

1. **The page never scrolls.** Put content in `.room-canvas`; overflow is
   contained there, never a document scroll. Verify with `pnpm audit:noscroll`.
2. **No `dvh`/`vw`.** The root-zoom in `app/layout.tsx` multiplies viewport
   units. Use `%` and the spacing tokens.
3. **Style with the design system.** Type/space/radius/color tokens and the
   `Card`/`Button`/`Chip`/`Sheet`/`Avatar`/`Reaction` primitives in
   `components/ui/`. No stray hex, no one-off `text-[Npx]`.
4. **Feedback is attributed and gated.** User opinions flow through
   `reactions` / `decision_signoffs` / `events`, keyed to the seat. Learned
   signals may inform the pipeline, but weight/appetite changes are
   **operator-approved** (`lib/loop/learn.ts` → `LearnReview` →
   `api/learn/decide`), not auto-applied.
5. **Demo parity.** Anything new must work in both demo and live — put shared
   shaping in `lib/data/derive.ts`, and update `lib/data/demo.ts` alongside
   `lib/data/db.ts`.

## Conventions

- Server actions (the only write paths) live in `app/actions.ts`; reuse the
  `seatOrNull()` / `DEMO_REFUSAL` guards and `logEvent` / `revalidatePath`.
- Fixed vocabularies (lanes, states, reason chips, voice, banned words) live in
  `lib/copy/`. Add to these, don't inline strings.
- Copy must avoid the banned vocabulary (`lib/copy/banned.ts`); `pnpm
  check:copy` enforces it.
- Match the surrounding code's terse, purposeful comment style (one header
  comment per module explaining its job).

## Where things are (quick index)

| Need to… | Go to |
|---|---|
| Add/adjust a room's UI | `components/rooms/*`, `app/(rooms)/*/page.tsx` |
| Change a shared control | `components/ui/*`, `components/dial/Dial.tsx` |
| Change what data a room gets | `lib/data/{db,demo,derive,views}.ts` |
| Add a write path | `app/actions.ts` |
| Change the radar pipeline | `lib/intel/*` (`run.ts` orchestrates) |
| Change learning / personalization | `lib/learn/*`, `lib/loop/*` |
| Change the schema | `supabase/migrations/` (+ apply it) |
| Change tokens / layout laws | `app/globals.css`, `app/layout.tsx` |
| Understand any component in full | `docs/ARCHITECTURE.md` |
