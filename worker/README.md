# Plated extraction worker

Drains `video_queue` on the homelab so a saved TikTok extracts whether or not a
phone has Plated open.

## Why this exists

Extraction used to run in the browser. iOS suspends background JavaScript in an
installed PWA, so saving a link and switching back to TikTok stalled the
extraction until you reopened the app. This process polls the same queue from
`192.168.2.101`, next to the Cobalt container it depends on.

Being on the same machine as Cobalt is a bonus, not a coincidence: the browser
path has to go Vercel → Cloudflare Access → tunnel → Cobalt and back, and this
one is a single hop over a Docker network.

## What it does per item

1. Claims the oldest `queued`/`partial` row — an atomic conditional update, so a
   phone's manual extraction and the worker can never run the same video.
2. Cobalt → raw video → `ffmpeg` audio extraction → Whisper transcript, banked
   to the row immediately (Whisper is the paid, slow part; a retry shouldn't buy
   the same audio twice).
3. Fetches the post's caption, because plenty of cooking videos are silent with
   the whole recipe written in the caption.
4. Claude extracts (or merges, if a caption-derived partial recipe exists).
5. Inserts the recipe, marks the row `complete`.

Step labels are written to the row's `progress_step`, so both phones watch the
same live progress over Supabase realtime.

## Prerequisites

- `supabase/migrations/20260915_worker_queue.sql` applied in the Supabase SQL
  editor. **The worker needs these columns; apply it before starting.** The app
  degrades gracefully without them, the worker does not.
- The `cobalt` container running (`~/cobalt/docker-compose.yml`), which creates
  the `cobalt_default` network this joins.

## Deploy

```sh
ssh jgallon@192.168.2.101
git clone https://github.com/jjgalls18/plated.git ~/plated    # or git -C ~/plated pull
cd ~/plated/worker
cp .env.example .env
chmod 600 .env
$EDITOR .env          # fill in the four secrets
docker compose up -d --build
docker compose logs -f
```

Updating later is `git -C ~/plated pull && docker compose up -d --build` from
this directory.

### Filling in `.env`

| Variable | Where to get it |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env, stored there as `supabase_service_role_secret` — or Supabase dashboard → Project Settings → API |
| `ANTHROPIC_API_KEY` | The same key entered in Plated's admin panel (tap the logo 5×) |
| `OPENAI_API_KEY` | Likewise |
| `COBALT_API_KEY` | The UUID key in `~/cobalt/keys.json` |

`chmod 600 .env` matches how `~/usenet/.env` and `~/homepage/config/.env` hold
their secrets on this host.

## Checking on it

```sh
docker compose logs -f                  # what it's doing right now
docker compose logs | grep -i fail      # what went wrong
```

A healthy idle worker is quiet — it only logs when there is something to do.

## Notes

- **One video at a time, on purpose.** Whisper and Claude are the slow parts and
  neither gets faster by running two extractions on one home server.
- **Two attempts per video**, counted in the row rather than per device. A
  persistent failure used to get a fresh two tries from every phone and every
  reload, spending Whisper credits each time.
- **Abandoned claims are reaped** after 15 minutes. A worker killed
  mid-extraction leaves its row in `processing`, and nothing else would ever
  touch a row in that state — the queue would wedge on it permanently.
- **Cobalt down is not the video's fault.** Those items go back to the queue
  with their attempt refunded, rather than being marked failed.
- The prompt, output schema and caption parsing come from `../shared/`, which
  the browser imports too, so a change to any of it reaches both extractors or
  neither. That is also why the Docker build context is the repo root.
