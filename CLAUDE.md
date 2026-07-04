# CLAUDE.md

This project's guidance for AI agents lives in **[`AGENTS.md`](AGENTS.md)** —
read it first. The exhaustive, component-by-component reference is
**[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.

Quick reminders (full detail in AGENTS.md):

- **Never introduce page scroll** — content goes in `.room-canvas`; verify with
  `pnpm audit:noscroll`.
- **No `dvh`/`vw`** (the root zoom multiplies them); use `%` and spacing tokens.
- **Style with the design system** in `app/globals.css` + `components/ui/`.
- **Run `pnpm typecheck` and `pnpm build`** before every commit.
- **Schema changes** get a new file in `supabase/migrations/` and must be
  applied; every table needs RLS.
- **Demo parity:** update `lib/data/demo.ts` alongside `lib/data/db.ts`; shared
  shaping goes in `lib/data/derive.ts`.
