-- ============================================================
-- Phase 4 — Social Layer
-- Emoji reactions on discussions + Community feed per cohort
-- ============================================================

-- ==========================================================
-- TABLE: discussion_reactions — emoji reactions on assignment discussions
-- ==========================================================
create table public.discussion_reactions (
  id             uuid primary key default gen_random_uuid(),
  discussion_id  uuid not null references public.discussions(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  emoji          text not null check (emoji in ('👍', '❤️', '🙏', '💡', '🎉')),
  created_at     timestamptz not null default now(),

  constraint discussion_reactions_unique unique (discussion_id, user_id, emoji)
);

create index idx_discussion_reactions_discussion_id on public.discussion_reactions(discussion_id);
create index idx_discussion_reactions_user_id       on public.discussion_reactions(user_id);

alter table public.discussion_reactions enable row level security;

-- Members can read reactions in their cohort discussions
create policy discussion_reactions_select on public.discussion_reactions
  for select using (
    exists (
      select 1 from public.discussions d
      where d.id = discussion_id
      and public.is_cohort_member(public.get_cohort_id_for_assignment(d.assignment_id))
    )
  );

-- Users can insert own reactions (must be cohort member)
create policy discussion_reactions_insert on public.discussion_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.discussions d
      where d.id = discussion_id
      and public.is_cohort_member(public.get_cohort_id_for_assignment(d.assignment_id))
    )
  );

-- Users can delete own reactions
create policy discussion_reactions_delete on public.discussion_reactions
  for delete using (user_id = auth.uid());

-- ==========================================================
-- TABLE: community_posts — standalone cohort-scoped posts
-- ==========================================================
create table public.community_posts (
  id          uuid primary key default gen_random_uuid(),
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text,
  body        text not null,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger community_posts_updated_at before update on public.community_posts
  for each row execute function extensions.moddatetime(updated_at);

create index idx_community_posts_cohort    on public.community_posts(cohort_id, created_at desc);
create index idx_community_posts_user_id   on public.community_posts(user_id);

alter table public.community_posts enable row level security;

-- Cohort members can read
create policy community_posts_select on public.community_posts
  for select using (public.is_cohort_member(cohort_id));

-- Cohort members can create (own user_id)
create policy community_posts_insert on public.community_posts
  for insert with check (
    user_id = auth.uid()
    and public.is_cohort_member(cohort_id)
  );

-- Staff can update (for pinning); author can update own
create policy community_posts_update on public.community_posts
  for update using (
    user_id = auth.uid()
    or public.is_cohort_staff(cohort_id)
  );

-- Author or staff can delete
create policy community_posts_delete on public.community_posts
  for delete using (
    user_id = auth.uid()
    or public.is_cohort_staff(cohort_id)
  );

-- ==========================================================
-- TABLE: community_comments — replies on community posts
-- ==========================================================
create table public.community_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  parent_id   uuid references public.community_comments(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger community_comments_updated_at before update on public.community_comments
  for each row execute function extensions.moddatetime(updated_at);

create index idx_community_comments_post_id   on public.community_comments(post_id);
create index idx_community_comments_user_id   on public.community_comments(user_id);
create index idx_community_comments_parent_id on public.community_comments(parent_id);

alter table public.community_comments enable row level security;

-- Helper: get cohort_id from a community post
create or replace function public.get_cohort_id_for_post(p_post_id uuid)
returns uuid
language sql security definer stable
set search_path = ''
as $$
  select cohort_id from public.community_posts where id = p_post_id limit 1;
$$;

-- Members can read
create policy community_comments_select on public.community_comments
  for select using (
    public.is_cohort_member(public.get_cohort_id_for_post(post_id))
  );

-- Members can insert (own user_id)
create policy community_comments_insert on public.community_comments
  for insert with check (
    user_id = auth.uid()
    and public.is_cohort_member(public.get_cohort_id_for_post(post_id))
  );

-- Author or staff can update
create policy community_comments_update on public.community_comments
  for update using (
    user_id = auth.uid()
    or public.is_cohort_staff(public.get_cohort_id_for_post(post_id))
  );

-- Author or staff can delete
create policy community_comments_delete on public.community_comments
  for delete using (
    user_id = auth.uid()
    or public.is_cohort_staff(public.get_cohort_id_for_post(post_id))
  );

-- ==========================================================
-- TABLE: community_reactions — reactions on posts and comments
-- ==========================================================
create table public.community_reactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  post_id     uuid references public.community_posts(id) on delete cascade,
  comment_id  uuid references public.community_comments(id) on delete cascade,
  emoji       text not null check (emoji in ('👍', '❤️', '🙏', '💡', '🎉')),
  created_at  timestamptz not null default now(),

  -- Exactly one of post_id or comment_id must be set
  constraint community_reactions_target check (
    (post_id is not null and comment_id is null)
    or (post_id is null and comment_id is not null)
  )
);

-- Unique per user per target per emoji
create unique index idx_community_reactions_post_unique
  on public.community_reactions(user_id, post_id, emoji) where post_id is not null;
create unique index idx_community_reactions_comment_unique
  on public.community_reactions(user_id, comment_id, emoji) where comment_id is not null;

create index idx_community_reactions_post_id    on public.community_reactions(post_id);
create index idx_community_reactions_comment_id on public.community_reactions(comment_id);

alter table public.community_reactions enable row level security;

-- Members can read (via post's cohort)
create policy community_reactions_select on public.community_reactions
  for select using (
    (post_id is not null and public.is_cohort_member(public.get_cohort_id_for_post(post_id)))
    or (comment_id is not null and exists (
      select 1 from public.community_comments c
      where c.id = comment_id
      and public.is_cohort_member(public.get_cohort_id_for_post(c.post_id))
    ))
  );

-- Users can insert own reactions
create policy community_reactions_insert on public.community_reactions
  for insert with check (user_id = auth.uid());

-- Users can delete own reactions
create policy community_reactions_delete on public.community_reactions
  for delete using (user_id = auth.uid());
