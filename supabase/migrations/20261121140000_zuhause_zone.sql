-- Zuhause-Zone (Bauplan 11.3, Michi 21.11.2026: Punkte dort beim Empfang verwerfen).
-- Points from Overland inside one of the user's privacy zones are never stored; when a zone is
-- created or moved, points already stored inside it are deleted.

create or replace function public.drop_points_in_privacy_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.privacy_zones z
    where z.user_id = new.user_id
      and extensions.st_dwithin(z.center, extensions.st_setsrid(extensions.st_makepoint(new.lon, new.lat), 4326)::extensions.geography, z.radius_m)
  ) then
    return null;
  end if;
  return new;
end;
$$;

create trigger received_points_privacy_zone
  before insert on public.received_points
  for each row execute function public.drop_points_in_privacy_zone();

create or replace function public.purge_points_in_new_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.received_points p
  where p.user_id = new.user_id
    and extensions.st_dwithin(new.center, extensions.st_setsrid(extensions.st_makepoint(p.lon, p.lat), 4326)::extensions.geography, new.radius_m);
  return new;
end;
$$;

create trigger privacy_zones_purge_points
  after insert or update on public.privacy_zones
  for each row execute function public.purge_points_in_new_zone();

-- Trigger functions are not meant to be called through the API.
revoke execute on function public.drop_points_in_privacy_zone() from public, anon, authenticated;
revoke execute on function public.purge_points_in_new_zone() from public, anon, authenticated;
