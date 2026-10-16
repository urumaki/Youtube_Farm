# Subscriber Kingdom — progress

Legend: [x] done and verified · [~] partly verified · [ ] todo · [!] blocked (and why)

## 1. Simulation core + state + tests
- [x] Seeded PRNG/hashing (`src/sim/prng.js`); no `Math.random()` in simulation or render code
- [x] Procedural names and jobs, stable per subscriber index (`names.js`, `tiers.js`)
- [x] Tiers 1 → 1,000,000 with unique jobs at thresholds, buildings with construction days
- [x] World: terrain, river, moat, roads, reserved lots, second wall, fields, 5,006 non-overlapping plots (`world.js`)
- [x] Daily step: grow/shrink, newest leave first, abandoned → ruin after 7 days, re-occupy abandoned → rebuild ruins → new plots, house capacity 1/2/4/8 (`simulate.js`)
- [x] Weather + at least one story event every day (`events.js`)
- [x] JSON schema + validator, migrations (v0 bootstrap → v1), atomic writes, daily history snapshots, re-running a day reproduces it (`state.js`)
- [x] Tests: determinism, 0 → 10,000 growth, shrinking/ruins/rebuild order, no plot overlaps (and vs roads/lots/walls/fields/river/moat), unlocks, construction, migration, events

## 2. Subscriber fetch
- [x] Public count (Data API v3 `channels.list` `forHandle`), exact mode (Analytics API gained − lost), fallback to last known count, never throws
- [~] Tested with mocked HTTP only: googleapis.com is blocked from this sandbox (403), so no live call was made

## 3. 3D scene
- [x] Chunked terrain with road/plaza overlay, river + moat with animated normals, procedural textures
- [x] Castle: four different corner towers, gate towers, gatehouse with "SUBSCRIBER KINGDOM" sign and arms, barbican, working drawbridge with chains, stone bridge on piers, keep with floors, external stair to the first-floor door, balcony, courtyard stairs to the wall walk
- [x] Heraldry: "the Crown of Many" (azure, crown whose points are heads, pyramid of ten bezants, motto *Ex multis unum regnum*) on banners, shields and the gate
- [x] Instanced houses with seeded variation (size, roof color/thatch, timber/plaster, chimney, garden, fence), abandoned and ruin variants, chunked far LOD; houses sit on leveled plinths
- [x] All tier buildings (well, fields, sawmill, dock, forge, bakery, quarry, market, tavern, chapel, windmill, second wall, town hall, harbor, cathedral, tournament, wards, university, palace, lighthouse, colossus)
- [x] Forests that never overlap plots/lots/roads, rocks, far LOD for trees

## 4. Life and animation
- [x] Villagers on closed lane loops that never cross (constant spacing, same speed → no collisions), guards ping-ponging on wall stretches, gate guards
- [x] Chimney/forge smoke, waving banners and flags, flickering torches with a few real lights, windmill sails, bobbing boats, birds, rain/snow
- [x] Afternoon → dusk transition; windows, torches and the sign glow at dusk

## 5. Deterministic capture + encoding
- [x] Headless Chromium renders frame f at t = f/30 on demand, JPEG frames → ffmpeg (H.264 + AAC, `+faststart`), exactly 900 frames / 30.0 s
- [~] Speed: ~2.5 s/frame on 4 CPU cores with software GL (~35-45 min per video). Multiple browser workers did not help on CPU-only hardware; a GPU runner is much faster

## 6. Narration, TTS, captions, music
- [x] Template narration with seeded variation, 54-75 words, EN and IT (`--lang`)
- [x] TTS interface: Piper (local, default), ElevenLabs (cloud, word alignment), silent fallback; captions from word timings
- [x] Procedural music bed + ambience (CC0, generated), ducked under the voice, loudness-normalized, licenses in `assets/audio/LICENSES.md`
- [x] Kokoro-82M narration (default `am_adam`, Italian `im_nicola`), Piper fallback; script capped at 68 words and re-synthesized faster if it would overrun 28.3 s
- [x] Camera-driven sound effects (`src/audio/sfx.js`): hammer/saw on houses, anvil+fire at the forge, water+oars at the dock, bells, chisel, chains; quiet birds/breeze bed; CC0 recordings in `assets/audio/sfx/` override the synthesized ones
- [!] Voices and effects not judged by ear (no audio playback here); samples sent to the user to choose

## 7. Automation, viewer, README
- [x] `.github/workflows/daily.yml` (cron, tests, daily cycle, commit state, upload MP4 artifact, publish extension point)
- [x] `dist/viewer.html` standalone (inlined Three.js bundle + state), orbit camera, time-of-day slider
- [x] README (Windows + Linux setup, API keys, both count modes, test render)

## Verification log
- `npm test`: 23 tests pass.
- Test videos (`npm run render -- --subs N`), each checked with `scripts/verify-video.js`
  (1080x1920, H.264 yuv420p, 30 fps, 900 frames, 30.0 s, AAC 48 kHz, no black frames) and frames at 1 s / 10 s / 25 s reviewed:
  - 1: PASS · 12: PASS · 87: PASS · 640: PASS · 5000: PASS (render times 31-50 min each)
- Issues found in frames and fixed: new tier buildings now shown before older completions, barbican hiding the gate sign, inverted roof faces, oversaturated grass, fog hiding the wide shot, dusk too dark, smoke blobs near the camera, viewer aspect stretch, scaffold on instant buildings.
- Round 2 (organic town plan, detailed houses, red-roofed castle, Kokoro voice, camera-driven effects):
  `npm test` 25 pass; 87 subscribers re-rendered: all 8 checks PASS, 2918 s render, −14.3 LUFS integrated.
  Known: the house label can sit above a neighbour while the new house is still low; fog days soften the wide shot.
- Viewer: `node scripts/viewer.js --subs 35000 --check` (4,800 houses) loads with no console errors; 558 draw calls, ~1.45 M triangles per frame.
