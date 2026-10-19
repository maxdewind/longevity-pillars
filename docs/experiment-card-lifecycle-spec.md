# Longevity Pillars: Experiment Card and Lifecycle Spec

Draft v0.1 — October 19, 2026. First user: Max.

> Status (2026-10-19): the spec below is the user's own text, transcribed verbatim from his
> message. It supersedes the three-states proposal from the same morning (Active / Maintained /
> Retired, drift rule, 6-of-7 unlock gate, no streak counters, 8–10 rule ceiling).
> Implementation status: backfill and bedtime plumbing done 2026-10-19 (Oct 18 held
> backfilled; sleep-onset "bedtime" column live in the bridge and the app). The 7-day
> sprint engine, day-3 early read, day-7 verdict, unlock gate, drift rule, re-read card
> and ceiling prompt are not yet implemented. The currently running bedtime experiment
> (started Oct 18) still runs on the old 12-day window.

Longevity Pillars: Experiment Card and Lifecycle Spec
Draft v0.1, October 19, 2026. First user: Max.

## 1. Principles

- One active experiment at a time.
- Fixed rules, not conditional ones. A rule with a decision point gets renegotiated nightly.
- Additive before subtractive. Early wins build adherence.
- Short sprint for attention, quiet confirmation for evidence.
- No streak counters, no shame mechanics.

## 2. Experiment card

Every experiment is one card with these fields:

- Name and rule: one fixed sentence (example: lights out by 10:30 PM).
- Primary metric: exactly one, locked for the length of the sprint.
- Secondary metrics: shown as "also moved", never used for the verdict.
- Starting point: mean and typical swing over a user-defined lookback window before the experiment begins.
- Length: 7 days, with an optional 3-day extension.
- Evidence tier: Strong, Moderate, or Early. Tap opens a short explanation, collapsed by default.
- Rules agreement screen: a single screen shown before the sprint starts.
- Adherence: a Held tick per day. Auto-verified when watch data can confirm it. Optional Committed (morning) and Held (evening) pair, toggleable.
- Non-daily practices (for example gym 3 days a week): the card carries a weekly count target instead of a daily tick.

## 3. Sprint timeline (7 days)

- Day 1 onward: show the daily value against the starting point, plus the adherence tick. Daily visibility from day 1 is intentional, accepting the over-reading risk.
- Day 3: early read card with adherence so far and the primary metric trend.
- Day 7: verdict. Three outcomes: Held, Not held, Held but no signal yet.
- The verdict accounts for adherence (held on X of 7 days) and sustainability (works but hard to keep).
- Secondary metrics that are too noisy at 7 days (deep sleep, HRV) show direction only and the verdict is labeled Early.

## 4. Unlock rule

- Held on 6 of 7 days: the rule is kept, moves to Maintained, and the next experiment unlocks.
- Held on fewer days: user chooses to extend 3 days or discard.
- The next experiment starts with all Maintained rules still running.
- Experiments are picked from the catalogue (3 suggestions with Shuffle, plus a write-your-own tile). The catalogue shows its real count.

## 5. Lifecycle states

Active

- Daily check-in, day 3 early read, day 7 verdict.

Maintained

- The rule stays in My protocol and keeps running by default.
- Anything the watch can verify (bedtime via sleep data, steps, Zone 2 minutes) is checked automatically with no tap.
- Only unverifiable rules ask for a tap. The Committed and Held pair stays optional.
- The user can remove the rule at any time.
- Re-read card at 4 weeks (day 21 to 28): compares the rule's primary metric to the original starting point and asks whether the effect held. Options: Keep, Modify, Retire. This is where long-term confirmation happens, at no attention cost.

Retired

- Removed by the user or discarded.
- Archived with its verdict history. Nothing is deleted, and a retired rule can be restored.

## 6. Drift rule

- Trigger: adherence below 5 of 7 for two consecutive weeks on a Maintained rule.
- Action: the rule resurfaces with a gentle prompt, "Still working for you?", with Keep, Modify, and Retire options.
- Tone: informational, never framed as failure.

## 7. Display rules

- No streak counters. Show "held 6 of the last 7" so one slip costs one tick, not everything.
- Use the term "starting point" (not baseline or your normal) and "typical swing" for the range.
- Optional compare layer on the starting point screen: Off, Healthy range, Top percentile.

## 8. Protocol ceiling

- At roughly 8 to 10 Maintained rules, the app prompts the user to retire or merge a rule before unlocking another experiment.
- Rationale: past that size the protocol itself becomes the burden.

## 9. Data hygiene

Found in the first user's own sheet (Sep 13 to Oct 18):

- Nights with sleep duration under about 1 hour are watch or sync failures. Exclude them from starting points and metrics.
- Implausible values (for example deep sleep over 120 min) are flagged for user confirmation and excluded until confirmed.
- Weight is logged on about half of days and swings up to 9 lb day to day. Use a 7-day average, and never use weight as the primary metric of a 7-day sprint.
- Set a minimum number of valid nights for a starting point, and show the count used.
- Add a bedtime field. It is the controlled variable for sleep experiments.

## 10. First experiment (user zero): fixed bedtime

- Rule: lights out by 10:30 PM, every night.
- Primary metric: sleep duration.
- Secondary: deep sleep, overnight HRV, overnight HR.
- Starting point (33 valid nights): average sleep 7.0 h, range 5.1 to 8.7 h, 9 nights under 6.5 h. Deep sleep about 44 min in late September and about 36 min in October. HRV about 52 ms drifting to about 50 ms.
- Why first: largest clean gap, additive rather than restrictive, verifiable by the watch, and it works on cravings from upstream.
- Honest expectation: a 7-night average can show a duration gain of about 30 min or more. Deep sleep and HRV need the 4-week re-read.

## 11. Open decisions

- Confirm the 6 of 7 unlock threshold after a few real sprints.
- Safety screening: kept as a placeholder.
- Whether to defer the goals module on first run.
- How verdicts handle non-daily practices in detail.
- Exact cutoffs for the implausible value flags.
