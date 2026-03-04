-- =============================================================================
-- Tech Pillar Hub — Phase 1: Interactive Core
-- Migration: 00002_phase1_interactive.sql
-- Adds: profiles, submissions, discussions tables + RLS + storage bucket
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. NEW ENUM TYPE
-- ---------------------------------------------------------------------------
create type public.submission_status as enum ('draft', 'submitted', 'graded', 'returned');

-- ---------------------------------------------------------------------------
-- 2. NEW TABLES
-- ---------------------------------------------------------------------------

-- PROFILES — user display info (lazy-created on first page load)
create table public.profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint profiles_user_unique unique (user_id)
);

-- SUBMISSIONS — one per student per assignment
create table public.submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  content        text,
  file_url       text,
  status         public.submission_status not null default 'draft',
  grade          numeric(6,2),
  feedback       text,
  submitted_at   timestamptz,
  graded_at      timestamptz,
  graded_by      uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint submissions_user_assignment_unique unique (assignment_id, user_id)
);

-- DISCUSSIONS — threaded comments on assignments
create table public.discussions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  parent_id      uuid references public.discussions(id) on delete cascade,
  body           text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. AUTO-UPDATE TRIGGERS
-- ---------------------------------------------------------------------------
create trigger profiles_updated_at    before update on public.profiles    for each row execute function extensions.moddatetime(updated_at);
create trigger submissions_updated_at before update on public.submissions for each row execute function extensions.moddatetime(updated_at);
create trigger discussions_updated_at before update on public.discussions for each row execute function extensions.moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- 4. INDEXES
-- ---------------------------------------------------------------------------

-- profiles
create index idx_profiles_user_id on public.profiles(user_id);

-- submissions
create index idx_submissions_assignment_id on public.submissions(assignment_id);
create index idx_submissions_user_id       on public.submissions(user_id);
create index idx_submissions_status        on public.submissions(status);

-- discussions
create index idx_discussions_assignment_id on public.discussions(assignment_id);
create index idx_discussions_parent_id     on public.discussions(parent_id);
create index idx_discussions_user_id       on public.discussions(user_id);

-- ---------------------------------------------------------------------------
-- 5. HELPER FUNCTION: resolve assignment → cohort_id
-- ---------------------------------------------------------------------------
create or replace function public.get_cohort_id_for_assignment(p_assignment_id uuid)
returns uuid
language sql security definer stable
set search_path = ''
as $$
  select m.cohort_id
  from public.modules m
  join public.assignments a on a.module_id = m.id
  where a.id = p_assignment_id
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

-- === PROFILES ===
alter table public.profiles enable row level security;

create policy profiles_select_authenticated on public.profiles
  for select using (auth.uid() is not null);

create policy profiles_insert_own on public.profiles
  for insert with check (user_id = auth.uid());

create policy profiles_update_own on public.profiles
  for update using (user_id = auth.uid());

-- === SUBMISSIONS ===
alter table public.submissions enable row level security;

-- Students see own submissions; staff sees all in their cohorts
create policy submissions_select on public.submissions
  for select using (
    user_id = auth.uid()
    or public.is_cohort_staff(public.get_cohort_id_for_assignment(assignment_id))
  );

-- Students can insert own submissions (must be cohort member)
create policy submissions_insert_student on public.submissions
  for insert with check (
    user_id = auth.uid()
    and public.is_cohort_member(public.get_cohort_id_for_assignment(assignment_id))
  );

-- Students update own draft/returned; staff updates any (for grading)
create policy submissions_update on public.submissions
  for update using (
    (user_id = auth.uid() and status in ('draft', 'returned'))
    or public.is_cohort_staff(public.get_cohort_id_for_assignment(assignment_id))
  );

-- === DISCUSSIONS ===
alter table public.discussions enable row level security;

-- All cohort members can read
create policy discussions_select_member on public.discussions
  for select using (
    public.is_cohort_member(public.get_cohort_id_for_assignment(assignment_id))
  );

-- All cohort members can create (own user_id)
create policy discussions_insert_member on public.discussions
  for insert with check (
    user_id = auth.uid()
    and public.is_cohort_member(public.get_cohort_id_for_assignment(assignment_id))
  );

-- Only author or staff can update
create policy discussions_update on public.discussions
  for update using (
    user_id = auth.uid()
    or public.is_cohort_staff(public.get_cohort_id_for_assignment(assignment_id))
  );

-- Only author or staff can delete
create policy discussions_delete on public.discussions
  for delete using (
    user_id = auth.uid()
    or public.is_cohort_staff(public.get_cohort_id_for_assignment(assignment_id))
  );

-- ---------------------------------------------------------------------------
-- 7. SUPABASE STORAGE — submissions bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('submissions', 'submissions', false);

-- Students can upload to their own path: {cohort_id}/{assignment_id}/{user_id}/*
create policy storage_submissions_insert on storage.objects
  for insert with check (
    bucket_id = 'submissions'
    and auth.uid() is not null
    and (storage.foldername(name))[3] = auth.uid()::text
  );

-- Students can read their own files
create policy storage_submissions_select_own on storage.objects
  for select using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[3] = auth.uid()::text
  );
