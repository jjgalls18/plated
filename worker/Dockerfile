# Build context is the repo root, not worker/ — the worker imports shared/ so
# that the prompt, output schema and TikTok caption parsing are literally the
# same code the browser runs, rather than a copy that drifts.
# Node 22, not 20: @supabase/supabase-js constructs its realtime client eagerly
# even when nothing subscribes, and that throws on a Node without native
# WebSocket ("Node.js 20 detected without native WebSocket support"). 22 has it
# built in, which is a smaller price than pulling in `ws` for a feature the
# worker never uses.
FROM node:22-alpine

# The system ffmpeg, rather than the ffmpeg-static npm package the Vercel
# function needs: no 80MB platform binary in the image, no chmod workaround for
# a lost executable bit.
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY worker/package.json worker/package-lock.json* ./worker/
RUN cd worker && npm install --omit=dev

COPY shared/ ./shared/
COPY worker/ ./worker/

WORKDIR /app/worker
CMD ["node", "index.js"]
