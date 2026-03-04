-- =============================================================================
-- Tech Pillar Hub — Phase 2: Engagement Layer
-- Migration: 00003_phase2_engagement.sql
-- Adds: profile columns (bio, ministry, cohort_year) + avatars storage bucket
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. EXPAND PROFILES TABLE
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column bio text,
  add column ministry text,
  add column cohort_year text;

-- ---------------------------------------------------------------------------
-- 2. AVATARS STORAGE BUCKET (public)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true);

-- Anyone can read public avatars
create policy storage_avatars_select on storage.objects
  for select using (bucket_id = 'avatars');

-- Users can upload to their own path: {user_id}/*
create policy storage_avatars_insert on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own avatars
create policy storage_avatars_update on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatars
create policy storage_avatars_delete on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
