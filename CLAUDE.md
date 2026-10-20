# Subscriber Kingdom — notes for Claude

Daily YouTube Short of a medieval kingdom where 1 subscriber = 1 villager. Owner writes in Italian and
often uses the `/caveman` skill (very short answers, Italian, until "stop caveman").

## Ground rules
- Work on branch `claude/gallant-fermat-pyz8n3` (it is the repo's default branch; the daily GitHub Action
  runs from it and commits `state/` there). Pull before pushing.
- Owner's standing rule: commit and push every change to GitHub as soon as it is done and tested, without
  asking (`git pull --rebase --autostash` first). Leave the owner's own uncommitted local edits alone.
- Never commit keys. Secrets live only in the owner's local `.env` and in GitHub Actions secrets
  (`YOUTUBE_API_KEY`, `YT_OAUTH_CLIENT_ID`, `YT_OAUTH_CLIENT_SECRET`, `YT_OAUTH_REFRESH_TOKEN`).
  Variables: `PUBLISH_TARGETS=youtube`, optional `YT_PUBLISH_AT` (HH:MM UTC), `YT_PRIVACY`.
- The repo is public. Do not use audio ripped from YouTube; CC0 sounds only (`assets/audio/sfx/`).
- Renders are slow on CPU (~50-60 min per 30 s video, ~2-5 min for `--stills`). Prefer stills to check
  a change; render full videos only when asked.

## Commands
- `npm test` — must stay green (node:test, ~30 tests).
- `npm run render -- --subs 118 --from 72 [--names "A,B"] [--stills 4,15,24]` — test render, never
  touches `state/`. `--names` fakes commenters. `--real` starts from the real `state/` (next day, read
  only) instead of a fresh two-day test kingdom: needed to test anything that exists only later (tavern).
- `npm run daily -- --dry-run --subs 80` — simulate the next real day without saving.
- `node scripts/verify-video.js output/x.mp4` — format checks.
- `npm run auth:youtube -- --save` — one-time OAuth refresh token (owner runs it on their PC).

## Owner's Windows PC (local renders)
- ffmpeg 9.0.2 in `C:\ffmpeg\bin` (first on PATH; the 2020 build is kept in `C:\ffmpeg\bin_old_2020`).
  The code also works with ffmpeg older than 4.4 (`mix.js` does not use `amix normalize`).
- Kokoro needs Python < 3.14: a Python 3.12 venv in `tools/venv`, set as `PYTHON` in `.env`.
- Playwright needs its headless shell: `npx playwright install chromium-headless-shell`.

## How it works (short)
- `src/sim/` deterministic simulation (seeded PRNG); `state/kingdom.json` + `state/history/`.
  Villagers are nameless until someone comments on a channel video: `src/fetch/comments.js` reads public
  comments (same API key), `assignNames` in `src/sim/simulate.js` gives one villager per commenter.
  `state/blocked.json` removes names. Comment text is never stored (see `PRIVACY.md`).
- `src/render/scene/` Three.js scene rendered frame by frame in headless Chromium (`capture.js`).
  Shot plan in `timeline.js`. Days with named villagers (owner's choice, 2026-10-19): the video opens on the
  caravan of today's named villagers with name tags (`caravan.js`, no castle hook; the counter shows over it
  for 2 s) → up to 2 new buildings, ~2.5 s each → 3 named villagers at work (`work.js`) → wide shot with
  credits (23.5-27 s: a still card with the 10 newest names and "and N more villagers", so it stays
  readable as names grow) → call to action. The caravan shot lasts 4.5 s (owner: 4-5 s at most); the other shots share the
  rest by weight. New houses are not shown one by one on those days. Once the tavern is built,
  the "at work" part is 2 villagers in their crofts plus the tavern interior (`tavern.js`, hard cut in and
  out): named innkeepers/brewers behind the bar, other named villagers drinking at the tables with name
  tags, its own warm lamps (`env.set(..., interior)`). Days without any named
  villager keep the old order: castle hook → new buildings → new houses → wide shot → call to action.
  Narration sentences follow the same order (`src/audio/narration.js`).
- Story events (`src/sim/stories.js`, scenes in `src/render/scene/stories/`): at most one a day, 4.5 s shot
  right after the caravan, hard cut in and out, own camera, banner and name tags. Calendar events always
  happen on their date (Halloween 31/10); otherwise ~50% of days, each kind with a cooldown
  (`state.storyLog`). Done: quarrel in the square (chicken/goat/cabbage), merchant caravan on the
  south-east road, bandits at dusk on the mill track chased off by guards with named heroes, Halloween
  bonfire with named villagers in costume (ghost, scarecrow, pumpkin). Added 2026-10-20: house fire put out
  by a bucket chain (never a named villager's house; named villagers are the heroes) and rebuilt by the
  carpenters the next day (`state.storyArc`), wolves at night on the sawmill track scared off with
  torches, thunderstorm over the square (only on grey days; the day turns to rain). Owner: medieval only, nothing magic
  (no wizards, witches, spells; the alchemist became the Apothecary, "speziale"). Tone rule (owner): named villagers are heroes or comic, never
  villains or victims; nobody gets hurt. Test one with `npm run render -- --real --subs N --story bandits`.
- Who is shown at work (`src/sim/featured.js`, owner 2026-10-20): picked by the simulation and saved as
  `state.featured`: villagers named today first (the narrator welcomes only jobs on screen), then granted
  requests, never a job the previous video showed (`diff.avoidJobs`), one per job. Saves without
  `featured` use the old rule to know what the previous video showed.
- `npm run render -- --day 2026-10-20` renders a saved day again with today's code (read only,
  `output/<day>_<lang>_again.mp4`). Replacing a published video is the owner's call.
