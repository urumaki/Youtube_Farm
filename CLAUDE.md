# Subscriber Kingdom — notes for Claude

Daily YouTube Short of a medieval kingdom where 1 subscriber = 1 villager. Owner writes in Italian and
often uses the `/caveman` skill (very short answers, Italian, until "stop caveman").

## Ground rules
- Work on branch `claude/gallant-fermat-pyz8n3` (it is the repo's default branch; the daily GitHub Action
  runs from it and commits `state/` there). Pull before pushing.
- Owner's standing rule: commit and push every change to GitHub as soon as it is done and tested, without
  asking (`git pull --rebase --autostash` first). Leave the owner's own uncommitted local edits alone.
- Each day starts from `state/history/<previous day>.json`, not `state/kingdom.json`: a hand fix to the saved state goes
  in both files (the latest history file and kingdom.json), or the next run loses it.
- Never commit keys. Secrets live only in the owner's local `.env` and in GitHub Actions secrets
  (`YOUTUBE_API_KEY`, `YT_OAUTH_CLIENT_ID`, `YT_OAUTH_CLIENT_SECRET`, `YT_OAUTH_REFRESH_TOKEN`).
  Variables: `PUBLISH_TARGETS=youtube`, optional `YT_PUBLISH_AT` (HH:MM UTC), `YT_PRIVACY`.
- The repo is public. Do not use audio ripped from YouTube; CC0 sounds only (`assets/audio/sfx/`).
- Renders are slow on CPU (~50-60 min per 30 s video, ~2-5 min for `--stills`). Prefer stills to check
  a change; render full videos only when asked.
- `docs/FEATURES.md` holds every feature and owner decision in detail (scenes, stories, jobs, buildings,
  walls, houses, narration), with the test command for each. Read the section you touch before changing it,
  and record new owner decisions there, not here.

## Owner's rules for content
- Medieval only, nothing magic (no wizards, witches, spells). No royal or noble titles as jobs (king, queen,
  prince, lord, duke...). Named villagers are heroes or comic, never villains or victims; nobody gets hurt.
- Comment text is untrusted: only `plainText` and fixed regexes read it, it is never stored, run, given to a
  shell or sent to a language model (`PRIVACY.md`, `src/fetch/comments.js`, `src/sim/requests.js`).
- Stable world: plot ids and positions never move. New lots, quarters and buildings are laid out after the
  plots (`world.js`). Only add tiers above the current population, or existing villagers change job.
- At most 2 buildings begin a day once villagers have names (the video shows each one). No scene again
  within 3 days (`src/sim/scenes.js`). At most 5 hashtags per video, none repeated.

## Commands
- `npm test` — must stay green (node:test, ~64 tests).
- `npm run render -- --subs 118 --from 72 [--names "A,B"] [--stills 4,15,24]` — test render, never
  touches `state/`. `--names` fakes commenters. `--real` starts from the real `state/` (next day, read
  only) instead of a fresh two-day test kingdom: needed to test anything that exists only later (tavern).
  More test flags: `--story <kind>[:<step>]`, `--gallery "job:variant,job+guest:variant"` (`output/gallery/`),
  `--built a,b` (buildings stand finished), `--church`, `--day <date>` (a saved day again, read only),
  `--pov work|stroll` (a villager seen through their eyes).
- `npm run daily -- --dry-run --subs 80` — simulate the next real day without saving (no video).
- `node scripts/preview-day.js 1600 [date]` — render the next real day (real comments since the last saved day, the given
  subscribers) to `output/<date>_en_preview_<subs>.mp4`, read only: nothing saved, nothing published.
- `node scripts/verify-video.js output/x.mp4` — format checks.
- `node scripts/thumbnail.js [--job guard] [--title "IS THIS YOU?"] [--sub ...] [--phase 0.25] [--weather clear]` — the video's
  thumbnail: castle from the market square, a waving villager with a blurred name tag; `output/thumbnail_<date>.png`.
- `node scripts/map.js` — map of the town from above (`output/map.png`).
- `node scripts/viewer.js` — free camera on the scene (`window.__controls`).
- `node scripts/replan-day.js <day> [--save]`, `node scripts/republish-day.js <day>` — plan a saved day again; upload a
  re-render (replacing a published video is the owner's call).
- `npm run auth:youtube -- --save` — one-time OAuth refresh token (owner runs it on their PC).

## Owner's Windows PC (local renders)
- ffmpeg 9.0.2 in `C:\ffmpeg\bin` (first on PATH; the 2020 build is kept in `C:\ffmpeg\bin_old_2020`).
  The code also works with ffmpeg older than 4.4 (`mix.js` does not use `amix normalize`).
- Kokoro needs Python < 3.14: a Python 3.12 venv in `tools/venv`, set as `PYTHON` in `.env`.
- Playwright needs its headless shell: `npx playwright install chromium-headless-shell`.

## How it works (map)
- `src/pipeline.js` — the daily cycle: fetch, simulate, narration, TTS, soundtrack, frames, MP4, publish.
- `src/fetch/` — subscriber count (`youtube.js`) and public comments (`comments.js`).
- `src/sim/` — deterministic simulation (seeded PRNG, no `Math.random()`); `state/kingdom.json` + `state/history/`.
  `simulate.js` (daily step, names, houses, build queue), `tiers.js` (goals, jobs, `MERGED`, `COMMISSIONS`),
  `requests.js` (job, name, complaint and rebel requests from comments), `featured.js` (who is on screen),
  `scenes.js` (scene picks, `NEEDS`, `UNTIL`), `stories.js` (one story event a day at most), `world.js`
  (map, plots, lots), `wall.js` (Second Wall), `badwords.js`; `state/blocked.json` removes names.
- `src/render/scene/` — Three.js scene, captured frame by frame in headless Chromium (`capture.js`).
  `timeline.js` plans the shots; `main.js` places scenes (`PLACES`, `workPlace`); `work.js` job scenes
  (`JOB_SCENES`); `overlay.js` name tags and credits; `stories/` one file per story event; `tavern.js`,
  `church.js`, `bakery.js`, `caravan.js`, `ambient.js`, `away.js`, `houses.js`, `houseKit.js`, `buildings.js`.
- `src/audio/` — narration templates (names never read aloud), Kokoro TTS (`am_adam`), procedural music, synced sfx.
- `src/publish/` — YouTube upload; `state/published.json` prevents double uploads.
- `.github/workflows/daily.yml` — runs at 03:17 UTC on `ubuntu-24.04` (GitHub often starts it hours late).
