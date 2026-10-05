-- Longevity Pillars: daily committed ritual.
-- Committed is now re-affirmed every morning, so it moves from the standing
-- protocols table to the daily protocol_checks table alongside held.
-- Both toggles start unchecked each day.

alter table public.protocol_checks
  add column committed boolean not null default false;
