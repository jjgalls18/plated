-- Plated — server-side extraction worker
--
-- Extraction used to drain in the browser, so it only ran while the app was
-- open and foregrounded (iOS suspends background JS in an installed PWA). A
-- Node worker on the homelab now owns the queue, which means three pieces of
-- state that lived in a client-side zustand store have to live in the row
-- instead — a server process can't see localStorage, and neither phone can
-- see the worker's memory.

alter table public.video_queue
  -- Retry cap. Previously useQueueProgress.attempts, per-device and per-session:
  -- a persistent failure would be retried fresh by every device, every reload,
  -- spending Whisper and Claude credits each time. In the row it's global.
  add column if not exists attempts int not null default 0,

  -- Live step label ("Transcribing with Whisper…"). The queue page and banner
  -- read this instead of local state, so both phones see the same progress for
  -- work neither of them is doing.
  add column if not exists progress_step text,

  -- Set when a worker claims an item, cleared when it lets go. A worker that
  -- dies mid-extraction leaves its row in 'processing' forever, which would
  -- wedge the queue permanently; the reaper puts rows back once this goes
  -- stale. Nothing else can distinguish "running" from "abandoned".
  add column if not exists claimed_at timestamptz,
  add column if not exists claimed_by text,

  -- What the extraction cost, in USD. The admin panel's cost tracking sums a
  -- client-side log, which now misses everything the worker spends.
  add column if not exists ai_cost numeric(10,6);

-- The worker's poll asks for the oldest claimable row on a fixed cadence, and
-- the reaper scans for stale claims — both filter on status.
create index if not exists video_queue_claim_idx
  on public.video_queue (status, created_at);
