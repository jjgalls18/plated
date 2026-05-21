-- Migration: Supabase security grant fix
-- Run this in the Supabase SQL editor on the live project.
-- Required BEFORE May 30 2026 (table grants) and October 30 2026 (existing project migration).
--
-- Safe to run multiple times — all statements use IF NOT EXISTS / IF EXISTS / OR REPLACE.

-- 1. Add invite_code column (added after initial schema, missing from schema.sql)
alter table public.profiles add column if not exists invite_code text unique;

-- 2. Schema-level grants (required for all queries to work post-May 30)
grant usage on schema public to anon, authenticated;

-- 3. Explicit table grants for authenticated role
grant select, insert, update, delete on public.profiles      to authenticated;
grant select, insert, update, delete on public.recipes        to authenticated;
grant select, insert, update, delete on public.made_it_log    to authenticated;
grant select, insert, update, delete on public.grocery_items  to authenticated;
grant select, insert, update, delete on public.pantry_items   to authenticated;
grant select, insert, update, delete on public.meal_plans     to authenticated;

-- 4. Function grant
grant execute on function public.increment_made_count(uuid) to authenticated;

-- 5. Fix profiles RLS
--    The old "for all using (id = auth.uid())" policy blocks reading other users'
--    profiles, which breaks partner lookups, cook log display names, and invite-code
--    joins. Replace it with separate read/write policies.
drop policy if exists "Users can manage own profile" on public.profiles;

create policy "Profiles: read all"
  on public.profiles for select
  to authenticated using (true);

create policy "Profiles: insert own"
  on public.profiles for insert
  to authenticated with check (id = auth.uid());

create policy "Profiles: update own"
  on public.profiles for update
  to authenticated using (id = auth.uid()) with check (id = auth.uid());
