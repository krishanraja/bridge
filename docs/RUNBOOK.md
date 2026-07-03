# RUNBOOK

## The pieces

- App: Next.js 15 PWA on Vercel, project `bridge`, production at
  https://bridge.krishraja.com, production branch
  `claude/bridge-leadership-dashboard-dss4cd`.
- Data: Supabase project `bridge` (ref `divrvqnzjffeegsmbugz`, us-east-1) in
  the Mindmaker OS org. Postgres 17, RLS deny-by-default, realtime on
  receipts, pulses, decisions.
- Auth: Supabase email OTP. The allowlist is enforced in the database by a
  trigger on `auth.users` that checks `seats.email`. The login screen shows
  the same neutral line to everyone.

## Environment variables

See `.env.example`. Set in Vercel (all environments) and in `.env.local` for
local work. `SEAT_ALLOWLIST` is positional: seat 1 Kabir, seat 2 Derek,
seat 3 Amy, seat 4 Krish. An empty position keeps that seat unloginable.

## Adding a principal's email later

1. Add the address to `SEAT_ALLOWLIST` in Vercel env and redeploy.
2. Update the row: `update seats set email = '<address>' where id = <seat>;`
3. Done. Their first login sends the code email.

## Local development

```
pnpm install
cp .env.example .env.local   # fill in
pnpm dev
```

Demo mode without a database: set `DEMO_MODE=true`, unset the Supabase vars.
Auth is bypassed and data comes from the seed files. Production deploys
ignore `DEMO_MODE` by design.

## Seeding

- `pnpm seed:demo`: wipes and loads the illustrative fourteen day history.
- `pnpm seed:live`: wipes and loads ontology and assumptions only. The line
  for the room: the sample comes out, your priorities go in.

Both scripts need `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

## Audits

- `bash scripts/check-copy.sh`: em and en dashes, banned vocabulary.
- `BASE_URL=<url> pnpm audit:noscroll`: every route at 390x844, 430x932,
  1280x800 must fit the viewport. Run against a server in demo mode or an
  authenticated storage state.
- CI (GitHub Actions) runs copy checks, typecheck, and build on every push.

## Schedules (registered from G2 onward)

All times America/New_York; Vercel cron is UTC, so entries shift with DST.
05:30 pipeline, 06:45 brief compose, 07:25 release check, Wed 12:00 drift,
Fri 14:30 close compose, Fri 15:00 close release, Sun 21:00 learn.

## Manual test notes

- 2026-07-03: RLS probe (anon key): zero rows on all tables; non-allowlisted
  OTP rejected by the trigger (500 from auth, neutral message in UI).
  Operator session via admin link: seated reads returned demo rows.
- 2026-07-03: presence verified with two live realtime clients on the
  `presence:<day>` channel, each seeing both seats. The build container's
  egress proxy blocks browser traffic to Supabase, so the two physical
  browser pass runs on the deployed URL from real devices; the channel code
  is identical.
- 2026-07-03: deployed checks at bridge.krishraja.com: unauthenticated rooms
  307 to /login, manifest with 192/512 and maskable icons, service worker
  served, wordmark on the door. PWA installability criteria all present
  (HTTPS, manifest, service worker with fetch handler); formal Lighthouse
  run lands with the G6 performance pass.
- 2026-07-03 (G2): full pipeline run on live sources: 135 gathered across
  GDELT, HN, RSS, Brave; 125 clusters; 33 kept by the haiku filter; 12 cards
  written, all cited, all embedded, six lanes. Seeded contradiction produced
  one tension card (unit run). Kill learning: after killing the five cards
  nearest the state privacy topic, the topic's rerun scores fell from 9.0 to
  7.5, and the penalty tracked similarity to the killed centroid (0.73
  similarity lost 1.5 points, 0.44 lost 0.9). Test artifacts rolled back;
  final deck is clean.
- Anthropic, OpenAI, and Brave keys rotated 2026-07-03 and verified live.
  The replacement ElevenLabs key still returns 401; voice synthesis waits
  on a working key.
- 2026-07-03 (G3): voice audit over live keys. Transcription p50 1082ms via
  gpt-4o-transcribe (whisper-1 fallback wired); ask first token p50 1693ms,
  inside the 1.8s budget; combined voice release to first text about 2.8s on
  a tier one Anthropic key, expected to tighten as the key tier rises. The
  spoken fixture "Log a decision: we run the lakehouse partner review this
  quarter, Derek owns it, due September thirtieth" routed end to end to
  log_decision with owner Derek and due 2026-09-30. Ungroundable question
  returned the honest fallback line verbatim. Streams carry a text-progress
  watchdog because upstream pings keep sockets alive while rate limit pacing
  can stall tokens.
- ElevenLabs: both provided keys rejected (401). The speak endpoint, brief
  audio, and read aloud are built and fail honestly until a working key
  lands in Vercel env and .env.local.
- iOS Safari mic permission pass on a physical device: pending; hold-to-talk
  uses MediaRecorder with audio/mp4 fallback for Safari.
- Push on installed PWA (one iOS, one Android): due at G4.
