-- ============================================================
-- Phase 3 — Intelligence Layer
-- AI Chatbot, Sermon Lab, Flashcards with spaced repetition
-- ============================================================

-- ---------- enum ----------
create type public.flashcard_rating as enum ('again', 'hard', 'easy');

-- ---------- helper function ----------
create or replace function public.get_cohort_id_for_module(p_module_id uuid)
returns uuid
language sql security definer stable
set search_path = ''
as $$
  select cohort_id from public.modules where id = p_module_id limit 1;
$$;

-- ==========================================================
-- TABLE: chat_messages — AI chatbot conversation history
-- ==========================================================
create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  context     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- No updated_at — messages are immutable (insert-only)

create index idx_chat_messages_user_cohort on public.chat_messages(user_id, cohort_id);
create index idx_chat_messages_created_at  on public.chat_messages(created_at);

alter table public.chat_messages enable row level security;

-- Users see their own messages
create policy chat_messages_select_own on public.chat_messages
  for select using (user_id = auth.uid());

-- Staff can see all messages in their cohorts (moderation)
create policy chat_messages_select_staff on public.chat_messages
  for select using (public.is_cohort_staff(cohort_id));

-- Users insert their own messages (must be cohort member)
create policy chat_messages_insert_own on public.chat_messages
  for insert with check (
    user_id = auth.uid()
    and public.is_cohort_member(cohort_id)
  );

-- ==========================================================
-- TABLE: sermon_submissions — sermon text + AI feedback
-- ==========================================================
create table public.sermon_submissions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  title       text not null,
  sermon_text text not null,
  feedback    jsonb,
  status      text not null default 'pending' check (status in ('pending', 'analyzing', 'completed', 'error')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger sermon_submissions_updated_at before update on public.sermon_submissions
  for each row execute function extensions.moddatetime(updated_at);

create index idx_sermon_submissions_user_id   on public.sermon_submissions(user_id);
create index idx_sermon_submissions_cohort_id on public.sermon_submissions(cohort_id);
create index idx_sermon_submissions_status    on public.sermon_submissions(status);

alter table public.sermon_submissions enable row level security;

-- Users see own; staff sees all in cohort
create policy sermon_submissions_select on public.sermon_submissions
  for select using (
    user_id = auth.uid()
    or public.is_cohort_staff(cohort_id)
  );

-- Users insert own (must be cohort member)
create policy sermon_submissions_insert on public.sermon_submissions
  for insert with check (
    user_id = auth.uid()
    and public.is_cohort_member(cohort_id)
  );

-- Users update own; staff can update in cohort
create policy sermon_submissions_update on public.sermon_submissions
  for update using (
    user_id = auth.uid()
    or public.is_cohort_staff(cohort_id)
  );

-- ==========================================================
-- TABLE: flashcards — study cards per module
-- ==========================================================
create table public.flashcards (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.modules(id) on delete cascade,
  front       text not null,
  back        text not null,
  source      text not null default 'manual' check (source in ('manual', 'ai_generated')),
  created_by  uuid not null references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger flashcards_updated_at before update on public.flashcards
  for each row execute function extensions.moddatetime(updated_at);

create index idx_flashcards_module_id  on public.flashcards(module_id);
create index idx_flashcards_created_by on public.flashcards(created_by);

alter table public.flashcards enable row level security;

-- Cohort members can read flashcards in their modules
create policy flashcards_select_member on public.flashcards
  for select using (
    public.is_admin()
    or public.is_cohort_member(public.get_cohort_id_for_module(module_id))
  );

-- Staff can create flashcards
create policy flashcards_insert_staff on public.flashcards
  for insert with check (
    public.is_admin()
    or public.is_cohort_staff(public.get_cohort_id_for_module(module_id))
  );

-- Staff can update flashcards
create policy flashcards_update_staff on public.flashcards
  for update using (
    public.is_admin()
    or public.is_cohort_staff(public.get_cohort_id_for_module(module_id))
  );

-- Staff can delete flashcards
create policy flashcards_delete_staff on public.flashcards
  for delete using (
    public.is_admin()
    or public.is_cohort_staff(public.get_cohort_id_for_module(module_id))
  );

-- ==========================================================
-- TABLE: flashcard_reviews — per-user spaced repetition state
-- ==========================================================
create table public.flashcard_reviews (
  id              uuid primary key default gen_random_uuid(),
  flashcard_id    uuid not null references public.flashcards(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  rating          public.flashcard_rating not null,
  interval_days   integer not null default 1,
  ease_factor     numeric(4,2) not null default 2.50,
  next_review_at  timestamptz not null default now(),
  reviewed_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),

  constraint flashcard_reviews_unique unique (flashcard_id, user_id)
);

create index idx_flashcard_reviews_user_id      on public.flashcard_reviews(user_id);
create index idx_flashcard_reviews_flashcard_id  on public.flashcard_reviews(flashcard_id);
create index idx_flashcard_reviews_next_review   on public.flashcard_reviews(user_id, next_review_at);

alter table public.flashcard_reviews enable row level security;

-- Users see own reviews only
create policy flashcard_reviews_select_own on public.flashcard_reviews
  for select using (user_id = auth.uid());

-- Users insert own reviews
create policy flashcard_reviews_insert_own on public.flashcard_reviews
  for insert with check (user_id = auth.uid());

-- Users update own reviews (for upsert on re-review)
create policy flashcard_reviews_update_own on public.flashcard_reviews
  for update using (user_id = auth.uid());
