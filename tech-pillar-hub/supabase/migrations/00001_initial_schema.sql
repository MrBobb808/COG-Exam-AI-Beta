-- =============================================================================
-- Tech Pillar Hub — Initial Database Schema
-- Migration: 00001_initial_schema.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------------
create extension if not exists "moddatetime" with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------------
create type public.app_role       as enum ('admin', 'instructor', 'student');
create type public.content_source as enum ('google_classroom', 'native');
create type public.member_status  as enum ('active', 'inactive', 'invited');

-- ---------------------------------------------------------------------------
-- 2. CORE TABLES
-- ---------------------------------------------------------------------------

-- COHORTS — equivalent to a Google Classroom "Course"
create table public.cohorts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid not null references auth.users(id) on delete cascade,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- COHORT MEMBERS — links users to cohorts with a role
create table public.cohort_members (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references public.cohorts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.app_role      not null default 'student',
  status     public.member_status not null default 'active',
  joined_at  timestamptz not null default now(),

  constraint cohort_members_unique unique (cohort_id, user_id)
);

-- MODULES — groups content within a cohort (maps to GC "Topics")
create table public.modules (
  id          uuid primary key default gen_random_uuid(),
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  title       text not null,
  description text,
  position    integer not null default 0,
  source      public.content_source not null default 'native',
  google_id   text,
  created_by  uuid not null references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RESOURCES — supplementary materials (maps to GC "Materials")
create table public.resources (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.modules(id) on delete cascade,
  title       text not null,
  description text,
  url         text,
  position    integer not null default 0,
  source      public.content_source not null default 'native',
  google_id   text,
  metadata    jsonb not null default '{}',
  created_by  uuid not null references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ANNOUNCEMENTS — broadcast messages (maps to GC "Announcements")
create table public.announcements (
  id            uuid primary key default gen_random_uuid(),
  module_id     uuid not null references public.modules(id) on delete cascade,
  title         text not null,
  body          text,
  published     boolean not null default false,
  scheduled_at  timestamptz,
  source        public.content_source not null default 'native',
  google_id     text,
  created_by    uuid not null references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ASSIGNMENTS — graded work (maps to GC "CourseWork")
create table public.assignments (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.modules(id) on delete cascade,
  title       text not null,
  description text,
  due_at      timestamptz,
  max_points  numeric(6,2),
  position    integer not null default 0,
  source      public.content_source not null default 'native',
  google_id   text,
  metadata    jsonb not null default '{}',
  created_by  uuid not null references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. GOOGLE CLASSROOM INTEGRATION TABLES
-- ---------------------------------------------------------------------------

-- GC_CONNECTIONS — admin OAuth link; refresh_token_ref points to Vault
create table public.gc_connections (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  google_email      text not null,
  refresh_token_ref text not null,
  scopes            text[] not null default '{}',
  is_valid          boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint gc_connections_user_unique unique (user_id)
);

-- GC_COURSE_MAPPINGS — 1:1 cohort ↔ Google course
create table public.gc_course_mappings (
  id                uuid primary key default gen_random_uuid(),
  cohort_id         uuid not null references public.cohorts(id) on delete cascade,
  google_course_id  text not null,
  gc_connection_id  uuid not null references public.gc_connections(id) on delete cascade,
  course_name       text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),

  constraint gc_course_mappings_cohort_unique unique (cohort_id),
  constraint gc_course_mappings_google_unique unique (google_course_id)
);

-- GC_SYNC_STATE — per-course sync cursor with JSONB page tokens
create table public.gc_sync_state (
  id                   uuid primary key default gen_random_uuid(),
  gc_course_mapping_id uuid not null references public.gc_course_mappings(id) on delete cascade,
  last_synced_at       timestamptz,
  sync_status          text not null default 'idle'
                       check (sync_status in ('idle', 'syncing', 'error', 'completed')),
  page_tokens          jsonb not null default '{}',
  last_error           text,
  items_synced         integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint gc_sync_state_mapping_unique unique (gc_course_mapping_id)
);

-- ---------------------------------------------------------------------------
-- 4. AUTO-UPDATE TRIGGERS (moddatetime)
-- ---------------------------------------------------------------------------
create trigger cohorts_updated_at       before update on public.cohorts       for each row execute function extensions.moddatetime(updated_at);
create trigger modules_updated_at       before update on public.modules       for each row execute function extensions.moddatetime(updated_at);
create trigger resources_updated_at     before update on public.resources     for each row execute function extensions.moddatetime(updated_at);
create trigger announcements_updated_at before update on public.announcements for each row execute function extensions.moddatetime(updated_at);
create trigger assignments_updated_at   before update on public.assignments   for each row execute function extensions.moddatetime(updated_at);
create trigger gc_connections_updated_at before update on public.gc_connections for each row execute function extensions.moddatetime(updated_at);
create trigger gc_sync_state_updated_at  before update on public.gc_sync_state  for each row execute function extensions.moddatetime(updated_at);

-- ---------------------------------------------------------------------------
-- 5. INDEXES
-- ---------------------------------------------------------------------------
-- Postgres does NOT auto-index FK columns. We also add partial unique
-- indexes on google_id and filtered indexes on commonly queried columns.
-- ---------------------------------------------------------------------------

-- cohorts
create index idx_cohorts_created_by on public.cohorts(created_by);
create index idx_cohorts_archived   on public.cohorts(archived) where not archived;

-- cohort_members
create index idx_cohort_members_cohort_id on public.cohort_members(cohort_id);
create index idx_cohort_members_user_id   on public.cohort_members(user_id);
create index idx_cohort_members_role      on public.cohort_members(cohort_id, role);
create index idx_cohort_members_active    on public.cohort_members(user_id, status) where status = 'active';

-- modules
create index        idx_modules_cohort_id on public.modules(cohort_id);
create index        idx_modules_position  on public.modules(cohort_id, position);
create unique index idx_modules_google_id on public.modules(google_id) where google_id is not null;

-- resources
create index        idx_resources_module_id on public.resources(module_id);
create unique index idx_resources_google_id on public.resources(google_id) where google_id is not null;

-- announcements
create index        idx_announcements_module_id on public.announcements(module_id);
create index        idx_announcements_published on public.announcements(module_id, published);
create unique index idx_announcements_google_id on public.announcements(google_id) where google_id is not null;

-- assignments
create index        idx_assignments_module_id on public.assignments(module_id);
create index        idx_assignments_due_at    on public.assignments(due_at) where due_at is not null;
create unique index idx_assignments_google_id on public.assignments(google_id) where google_id is not null;

-- gc tables
create index idx_gc_connections_user_id           on public.gc_connections(user_id);
create index idx_gc_course_mappings_cohort_id     on public.gc_course_mappings(cohort_id);
create index idx_gc_course_mappings_google_course on public.gc_course_mappings(google_course_id);
create index idx_gc_sync_state_mapping_id         on public.gc_sync_state(gc_course_mapping_id);

-- ---------------------------------------------------------------------------
-- 6. RLS HELPER FUNCTIONS (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql security definer stable
set search_path = ''
as $$
  select exists (
    select 1 from public.cohort_members
    where user_id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function public.get_cohort_role(p_cohort_id uuid)
returns public.app_role
language sql security definer stable
set search_path = ''
as $$
  select role from public.cohort_members
  where cohort_id = p_cohort_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

create or replace function public.is_cohort_staff(p_cohort_id uuid)
returns boolean
language sql security definer stable
set search_path = ''
as $$
  select exists (
    select 1 from public.cohort_members
    where cohort_id = p_cohort_id
      and user_id = auth.uid()
      and role in ('admin', 'instructor')
      and status = 'active'
  );
$$;

create or replace function public.is_cohort_member(p_cohort_id uuid)
returns boolean
language sql security definer stable
set search_path = ''
as $$
  select exists (
    select 1 from public.cohort_members
    where cohort_id = p_cohort_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.no_admins_exist()
returns boolean
language sql security definer stable
set search_path = ''
as $$
  select not exists (
    select 1 from public.cohort_members
    where role = 'admin' and status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
-- Naming: {table}_{operation}_{who}
-- Rules:
--   Admins  → full CRUD everywhere
--   Staff   → manage content in their cohorts
--   Members → read content in their cohorts
--   gc_*    → admin-only
-- ---------------------------------------------------------------------------

-- === COHORTS ===
alter table public.cohorts enable row level security;

create policy cohorts_select_member on public.cohorts
  for select using (public.is_admin() or public.is_cohort_member(id));

create policy cohorts_insert_admin on public.cohorts
  for insert with check (public.is_admin());

create policy cohorts_update_staff on public.cohorts
  for update using (public.is_admin() or public.is_cohort_staff(id));

create policy cohorts_delete_admin on public.cohorts
  for delete using (public.is_admin());

-- === COHORT MEMBERS ===
alter table public.cohort_members enable row level security;

create policy cohort_members_select on public.cohort_members
  for select using (public.is_admin() or public.is_cohort_member(cohort_id));

create policy cohort_members_insert on public.cohort_members
  for insert with check (public.is_admin() or public.is_cohort_staff(cohort_id));

create policy cohort_members_update on public.cohort_members
  for update using (public.is_admin() or public.is_cohort_staff(cohort_id));

create policy cohort_members_delete on public.cohort_members
  for delete using (public.is_admin());

-- === MODULES ===
alter table public.modules enable row level security;

create policy modules_select_member on public.modules
  for select using (public.is_admin() or public.is_cohort_member(cohort_id));

create policy modules_insert_staff on public.modules
  for insert with check (public.is_admin() or public.is_cohort_staff(cohort_id));

create policy modules_update_staff on public.modules
  for update using (public.is_admin() or public.is_cohort_staff(cohort_id));

create policy modules_delete_staff on public.modules
  for delete using (public.is_admin() or public.is_cohort_staff(cohort_id));

-- === RESOURCES ===
alter table public.resources enable row level security;

create policy resources_select_member on public.resources
  for select using (
    public.is_admin()
    or exists (select 1 from public.modules m where m.id = module_id and public.is_cohort_member(m.cohort_id))
  );

create policy resources_insert_staff on public.resources
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.modules m where m.id = module_id and public.is_cohort_staff(m.cohort_id))
  );

create policy resources_update_staff on public.resources
  for update using (
    public.is_admin()
    or exists (select 1 from public.modules m where m.id = module_id and public.is_cohort_staff(m.cohort_id))
  );

create policy resources_delete_staff on public.resources
  for delete using (
    public.is_admin()
    or exists (select 1 from public.modules m where m.id = module_id and public.is_cohort_staff(m.cohort_id))
  );

-- === ANNOUNCEMENTS ===
-- Students only see published announcements; staff sees all.
alter table public.announcements enable row level security;

create policy announcements_select_member on public.announcements
  for select using (
    public.is_admin()
    or exists (select 1 from public.modules m where m.id = module_id and public.is_cohort_staff(m.cohort_id))
    or (published = true and exists (
      select 1 from public.modules m where m.id = module_id and public.is_cohort_member(m.cohort_id)
    ))
  );

create policy announcements_insert_staff on public.announcements
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.modules m where m.id = module_id and public.is_cohort_staff(m.cohort_id))
  );

create policy announcements_update_staff on public.announcements
  for update using (
    public.is_admin()
    or exists (select 1 from public.modules m where m.id = module_id and public.is_cohort_staff(m.cohort_id))
  );

create policy announcements_delete_staff on public.announcements
  for delete using (
    public.is_admin()
    or exists (select 1 from public.modules m where m.id = module_id and public.is_cohort_staff(m.cohort_id))
  );

-- === ASSIGNMENTS ===
alter table public.assignments enable row level security;

create policy assignments_select_member on public.assignments
  for select using (
    public.is_admin()
    or exists (select 1 from public.modules m where m.id = module_id and public.is_cohort_member(m.cohort_id))
  );

create policy assignments_insert_staff on public.assignments
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.modules m where m.id = module_id and public.is_cohort_staff(m.cohort_id))
  );

create policy assignments_update_staff on public.assignments
  for update using (
    public.is_admin()
    or exists (select 1 from public.modules m where m.id = module_id and public.is_cohort_staff(m.cohort_id))
  );

create policy assignments_delete_staff on public.assignments
  for delete using (
    public.is_admin()
    or exists (select 1 from public.modules m where m.id = module_id and public.is_cohort_staff(m.cohort_id))
  );

-- === GC_CONNECTIONS (admin-only) ===
alter table public.gc_connections enable row level security;

create policy gc_connections_admin_select on public.gc_connections for select using (public.is_admin());
create policy gc_connections_admin_insert on public.gc_connections for insert with check (public.is_admin());
create policy gc_connections_admin_update on public.gc_connections for update using (public.is_admin());
create policy gc_connections_admin_delete on public.gc_connections for delete using (public.is_admin());

-- === GC_COURSE_MAPPINGS (admin-only) ===
alter table public.gc_course_mappings enable row level security;

create policy gc_course_mappings_admin_select on public.gc_course_mappings for select using (public.is_admin());
create policy gc_course_mappings_admin_insert on public.gc_course_mappings for insert with check (public.is_admin());
create policy gc_course_mappings_admin_update on public.gc_course_mappings for update using (public.is_admin());
create policy gc_course_mappings_admin_delete on public.gc_course_mappings for delete using (public.is_admin());

-- === GC_SYNC_STATE (admin-only) ===
alter table public.gc_sync_state enable row level security;

create policy gc_sync_state_admin_select on public.gc_sync_state for select using (public.is_admin());
create policy gc_sync_state_admin_insert on public.gc_sync_state for insert with check (public.is_admin());
create policy gc_sync_state_admin_update on public.gc_sync_state for update using (public.is_admin());
create policy gc_sync_state_admin_delete on public.gc_sync_state for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 8. BOOTSTRAP POLICIES
-- ---------------------------------------------------------------------------
-- When zero admins exist, allow the first user to self-bootstrap.
-- Once an admin exists these policies become inert.
-- ---------------------------------------------------------------------------

create policy cohorts_bootstrap on public.cohorts
  for insert with check (
    public.no_admins_exist() and created_by = auth.uid()
  );

create policy cohort_members_bootstrap on public.cohort_members
  for insert with check (
    public.no_admins_exist() and role = 'admin' and user_id = auth.uid()
  );
