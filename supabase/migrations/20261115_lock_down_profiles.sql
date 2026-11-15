-- Closes a path from "anyone on the internet" to "full read/write on everything".
--
-- Found in the 2026-11-15 audit. Three things lined up:
--
--   1. Public sign-ups are still enabled in Supabase Auth, and the anon key is
--      in the published JavaScript (as it has to be). So anyone can create an
--      account without ever seeing the app.
--   2. "Profiles: read all" let any signed-in account read every profile row —
--      including each person's user id, calendar_token and share_token.
--   3. "Profiles: update own" let an account set its OWN partner_id to anything.
--      is_linked_partner() only asks "does the caller have a partner_id?", so
--      pointing partner_id at a real user id was enough to pass every
--      "Linked partners full access" policy: recipes, grocery list, meal plan,
--      cook log, queue and the image bucket.
--
-- The 20260801 migration saw the stranger-signs-up problem and scoped the
-- tables to linked partners, but left the link itself self-service.
--
-- STEP 0, in the dashboard (not SQL), and the one that matters most:
--   Authentication -> Sign In / Providers -> turn OFF "Allow new users to sign up".
--   Then Authentication -> Users should list exactly two accounts. Delete any other.
--
-- This file is the second layer, so the data stays safe even if sign-ups are
-- ever switched back on. Run it once in the SQL editor. It is one transaction:
-- if any statement fails, nothing is changed.
--
-- After this, linking or unlinking partners is done here in the SQL editor
-- (update public.profiles set partner_id = ... where id = ...), not from the
-- app. The app's invite-code screen could never complete a link anyway — its
-- second step, updating the OTHER person's row, was always blocked by RLS.

begin;

-- ── 1. partner_id can no longer be changed by a signed-in user ────────────────
-- auth.uid() is null for the service role (the homelab worker, the Vercel
-- functions) and for the SQL editor, so those can still manage links.
create or replace function public.protect_profile_link()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.partner_id := null;
    elsif new.partner_id is distinct from old.partner_id then
      raise exception 'Partner links can only be changed by an administrator'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_link on public.profiles;
create trigger protect_profile_link
  before insert or update on public.profiles
  for each row execute function public.protect_profile_link();

-- ── 2. A profile is readable by its owner and their partner, nobody else ──────
-- "partner_id = auth.uid()" matches the row of whoever is linked TO the caller,
-- i.e. the caller's partner. No subquery on profiles, so no policy recursion.
drop policy if exists "Profiles: read all" on public.profiles;
drop policy if exists "Profiles: read own and partner" on public.profiles;
create policy "Profiles: read own and partner"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or partner_id = auth.uid());

-- ── 3. increment_made_count: linked partners only, and not callable signed-out ─
-- It is SECURITY DEFINER, so it skipped RLS entirely, and functions are
-- executable by PUBLIC unless revoked — the audit confirmed a request with only
-- the anon key was accepted (HTTP 204).
create or replace function public.increment_made_count(recipe_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.recipes
  set made_count = made_count + 1,
      updated_at = now()
  where id = recipe_id
    and public.is_linked_partner();
$$;

revoke execute on function public.increment_made_count(uuid) from public, anon;
grant  execute on function public.increment_made_count(uuid) to authenticated;

revoke execute on function public.is_linked_partner() from public, anon;
grant  execute on function public.is_linked_partner() to authenticated;

-- ── 4. Signed-out requests get no table access at all ─────────────────────────
-- RLS already returned nothing to anon; this makes it a refusal rather than an
-- empty result, matching the intent stated in schema.sql.
revoke all on public.profiles, public.recipes, public.made_it_log,
              public.grocery_items, public.pantry_items, public.meal_plans,
              public.couple_story, public.video_queue
  from anon;

commit;

-- To check it took (run separately, expect the three rows below):
--   select tgname from pg_trigger where tgname = 'protect_profile_link';
--   select policyname from pg_policies where tablename = 'profiles' order by 1;
--     -> Profiles: insert own / Profiles: read own and partner / Profiles: update own
