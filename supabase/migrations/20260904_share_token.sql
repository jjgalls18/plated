-- Per-person secret for the iOS "Save to Plated" shortcut.
--
-- Same shape and reasoning as calendar_token: iOS Shortcuts can't hold a
-- Supabase session, so the secret in the URL is the authorization. Kept
-- separate from calendar_token so either can be rotated without breaking
-- the other.
--
-- Safe to re-run.

alter table public.profiles
  add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists profiles_share_token_idx
  on public.profiles (share_token);
