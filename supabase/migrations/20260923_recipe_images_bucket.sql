-- The recipe-images storage bucket, which src/lib/storage.js has uploaded to
-- since photo upload was added — but which was never created. Every manual
-- photo upload failed with "Bucket not found", and as of 2026-09-23 not one of
-- 34 recipes had a thumbnail.
--
-- The bucket itself was created through the storage API on 2026-09-23 (this
-- insert is a no-op if it exists). What the API can't do is the policy below:
-- the worker and /api/rehost-image upload with the service role, which skips
-- RLS, but the app's own "add a photo" upload runs as the signed-in user and
-- needs it. Run this in the Supabase SQL editor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-images', 'recipe-images', true, 10485760, array['image/*'])
on conflict (id) do nothing;

-- Public bucket, so reads need no policy: getPublicUrl() links are served
-- without auth. Writes are Jacob and Madi only, like every other table.
drop policy if exists "Linked partners manage recipe images" on storage.objects;
create policy "Linked partners manage recipe images" on storage.objects
  for all to authenticated
  using (bucket_id = 'recipe-images' and public.is_linked_partner())
  with check (bucket_id = 'recipe-images' and public.is_linked_partner());