- Everyday shots (`src/render/scene/ambient.js`, owner 2026-10-20): when the update has room, guards
  (odd days, and in winter: patrolling the castle wall walk or sparring in the courtyard) or farmers
  hoeing in the field nearest the castle (even days), never a job already shown yesterday or today; a
  named guard or farmer not shown elsewhere gets the name tag.
- Villager shots vary (owner 2026-10-20): every common job has 2-3 scenes, one picked per villager and day
  (`VARIANTS` in `timeline.js`; `'job:variant'` entries in `JOB_SCENES`, `work.js`): guards on the walls,
  sparring or at the straw dummy (`drills.js`); farmers hoeing, sowing or reaping; the smith at the anvil,
  quenching or at the bellows; the fletcher shooting at a target... The croft shots cut in hard and move
  the camera a different way each time (`CAM_STYLES`). Name labels pop in. Bakers never work in the
  open (owner 2026-10-20): a bakehouse stands in their croft (`bakery.js`), with the oven beside them,
  the peel, its own wide-lens camera and a hard cut in and out like the tavern; guests walk in by the door.
  The beggar sits against the back wall of his house swigging from a bottle, or lies asleep by it snoring
  (Z sprites), or stands by a crate with a mug (`home`/`homeTurn` in `JOB_SCENES` place a scene by the house).
- Everybody gets a turn (owner 2026-10-20): `state.lastShown` records the day each named villager was
  last on screen; after today's names and requests, those never shown and those waiting longest come
  first. A shot can show two villagers together (`PAIRS` in `featured.js`, `visit.js`): the guest walks
  into the host's croft and gets something (a sword, a bow, a mended tool, bread...) or brings something
  (flour, wheat, fish, logs); anyone never shown may just drop by. Up to 6 named villagers per video.
- `npm run render -- --subs 80 --gallery "farmer:sow,blacksmith:anvil+guard:sword"` renders test views
  of work scenes and visits (`output/gallery/`), in the croft of the first named villager.
- Hashtags (owner 2026-10-20): at most 5 per video, title and description together, none repeated
  (`#shorts` in the title, four niche tags in the description; tested).
- In-between goals (owner, 2026-10-20): tier at 175 (Town Crier + Crier's Stand) and 750 (Executioner,
  who chops cabbages, + Pillory). Their structures are virtual lots on the market square (`onPlaza`), so
  house plots never move. Only add tiers above the current population, or existing villagers change job.
- `src/audio/` narration templates (names are never read aloud), Kokoro TTS (`am_adam`), procedural
  music, camera-driven sound effects with strikes synced to the work animations (`sfx.js`).
  The voice follows the shots: `produceVideo` first sets the scene up once to get the shot plan
  (`sceneCues`), `sentenceAnchors` gives each sentence the start of the shot it talks about (goal at
  23.7 s, call to action at 27.1 s), and `schedule` in `tts/index.js` waits for those times but never
  so long that the rest no longer fits. On caravan days there is no "+N villagers" sentence.
- `src/publish/` YouTube upload (resumable, OAuth); `state/published.json` prevents double uploads.
- `.github/workflows/daily.yml` runs at 06:17 UTC (GitHub often starts it hours late);
  `voice-samples.yml` renders TTS samples on demand.

## Open ideas the owner mentioned
- Choose a less robotic free voice (Chatterbox or Edge voices; samples via the Voice samples action).
- Done: comment text picks a job and a name (`src/sim/requests.js`), end credits roll in the wide shot
  (`overlay.js`). Owner does not want royal family or noble titles (prince, princess) as jobs for now. Done: tavern interior with named patrons.
  Ideas not done: narrator jokes for refused requests ("clone me", "landlord").

## Status at handoff (2026-10-19)
- Daily upload works (videos 74VLgbuvzGU, YQjmBQNZlo4, 2mydn7mgvjU). ~118 subscribers, 24 named villagers.
- More story events the owner may pick: wedding, tournament, villager leaving with a bundle on unsubscribe, Christmas, New Year fireworks.
- Voice still `am_adam`; owner may switch after listening to the Voice samples action.
- Owner pinned (or will pin) a comment: "call me <name>" + a job, "watch the end credits".
