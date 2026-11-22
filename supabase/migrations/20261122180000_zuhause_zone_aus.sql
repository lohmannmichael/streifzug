-- Bauplan 3, C4 (22.11.2026): no more Zuhause-Zone. Points inside a zone are stored like all
-- others, and creating a zone no longer deletes points. Table privacy_zones and the two functions
-- stay for now (rule 7); they are removed in D8 after Michi's yes.
drop trigger if exists received_points_privacy_zone on public.received_points;
drop trigger if exists privacy_zones_purge_points on public.privacy_zones;
