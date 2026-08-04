-- Plated - Supabase Schema
-- Full rebuild reference. Run in Supabase SQL editor on a fresh project.
-- For existing projects, run everything under supabase/migrations/ in order instead.

create extension if not exists "uuid-ossp";

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table public.profiles (
  id             uuid references auth.users(id) on delete cascade primary key,
  display_name   text,
  avatar_url     text,
  partner_id     uuid references auth.users(id),
  invite_code    text unique,
  ai_enabled     boolean default false,
  streak         integer default 0,
  calendar_token uuid not null default gen_random_uuid(),
  created_at     timestamptz default now()
);

create unique index profiles_calendar_token_idx on public.profiles (calendar_token);

create table public.recipes (
  id            uuid default gen_random_uuid() primary key,
  title         text not null,
  description   text,
  source_url    text,
  thumbnail_url text,
  ingredients   jsonb default '[]'::jsonb,
  steps         jsonb default '[]'::jsonb,
  tags          text[] default '{}',
  prep_time     integer,
  cook_time     integer,
  servings      integer default 4,
  rating        integer check (rating >= 1 and rating <= 5),
  made_count    integer default 0,
  is_favorite   boolean not null default false,
  created_by    uuid references auth.users(id),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table public.made_it_log (
  id         uuid default gen_random_uuid() primary key,
  recipe_id  uuid references public.recipes(id) on delete cascade,
  user_id    uuid references auth.users(id),
  rating     integer check (rating >= 1 and rating <= 5),
  notes      text,
  photo_url  text,
  cooked_at  timestamptz default now()
);

create table public.grocery_items (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id),
  name       text not null,
  amount     text,
  category   text,
  checked    boolean default false,
  recipe_id  uuid references public.recipes(id) on delete set null,
  created_at timestamptz default now()
);

create table public.pantry_items (
  id          uuid default gen_random_uuid() primary key,
  name        text not null,
  quantity    text,
  unit        text,
  category    text,
  running_low boolean default false,
  created_at  timestamptz default now()
);

create table public.meal_plans (
  id           uuid default gen_random_uuid() primary key,
  week_start   date not null,
  day_of_week  integer not null check (day_of_week >= 0 and day_of_week <= 6),
  meal_type    text not null default 'dinner',
  recipe_id    uuid references public.recipes(id) on delete cascade,
  created_at   timestamptz default now(),
  unique (week_start, day_of_week, meal_type)
);

-- Singleton "About Us" content — one shared row for the whole household.
create table public.couple_story (
  id         uuid primary key default gen_random_uuid(),
  photo_url  text,
  story      text,
  updated_at timestamptz default now()
);

-- Enforces true singleton at the DB level (constant expression -> at most
-- one row can ever satisfy the index) so a race between two first-time
-- saves can't produce two untethered rows.
create unique index couple_story_singleton_idx on public.couple_story ((true));

-- Video import queue — see migrations/20260805_video_queue.sql for the why.
create table public.video_queue (
  id                uuid primary key default gen_random_uuid(),
  url               text not null,
  status            text not null default 'queued'
                      check (status in ('queued', 'partial', 'processing', 'complete', 'failed')),
  caption_text      text,
  partial_recipe    jsonb,
  transcript_text   text,
  final_recipe_id   uuid references public.recipes(id) on delete set null,
  error_message     text,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index video_queue_status_idx on public.video_queue (status);

-- ─── Functions ────────────────────────────────────────────────────────────────

create or replace function public.increment_made_count(recipe_id uuid)
returns void as $$
  update public.recipes
  set made_count = made_count + 1,
      updated_at = now()
  where id = recipe_id;
$$ language sql security definer;

-- ─── Schema-level grants ──────────────────────────────────────────────────────
-- Required explicitly as of Supabase's May 30 2026 security policy change.

grant usage on schema public to anon, authenticated;

-- ─── Table-level grants ───────────────────────────────────────────────────────
-- anon gets no table access — all routes require authentication.
-- authenticated gets full CRUD; RLS policies below enforce fine-grained rules.

grant select, insert, update, delete on public.profiles      to authenticated;
grant select, insert, update, delete on public.recipes        to authenticated;
grant select, insert, update, delete on public.made_it_log    to authenticated;
grant select, insert, update, delete on public.grocery_items  to authenticated;
grant select, insert, update, delete on public.pantry_items   to authenticated;
grant select, insert, update, delete on public.meal_plans     to authenticated;
grant select, insert, update, delete on public.couple_story   to authenticated;
grant select, insert, update, delete on public.video_queue    to authenticated;

-- ─── Function grants ──────────────────────────────────────────────────────────

grant execute on function public.increment_made_count(uuid) to authenticated;

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.profiles      enable row level security;
alter table public.recipes        enable row level security;
alter table public.made_it_log    enable row level security;
alter table public.grocery_items  enable row level security;
alter table public.pantry_items   enable row level security;
alter table public.meal_plans     enable row level security;
alter table public.couple_story   enable row level security;
alter table public.video_queue    enable row level security;

-- Profiles: reads are open to all authenticated users (partner lookups, cook log
-- display names, invite-code joins all query other users' rows). Writes are
-- restricted to the profile owner.
create policy "Profiles: read all"
  on public.profiles for select
  to authenticated using (true);

create policy "Profiles: insert own"
  on public.profiles for insert
  to authenticated with check (id = auth.uid());

create policy "Profiles: update own"
  on public.profiles for update
  to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- All other tables are a shared cookbook: any LINKED partner can do anything
-- (finer-grained ownership filtering happens at the app layer). Scoped to
-- linked profiles rather than `using (true)` so a stranger who signs up
-- directly against the public anon key — bypassing the app's UI, which has
-- no sign-up form — gets nothing. See migrations/20260801_scope_rls_to_linked_partners.sql.
-- Still disable public sign-ups in the Supabase Auth dashboard as the primary defense.
create or replace function public.is_linked_partner()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and partner_id is not null
  );
$$ language sql stable security definer set search_path = public;

grant execute on function public.is_linked_partner() to authenticated;

create policy "Linked partners full access" on public.recipes
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());

create policy "Linked partners full access" on public.made_it_log
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());

create policy "Linked partners full access" on public.grocery_items
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());

create policy "Linked partners full access" on public.pantry_items
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());

create policy "Linked partners full access" on public.meal_plans
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());

create policy "Linked partners full access" on public.couple_story
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());

create policy "Linked partners full access" on public.video_queue
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());
