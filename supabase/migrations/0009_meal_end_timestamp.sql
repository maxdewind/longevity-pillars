-- Longevity Pillars: meal-end timestamp (2026-10-12).
--
-- Adds a nullable held_at timestamp to protocol_checks. The Meal 2
-- ("Meal end") button stamps it when tapped: one tap records the time the
-- meal ended AND marks held, so the close becomes a gradient (19:31 vs
-- 23:45 are visibly different) instead of a binary pass/fail. The
-- meal-sleep gap metric reads this timestamp against sleep onset.
-- Re-tapping updates the timestamp (last tap wins).

alter table public.protocol_checks
  add column if not exists held_at timestamptz;
