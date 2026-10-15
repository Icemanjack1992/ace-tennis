-- =====================================================================
-- Ace Tennis — update 10: profile and news photos go to file storage (not into the database).
-- Every user uploads only into his own folder: photos/<user id>/…
-- =====================================================================
update storage.buckets set file_size_limit = 3145728, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] where id = 'photos';
drop policy if exists photos_insert on storage.objects;
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
