# Routine framework v2 — app change spec

Date: 2026-10-10. Status: **approved for implementation** (user: "Please build!").

## Background

The user is reworking the Longevity Pillars routine system around two categories only:

- **Mandatory** — the committed floor. Daily (or weekly) bright lines, each scored independently.
- **Experimental** — one time-boxed, pre-registered test at a time. Verdict at end: adopt → becomes mandatory; reject → dropped.

"Optional" as a permanent category is **retired**: if something works, commit to it; if not, drop it.

Key behavioral principle: **decouple composite rules into independently-scored components** so partial adherence always counts (missing the window start must never cancel the closure).

## Change 1 — Split the eating-window routine

Current: one routine `Keep the 11:30–19:30 eating window` ("Finish eating by 7:30 PM; first meal at or after 11:30 AM."), not mandatory.

New — two independent **mandatory** routines:

1. `First meal at or after 11:30` — detail: "First MEAL at or after 11:30 AM. Fuel (morning fuel cap, changeroom shake) is governed by its own line and is not a meal."
2. `Eating closed by 19:30` — detail: "All eating done by 19:30. Scored independently — a missed start never cancels the closure."

This also fixes the 19:00 / 19:30 / 7:30 PM inconsistency found across protocol docs, reminders, and app copy: canonical close is **19:30**.

New **experimental** routines (pre-registered 2026-10-10, Exp #1 and #2):

3. `Morning fuel cap` — detail: "Before 11:30, the only intake permitted is fuel within a pre-logged 175 kcal cap. At ~7:30: IF today's pre-11:30 fuel is already weighed and logged at or under 175 kcal, THEN cream goes in the coffee; otherwise black." (Time-only anchor; morning activity is aspirational, not a condition — user decision 2026-10-10.)
4. `Changeroom shake` — detail: "IF in the gym changeroom before a training session, THEN: 15g pea protein + 15g collagen + 250mg vitamin C in water. Before 11:30 it counts inside the 175 kcal cap; after 11:30 it's window intake. Rest days / anywhere else: the rule doesn't fire."

Shared definitions (show once, reference everywhere): **Fuel** = intake governed by the fuel cap or the changeroom shake; never a meal. **Meal** = everything else.

## Change 2 — Mandatory set (seed updates)

Promote to mandatory: `Eat 2 meals, each within 30 minutes`, `No white rice or white flour`, `Stay gluten-free`, plus the two new window lines above.
Already mandatory (unchanged): `No fast food`, `No added sugar`, `Daily movement`.
Fold: `Micro bodyweight set` → becomes the never-zero fallback detail inside `Daily movement`, not a standalone routine.
Noted gap (future, out of scope here): no sleep-pillar routines exist in the app.

## Change 3 — Weekly-cadence routines

`Gym workout (weightlifting)` → rename `Strength training 3×/week`, mandatory, **weekly** cadence (target: 3 sessions/week).

Requires: a `cadence` field on `protocols` (`daily` default | `weekly`), plus weekly-target progress UI. Daily committed/held tracking stays as-is for daily routines; weekly routines aggregate Monday–Sunday.

## Change 4 — Experiment support (phase 2, not this build)

Schema sketch for experimental routines: `hypothesis text`, `exp_start date`, `exp_end date`, `primary_metric text`, `guardrails text[]`, `decision_rule text`, `verdict text` (adopt / reject / extend), `verdict_date date`. Daily ticking stays the same; at `exp_end` the app prompts for the verdict. No streak psychology on experimental routines — a rejected hypothesis is data, not a slip.

## Migration notes

- Existing users: replace the single window routine with the two new ones. Recommend fresh hold counts on the new rows (preserve the old row's history, don't map it).
- Apply the Change 2 mandatory flags for existing users (they can toggle).
- Update the `handle_new_user()` seed function (`supabase/migrations/0004_mandatory_routines.sql` lineage) to the new routine list.

## Out of scope

- Sleep pillar routines; social/sharing features; any change to the committed/held two-state tracking model.

## Change 5 — Split-held cards (2026-10-10, user: "Please build")

Composite routines now split into independently-held rows sharing a `card_group`, rendered as ONE card: one Committed button commits every row, each row gets its own half-width Held button. Same decoupling principle as the window split — partial adherence counts, a miss on one half never cancels the other.

- `Eat 2 meals, each within 30 minutes (Meal 1)` / `(Meal 2)` — `card_group='two-meals'`, mandatory, daily.
- `Move 15 min after each meal (Meal 1)` / `(Meal 2)` — `card_group='post-meal-move'`, mandatory, daily. Move for 15 minutes after each meal (walk, bike, anything). Each scores on its own.

Implementation: the card-group rendering is generic on both web and mobile (group by `card_group`, strip the ` (Meal N)` suffix for the card title and half-button labels). New split cards need only the DB rows — no app code changes. Tripwires, diary summary, evidence lines, and the 90-day target all operate per row.

## Change 6 — Meal-end timestamp (2026-10-12, user's design)

## Change 7 — Mind pillar (2026-10-12, user's request)

A third pillar, `mind`, now exists alongside nutrition and movement (migration `0010_mind_pillar.sql` widens the pillar check constraint). It renders as its own section at the very top of the Protocol page, above Nutrition. First routine: **Keep positive thoughts** ("Stay with thoughts that move you forward."), mandatory, daily. The mind/stress pillar was always in the long-term vision (Rung 4 era); this opens it early with a single daily check.

The Meal 2 half-button on the two-meals card is now **Meal end**, and it toggles: one tap writes `held_at` (timestamptz on `protocol_checks`) and marks Held — the timestamp is the evidence; tapping it again asks "Are you sure?" before clearing ("Meal end 3 hours before bed is really important for how you will feel tomorrow morning."), with "Leave it as it is" / "Yes, unclick meal end" — so a stray tap can't silently lose the timestamp that feeds the meal-sleep gap. To move the stamp to a later time, confirm the clear, then tap again. The button shows "Ended HH:MM" once stamped. The 19:30 close card stays a binary bright line. Rationale: the timestamp turns the close into a gradient, so 19:31 and 23:45 stop looking identical — kills the "failed it anyway" spiral.

Feeds the **meal–sleep gap** metric (last bite → sleep onset) on the Morning Health Stats dashboard, shown against the personal median. Timestamp sources, in priority order: (1) the Meal end button tap, (2) the 21:30 "kitchen's closed" check-in confirmation backfills `held_at` (null-guard never overwrites a manual tap). Sleep onset comes from the existing Apple Health pull; the morning pull cron fetches yesterday's stamp.
