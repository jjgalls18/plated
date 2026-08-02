-- Plated — wire meal_plans up for real sync + Apple Calendar feed
--
-- meal_plans existed in the schema with correct grants/RLS but the app never
-- actually read or wrote to it (meal planning was local-only per device, via
-- Zustand/localStorage) — so it never synced between Jacob and Madi. This
-- adds the constraint the app's new upsert-based sync logic depends on, plus
-- a per-profile secret token so Apple Calendar can subscribe to a live feed
-- of the (now-shared) meal plan via /api/calendar/[token].ics.

alter table public.meal_plans
  add constraint meal_plans_slot_unique unique (week_start, day_of_week, meal_type);

alter table public.profiles
  add column if not exists calendar_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_calendar_token_idx on public.profiles (calendar_token);
