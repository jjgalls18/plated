-- Plated — scope shared-cookbook RLS to linked partners only
--
-- Problem: recipes, made_it_log, grocery_items, pantry_items, and meal_plans
-- all use `using (true) with check (true)` — any row in any of these tables
-- is readable/writable by ANY authenticated Supabase user, not just Jacob
-- and Madi. The Supabase anon key is public (shipped in the app bundle, as
-- intended), so anyone who calls supabase.auth.signUp() directly — bypassing
-- the app's UI, which has no sign-up form — becomes "authenticated" and
-- would get full read/write on all of the couple's data.
--
-- Primary fix (do this too, not instead of this migration): in the Supabase
-- dashboard, go to Authentication -> Providers -> Email and disable public
-- sign-ups (or restrict to an allow-list). That's what actually stops a
-- stranger from becoming "authenticated" in the first place.
--
-- This migration is defense-in-depth: even if a third party manages to
-- create an account, they get nothing, because these policies now require
-- the caller to already be a *linked* profile (partner_id is not null).
-- Jacob and Madi are linked directly via SQL already, so nothing changes
-- for them. Run this in the Supabase SQL editor.

create or replace function public.is_linked_partner()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and partner_id is not null
  );
$$ language sql stable security definer set search_path = public;

grant execute on function public.is_linked_partner() to authenticated;

drop policy if exists "Authenticated full access" on public.recipes;
create policy "Linked partners full access" on public.recipes
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());

drop policy if exists "Authenticated full access" on public.made_it_log;
create policy "Linked partners full access" on public.made_it_log
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());

drop policy if exists "Authenticated full access" on public.grocery_items;
create policy "Linked partners full access" on public.grocery_items
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());

drop policy if exists "Authenticated full access" on public.pantry_items;
create policy "Linked partners full access" on public.pantry_items
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());

drop policy if exists "Authenticated full access" on public.meal_plans;
create policy "Linked partners full access" on public.meal_plans
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());
