-- Raw recordings (compressed files) in Supabase Storage, one folder per user: spuren/<user_id>/<track_id>.json.gz
-- Private bucket; each user may only read and write inside their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spuren', 'spuren', false, 5242880, array['application/gzip', 'application/json'])
on conflict (id) do nothing;

create policy spuren_eigene_lesen on storage.objects for select to authenticated
  using (bucket_id = 'spuren' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy spuren_eigene_anlegen on storage.objects for insert to authenticated
  with check (bucket_id = 'spuren' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy spuren_eigene_aendern on storage.objects for update to authenticated
  using (bucket_id = 'spuren' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy spuren_eigene_loeschen on storage.objects for delete to authenticated
  using (bucket_id = 'spuren' and (storage.foldername(name))[1] = (select auth.uid())::text);
