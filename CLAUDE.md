# Subscriber Kingdom — notes for Claude

Daily YouTube Short of a medieval kingdom where 1 subscriber = 1 villager. Owner writes in Italian and
often uses the `/caveman` skill (very short answers, Italian, until "stop caveman").

## Ground rules
- Work on branch `claude/gallant-fermat-pyz8n3` (it is the repo's default branch; the daily GitHub Action
  runs from it and commits `state/` there). Pull before pushing.
- Never commit keys. Secrets live only in the owner's local `.env` and in GitHub Actions secrets
  (`YOUTUBE_API_KEY`, `YT_OAUTH_CLIENT_ID`, `YT_OAUTH_CLIENT_SECRET`, `YT_OAUTH_REFRESH_TOKEN`).
  Variables: `PUBLISH_TARGETS=youtube`, optional `YT_PUBLISH_AT` (HH:MM UTC), `YT_PRIVACY`.
- The repo is public. Do not use audio ripped from YouTube; CC0 sounds only (`assets/audio/sfx/`).
- Renders are slow on CPU (~50-60 min per 30 s video, ~2-5 min for `--stills`). Prefer stills to check
  a change; render full videos only when asked.

## Commands
- `npm test` — must stay green (node:test, ~30 tests).
- `npm run render -- --subs 118 --from 72 [--names "A,B"] [--stills 4,15,24]` — test render, never
  touches `state/`. `--names` fakes commenters.
- `npm run daily -- --dry-run --subs 80` — simulate the next real day without saving.
- `node scripts/verify-video.js output/x.mp4` — format checks.
- `npm run auth:youtube -- --save` — one-time OAuth refresh token (owner runs it on their PC).

## How it works (short)
- `src/sim/` deterministic simulation (seeded PRNG); `state/kingdom.json` + `state/history/`.
  Villagers are nameless until someone comments on a channel video: `src/fetch/comments.js` reads public
  comments (same API key), `assignNames` in `src/sim/simulate.js` gives one villager per commenter.
  `state/blocked.json` removes names. Comment text is never stored (see `PRIVACY.md`).
- `src/render/scene/` Three.js scene rendered frame by frame in headless Chromium (`capture.js`).
  Shot plan in `timeline.js`: hook → caravan of today's named villagers (`caravan.js`) → new buildings →
  named villagers at work (`work.js`) → new houses → wide shot → call to action.
- `src/audio/` narration templates (names are never read aloud), Kokoro TTS (`am_adam`), procedural
  music, camera-driven sound effects with strikes synced to the work animations (`sfx.js`).
- `src/publish/` YouTube upload (resumable, OAuth); `state/published.json` prevents double uploads.
- `.github/workflows/daily.yml` runs at 06:17 UTC (GitHub often starts it hours late);
  `voice-samples.yml` renders TTS samples on demand.

## Open ideas the owner mentioned
- Choose a less robotic free voice (Chatterbox or Edge voices; samples via the Voice samples action).
- Done: comment text picks a job and a name (`src/sim/requests.js`), end credits roll in the wide shot
  (`overlay.js`). Owner does not want royal family or noble titles (prince, princess) as jobs for now. Ideas not done: tavern scene with several
  named patrons, narrator jokes for refused requests ("clone me", "landlord").

## Status at handoff (2026-10-19)
- Daily upload works (videos 74VLgbuvzGU, YQjmBQNZlo4, 2mydn7mgvjU). ~118 subscribers, 24 named villagers.
- Pending ideas, not started: real-life events with a visible scene (owner liked the list: Halloween on
  31/10 with pumpkins and bonfires, house fire then rebuild, wedding, wolves or bandits at night, storm,
  tournament, villager leaving with a bundle on unsubscribe; max one big event per day, deterministic).
- Voice still `am_adam`; owner may switch after listening to the Voice samples action.
- Owner pinned (or will pin) a comment: "call me <name>" + a job, "watch the end credits".
