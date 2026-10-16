# Subscriber Kingdom

A medieval kingdom that grows with a YouTube channel. Every subscriber is one villager.
Each day the system reads the subscriber count, advances a deterministic simulation, saves the
new state, and renders a 30-second vertical video (YouTube Shorts / Instagram Reels / TikTok)
with narration, captions and a medieval soundtrack.

Channel: [@Subscriber_Kingdom](https://www.youtube.com/@Subscriber_Kingdom)

```
npm run daily                    # fetch → simulate → save → narrate → render output/<date>_en.mp4
npm run render -- --subs 120     # test render, never touches state/
npm run viewer                   # dist/viewer.html — open it with a double click
npm test                         # simulation, fetch and audio tests
```

## How the kingdom works

- **1 subscriber = 1 villager.** Villager `#i` always gets the same name and job (seeded by
  index), so a returning subscriber comes back as the same person.
- **Houses** are built on plots along roads that grow outward from the castle gate, mostly to the
  east. Plots never overlap each other, roads, the river, the moat, walls, fields or reserved
  building lots. Newer houses hold more people (1 → 2 → 4 → 8) so the map stays readable at
  thousands of subscribers.
- **Tiers** unlock jobs and buildings: 1 hamlet (farmers, well, fields) · 5 woodcutter, fisherman
  (sawmill, dock) · 10 blacksmith, baker · 25 guards on the walls, quarry · 50 market, tavern ·
  100 chapel, windmill · 250 second wall, town hall · 500 harbor, cathedral, tournament ground ·
  1,000 town charter, East Ward · 2,500 North Ward · 5,000 university · 10,000 royal palace ·
  100,000 lighthouse · 1,000,000 the Colossus. Big buildings take days to build.
- **Unsubscribes** remove the newest villagers first. Empty houses are *abandoned* (dark, broken
  roof, no smoke) for 7 days, then become *ruins*. When the count grows again, abandoned houses
  are re-occupied and ruins rebuilt before any new plot is used. History is never deleted.
- **Every day has a story**: weather, festivals, harvests, market days, traders, a villager
  spotlight or construction progress — the video is never empty.
- **Deterministic**: a seeded PRNG drives everything (no `Math.random()`); re-running a day gives
  the identical state, diff and video frames.

## Setup

Requirements: **Node.js 20+**, **ffmpeg** on `PATH`, ~1 GB disk for Chromium and the TTS voices.

### Linux (Ubuntu/Debian)

```bash
sudo apt-get install -y ffmpeg
npm ci
npx playwright install --with-deps chromium
npm run setup:piper            # Piper TTS + voices into tools/piper (git-ignored)
cp .env.example .env           # then fill in your keys
npm test
npm run render -- --subs 12    # ~15-25 min on a CPU-only machine
```

### Windows (PowerShell)

```powershell
winget install Gyan.FFmpeg        # or: choco install ffmpeg — then reopen the terminal
winget install OpenJS.NodeJS.LTS
npm ci
npx playwright install chromium
npm run setup:piper               # downloads piper_windows_amd64.zip (uses the built-in tar.exe)
copy .env.example .env            # then edit .env
npm test
npm run render -- --subs 12
```

With a GPU, rendering is much faster. Without one, Chromium uses SwiftShader (software WebGL).

## API keys (never commit them)

Keys live only in `.env` locally (git-ignored) or in GitHub repository secrets. `.env.example`
lists every variable with empty values.

### Subscriber count — two modes

1. **Public (default, `COUNT_MODE=public`)** — YouTube Data API v3
   `channels.list?part=statistics&forHandle=@Subscriber_Kingdom`.
   - Google Cloud Console → create a project → *APIs & Services* → enable **YouTube Data API v3** →
     *Credentials* → **Create API key** (restrict it to that API) → `YOUTUBE_API_KEY=...`
   - Note: above 1,000 subscribers YouTube rounds the public count to **3 significant figures**
     (e.g. 12,345 → 12,300), so growth appears in steps.
2. **Exact (`COUNT_MODE=exact`)** — YouTube Analytics API for your own channel: the sum of
   `subscribersGained − subscribersLost` since the channel was created.
   - Enable **YouTube Analytics API**, create an **OAuth client (Desktop app)**, authorize it once
     for your channel with the scope `https://www.googleapis.com/auth/yt-analytics.readonly`
     (e.g. with the [OAuth Playground](https://developers.google.com/oauthplayground) using your
     own client) and store `YT_OAUTH_CLIENT_ID`, `YT_OAUTH_CLIENT_SECRET`, `YT_OAUTH_REFRESH_TOKEN`.
   - Analytics data lags ~2-3 days; `EXACT_COUNT_OFFSET` adds a fixed correction if needed.

If the API fails (no key, quota, network), the error is logged, the **last known count is reused**
and the video is still rendered with a weather / daily-life event. The daily run never crashes on it.

### Narration (text-to-speech)

- **Piper** (default, free, local): `npm run setup:piper`. English voice `en-us-libritts-high`
  (speaker 20, CC BY 4.0 — credit it in the description), Italian `it-riccardo_fasol-x-low`.
  Override with `PIPER_BIN`, `PIPER_VOICE_EN`, `PIPER_SPEAKER_EN`, `PIPER_VOICE_IT`.
- **ElevenLabs** (optional, cloud): `TTS_PROVIDER=elevenlabs`, `ELEVENLABS_API_KEY`, optional
  `ELEVENLABS_VOICE_ID`. Falls back to Piper, then to silent captions, if it fails.

Captions are burned in from word timestamps (ElevenLabs alignment, or per-sentence Piper timing).

## Commands

| Command | What it does |
|---|---|
| `npm run daily` | Full cycle for today: fetch, simulate, save `state/kingdom.json` + `state/history/<date>.json`, render `output/<date>_en.mp4` |
| `npm run daily -- --dry-run --subs 42` | Print the diff for 42 subscribers without saving anything |
| `npm run daily -- --subs 42 --date 2026-11-01 --lang it` | Override count, date and narration language |
| `npm run daily -- --no-video` | Advance and save the state only |
| `npm run render -- --subs 120 [--from 100]` | Test video for a fresh kingdom that grew from 100 to 120 (default: from ~88%) |
| `npm run render -- --subs 640 --stills 1,10,25` | Only render PNG frames at those seconds |
| `npm run viewer` | Build `dist/viewer.html` from the current state (`-- --subs 5000` for a test kingdom, `-- --check` to verify it in headless Chromium) |
| `node scripts/verify-video.js output/x.mp4` | ffprobe checks (1080x1920, 30 fps, 30.0 s, H.264 + AAC, no black frames) and frame extraction |

Common flags: `--quality low|medium|high` (high = 4x MSAA, slower), `--tts piper|elevenlabs|none`, `--seed N`.

## The video

1080x1920, 30 fps, exactly 30 s, H.264 + AAC (−14 LUFS target), `+faststart`.

- **0–2 s** hook: big counter and the change of the day, fast push-in to the gate while the
  drawbridge lowers.
- **2–22 s** update: the camera flies to each new house (scaffold → walls → roof → chimney smoke)
  or building, with the villager's name and job; losses show the abandoned house or ruin.
- **22–27 s** wide shot at dusk with the population and the next goal ("13 more villagers until the
  Guard takes the walls") and a progress bar.
- **27–30 s** call to action; the camera returns to the opening pose and the drawbridge rises, so
  the clip loops.

All text stays out of the top 220 px, the bottom 380 px and the right 160 px. Frames are rendered
one at a time in headless Chromium with `t = frame / 30` and piped to ffmpeg — nothing is recorded
in real time.

## State files

- `state/kingdom.json` — full current state (schema `src/sim/kingdom.schema.json`, `schemaVersion`).
- `state/history/YYYY-MM-DD.json` — `{ diff, state }` per day; villager lists are omitted from
  snapshots (they are re-derived from the seed and house occupancy on load).
- Writes are atomic (temp file + rename). `migrate()` upgrades old files; version 0 is a
  hand-written bootstrap such as `{"subscribers": 120}`.

## Automation

`.github/workflows/daily.yml` runs every day at 06:17 UTC (and on demand): install, tests, daily
cycle, commit `state/`, upload the MP4 as a workflow artifact. Add `YOUTUBE_API_KEY` (and the
optional OAuth / ElevenLabs secrets) under *Settings → Secrets and variables → Actions*.
Uploading to YouTube/Instagram/TikTok is not implemented yet: `src/publish/index.js` is the
extension point (it already writes title/description metadata next to each video);
`legacy/uploaders/` contains earlier Python upload scripts.

## Layout

```
src/sim/      PRNG, names, tiers, world (terrain, river, roads, plots), simulation, events, state I/O, schema
src/fetch/    YouTube Data API (public) and Analytics API (exact) with fallback
src/render/   Three.js scene (scene/*), deterministic frame capture (capture.js)
src/audio/    narration templates, TTS providers, procedural music/ambience, ffmpeg mix
src/publish/  upload extension point
scripts/      daily, render, viewer, build, setup-piper, verify-video, watermark tools
tests/        node:test suites
assets/audio/ optional custom music/ambience + LICENSES.md
legacy/       the earlier Blender pipeline and Python uploaders
```

Progress and verification notes: [PROGRESS.md](PROGRESS.md).
