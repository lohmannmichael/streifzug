-- Bauplan 3, D8 (22.11.2026, Michi: "Alles bei D"): the Zuhause-Zone is gone for good.
-- Checked before: privacy_zones was empty (no zone for any account), no other column refers to it.
-- The triggers were removed in C4 (20261122180000).
drop function if exists public.drop_points_in_privacy_zone();
drop function if exists public.purge_points_in_new_zone();
drop table if exists public.privacy_zones;
