# Decisions log

Calls made under brief rule 0.7 during the build. Each entry: the gap in the
brief, the decision, and why it best serves a ninety second phone session.

## G0

1. **Seed-file data source until the database is configured.** The data layer
   (`lib/data`) reads the demo seed files directly when Supabase env is absent
   or `DEMO_MODE=true`, and the database otherwise. Same view models either
   way. This let the full UI ship and be audited before infrastructure landed,
   and it is the mechanism behind demo mode (brief section 16). `DEMO_MODE` is
   ignored on production deploys in code (`lib/mode.ts`), so production always
   runs auth.

2. **Seat emails.** Only `krish@themindmaker.ai` (Seat 4, operator) is
   allowlisted at launch, per Krish's call on 2026-07-03. Seats 1 to 3 exist
   in the database with names but null emails, so they cannot log in until
   their addresses are added to `SEAT_ALLOWLIST` (positional, seat order 1..4)
   and the `seats` table. Adding a principal is a config change plus one row
   update, not a code change.

3. **Blocker fields on priorities.** The brief's card spec (4.3) shows a
   blocker line with a named owner, but the section 12 sketch has no column
   for it. Added `blocker text` and `blocker_owner_seat int` to `priorities`.
   The sketch is labeled a sketch; the card is the contract.

4. **Assumption extras.** Added `kind` (assumption or force), `history` jsonb
   (the 90 day sparkline data), and `illustrative` to `assumptions` for the
   same reason: section 6 requires forces as standing watch items and a trend
   sparkline, and the sketch has no home for either.

5. **Radar actions at G0 act locally.** Act, Hold, and Kill dismiss the card
   and give feedback (Act confirms it routed to the operator) but do not yet
   write `events` rows; that wiring is G2 scope where the learning loop can
   consume it. The buttons are real controls, not decoration, and their
   surface will not change at G2.

6. **Ask room ships as its finished surface with an honest state.** Pressing
   the mic explains that voice lands at gate three. No fake transcription, no
   dead button.

7. **One auth email template for both first and returning logins.** Both the
   confirmation and magic link templates carry the six digit `{{ .Token }}`
   code with the same copy, so the door reads identically whether or not the
   seat has logged in before.

8. **Amperity brand assets from Brandfetch.** Wordmark and ampersand symbol
   pulled from Amperity's public brand record, icon set generated from the
   symbol on the brand lime (#DFF941). Brief tokens (paper, ink, mint) remain
   the product palette; the logo is an asset, not a palette change.
   Wordmark on the login screen only, per Krish's instruction.

9. **Viewport zoom locked.** `maximum-scale=1` on the viewport to keep the
   no-scroll instrument layout intact on iOS. Trade against pinch zoom
   accessibility accepted for v1; revisit if any seat needs it.

10. **Supabase org upgraded to Pro.** The free tier's two project cap blocked
    a dedicated project. Krish upgraded the org; the `bridge` project carries
    Supabase Pro's standard compute charge (about 10 USD per month) beyond
    the plan's credit.

11. **Pipeline runs on Vercel, not a Supabase edge function.** Section 11
    sketches both `app/api/pipeline/sweep` and `supabase/functions/pipeline-run`.
    One deploy surface, one secret store, and a 300 second budget on the
    route beat a second runtime; the stages live in `lib/intel` and could be
    lifted into a Deno function later without redesign.

12. **Model choices updated to the current family.** The brief (written
    earlier) names claude-sonnet-4-6; the build uses claude-haiku-4-5 for the
    filter, claude-sonnet-5 for synthesis and ask, and claude-opus-4-8 for
    composition when G4 lands.

13. **Provider keys from the June 13 export are invalid.** Anthropic, OpenAI,
    Brave, and ElevenLabs all reject them (rotated since export). Fresh keys
    required from Krish before the G2 model stages, G3 voice, and G4
    composition can run. Deterministic stages are built and tested.

14. **Grid columns pinned via CSS.** Any grid that declares `grid-rows-*`
    gets `grid-template-columns: minmax(0, 1fr)` globally, because truncated
    (nowrap) lines otherwise inflate the implicit column and push the layout
    past the viewport. A future two column grid that also declares rows must
    set its own columns explicitly.
