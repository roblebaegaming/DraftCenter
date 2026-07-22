-- DraftCenter milestone 17: profile-photo storage. Safe to run even if the
-- avatars bucket and policies were already created manually.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Public can view profile photos" on storage.objects;
create policy "Public can view profile photos" on storage.objects for select to public using (bucket_id = 'avatars');
drop policy if exists "Users upload only their own profile photos" on storage.objects;
create policy "Users upload only their own profile photos" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users update only their own profile photos" on storage.objects;
create policy "Users update only their own profile photos" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users delete only their own profile photos" on storage.objects;
create policy "Users delete only their own profile photos" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
