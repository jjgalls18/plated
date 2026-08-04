-- Plated — video import queue (updateV1)
--
-- Backs Quick Save + pre-processing: when a TikTok/Instagram link can't be
-- processed immediately (self-hosted Cobalt unreachable), it's saved here
-- instead of failing. caption_text/partial_recipe get filled in right away
-- from the page's caption (no Cobalt needed for that part); transcript_text
-- and the merged final recipe get filled in later once Cobalt is reachable.

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

grant select, insert, update, delete on public.video_queue to authenticated;

alter table public.video_queue enable row level security;

create policy "Linked partners full access" on public.video_queue
  for all to authenticated using (public.is_linked_partner()) with check (public.is_linked_partner());
