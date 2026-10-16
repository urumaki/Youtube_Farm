# Subscriber Kingdom — progress

Legend: [x] done and verified · [~] in progress · [ ] todo · [!] blocked

## 1. Simulation core + state + tests
- [x] Seeded PRNG / hashing (`src/sim/prng.js`), no Math.random in sim
- [x] Procedural names, stable per subscriber index (`src/sim/names.js`)
- [x] Tiers, jobs, buildings, house capacity growth (`src/sim/tiers.js`)
- [x] World: terrain, river, moat, roads, reserved lots, second wall, fields, ~5000 non-overlapping plots (`src/sim/world.js`)
- [x] Daily step: grow/shrink, abandoned → ruin after 7 days, reoccupy/rebuild before new plots, unlocks, construction (`src/sim/simulate.js`)
- [x] Weather + at least one story event per day (`src/sim/events.js`)
- [x] JSON schema + validator + migrations + atomic writes + history snapshots (`src/sim/state.js`)
- [x] Tests: determinism, 0→10k growth, shrinking/ruins, overlaps, unlocks, migration, re-run same day

## 2. Subscriber fetch
- [ ] public count (Data API v3), exact mode (Analytics API), fallback to last known count

## 3. 3D scene
- [ ] terrain, river, moat, castle, procedural houses

## 4. Life and animation
- [ ] villagers, guards, banners, smoke, lights

## 5. Deterministic capture + encoding
- [ ] Playwright frame stepping → ffmpeg

## 6. Narration, TTS, captions, music
- [ ] script templates, Piper / ElevenLabs, captions, mix

## 7. Automation, viewer, README
- [ ] GitHub Actions, dist/viewer.html, docs
