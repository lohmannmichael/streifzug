-- Keep what Overland knows about how one was moving (iOS motion activity) and the speed,
-- so outings can be split into "aktiv" and "gefahren" per leg (Bauplan 6.2).
alter table public.received_points
  add column if not exists motion text[],
  add column if not exists speed real check (speed is null or speed >= 0);
