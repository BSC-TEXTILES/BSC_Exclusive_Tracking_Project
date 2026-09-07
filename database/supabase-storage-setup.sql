-- ============================================================
-- BSC Exclusive Tracking — Supabase Storage setup
-- Run this ONCE in your Supabase project (SQL Editor → New query)
-- Creates the public "evidence" bucket used when
-- FILE_STORAGE_TYPE=supabase on the backend.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  true,          -- public bucket: files get direct public URLs
  26214400,      -- 25 MB per file
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/csv', 'application/vnd.ms-excel',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg',
    'audio/webm', 'audio/x-m4a', 'audio/aac'
  ]
)
on conflict (id) do nothing;

-- Allow public read access to the bucket
create policy "Public read evidence"
  on storage.objects for select
  using (bucket_id = 'evidence');
