-- Internal DB-side keepalive to prevent Supabase free-tier auto-pause.
-- Runs inside Postgres via pg_cron so it counts as real database activity,
-- unlike an external REST GET (which was tried first via a homelab cron
-- hitting /rest/v1/profiles and did NOT prevent the project from pausing).

create extension if not exists pg_cron with schema extensions;

create table if not exists public._keepalive (
  id bigint generated always as identity primary key,
  pinged_at timestamptz not null default now()
);

alter table public._keepalive enable row level security;
-- No policies added on purpose: this table is only ever touched by the
-- cron job running as the postgres role (which bypasses RLS), so it's
-- inaccessible to anon/authenticated clients.

select cron.schedule(
  'plated-keepalive',
  '0 6 * * *', -- daily at 06:00 UTC
  $$
    insert into public._keepalive (pinged_at) values (now());
    delete from public._keepalive where pinged_at < now() - interval '30 days';
  $$
);

-- To verify it's registered: select * from cron.job where jobname = 'plated-keepalive';
-- To check run history:      select * from cron.job_run_details order by start_time desc limit 10;
-- To remove:                 select cron.unschedule('plated-keepalive');
