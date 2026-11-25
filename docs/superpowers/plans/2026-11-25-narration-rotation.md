# Narration rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From 2026-11-30 the daily narration says at most 2 routine lines plus the call to action, in turn from day to day, and spends the freed words on what is on screen (work lines, the granted request over its villager, the story's payoff).

**Architecture:** `buildScript` in `src/audio/narration.js` gets one switch, `v2 = diff.date >= NARRATION_FROM`; every change sits behind it, so days before it draw the same seeded `rng` values and read the same. The rotation (which routine roles, which wording) is a pure function of the day number in a new `src/audio/rotation.js`; the new hand-written lines live in a new `src/audio/lines.js`.

**Tech Stack:** Node ESM, `node:test` (`npm test` = `node --test tests/*.test.js`).

**Spec:** `docs/superpowers/specs/2026-11-25-narration-rotation-design.md`

## Global Constraints
- `NARRATION_FROM = '2026-11-30'`; a diff dated before it gives exactly today's script.
- Deterministic: no `Math.random()`; wordings by `pool[(day + k) % pool.length]`, the rest by the existing seeded `r`.
- Routine roles: `open`, `newcomers` (the `up`/`up1`/`same` delta lines and the caravan's count line), `comment`, `goal`. At most 2 a day + `cta` every day. Forced on top: `goal` when `diff.next.remaining <= 20`; `down`/`down1`, milestone, `promoted` stay as today.
- Pool sizes at least: `cta` 6, `comment` 6, `goal` 4, `open` 4, caravan without count 8, wish 3; `tavern`, church (each kind), weather (each kind) at least 4.
- Lines: English, hand-written, no names, no comment text, medieval, nothing magic (no wizard/witch/spell/magic), no royal or noble title as a job, nobody hurt, named villagers heroes or comic.
- Takeover scripts (`raidScript`, `ambushScript`, `grandJoustScript`, `dayInLifeScript`, `eventScript`, `takeoverScript`) unchanged.
- `npm test` green; commit and push each task to `claude/gallant-fermat-pyz8n3` after `git pull --rebase --autostash` (CLAUDE.md).

## Review Focus
- A caravan shot on a day `newcomers` is not chosen: it must still get a line (the quiet caravan pool), never 4.5 s of silence.
- A featured villager whose variant is `null` (day 2026-11-21, merchant 936) or whose job has no `WORK` entry (a job added later): fall back to `WORK[job]`, then to no work line, never a crash.
- A story cue with no `PAYOFF` (a story added later) or a day with no story: the wide shot says the goal instead (when `diff.next`), not silence.
- A day with villagers leaving (`delta < 0`): the `down` line is still said even when `newcomers` is not chosen.
- A day with `diff.next === null` (all tiers reached): rotation skips `goal`, still picks 2 of the others.

---

### Task 1: Snapshot of today's scripts (regression guard)

**Files:**
- Create: `tests/fixtures/narration-before.json`
- Create: `tests/narration-rotation.test.js`

**Interfaces:**
- Produces: the fixture `{ "<date>": "<script text>" }` for every file in `state/history/`, built with `buildScript(migrate(state), diff, { shots: [] })` on the code as it is now.

- [ ] **Step 1:** Write the fixture with a one-off node command (current code, before any change): for each `state/history/*.json`, `buildScript(migrate(h.state), h.diff, { shots: [] }).text`, keyed by file date, `JSON.stringify(out, null, 1)`.
- [ ] **Step 2: Write the test** `old days read the same (owner 2026-11-25: the change starts 2026-11-30)`: for every key of the fixture, the same build equals the fixture text.
- [ ] **Step 3:** Run `node --test tests/narration-rotation.test.js`. Expected: PASS.
- [ ] **Step 4:** Commit `Narration: snapshot of the saved days' scripts before the rotation`.

### Task 2: Rotation helpers

**Files:**
- Create: `src/audio/rotation.js`
- Test: `tests/narration-rotation.test.js`

**Interfaces:**
- Produces:
  - `export const NARRATION_FROM = '2026-11-30'`
  - `export const ROUTINE = ['open', 'newcomers', 'comment', 'goal']`
  - `export function routineRoles(diff) -> Set<string>`: `ROUTINE` rotated left by `diff.day % 4`, keep those that apply (`goal` only with `diff.next`), take the first 2; add `goal` when `diff.next?.remaining <= 20`.
  - `export function turn(pool, day, k = 0) -> item`: `pool[((day + k) % pool.length + pool.length) % pool.length]`.

- [ ] **Step 1: Write the failing tests** `routine lines take turns by day`:
  - `routineRoles({ day: 40, next: { remaining: 90 } })` → `{open, newcomers}`; day 41 → `{newcomers, comment}`; day 42 → `{comment, goal}`; day 43 → `{goal, open}`.
  - `routineRoles({ day: 42, next: null })` → `{comment, open}`.
  - `routineRoles({ day: 40, next: { remaining: 20 } })` → `{open, newcomers, goal}`.
  - `turn(['a','b','c'], 7)` → `'b'`; over days 0..5 of a 3-pool no item twice in a row.
- [ ] **Step 2:** Run, expect FAIL (module not found).
- [ ] **Step 3:** Implement `src/audio/rotation.js`.
- [ ] **Step 4:** Run, expect PASS.
- [ ] **Step 5:** Commit `Narration: routine lines in turn by day (rotation.js)`.

### Task 3: The new lines

**Files:**
- Create: `src/audio/lines.js`
- Modify: `src/audio/narration.js` (export `export const STORY_CUES = Object.keys(L.story)` next to `L`)
- Test: `tests/narration-rotation.test.js`

**Interfaces:**
- Produces (all from `src/audio/lines.js`):
  - `MORE = { open, comment, cta, goal, tavern, church: { chapel, cathedral }, weather: { clear, cloudy, fog, rain, snow } }`: extra wordings, same shapes as the matching `L` entries (`open`/`goal` take the same args as `L.open`/`L.goal`). In v2 a pool is `[...L.x, ...MORE.x]` (weather: `[L.weather[w], ...MORE.weather[w]]`).
  - `CARAVAN_QUIET: string[]` (≥ 8): the caravan arriving, no number ("Carts creak through the gate, loaded with whole lives.").
  - `WISH: ((job: string) => string)[]` (≥ 3): "This one asked to be a ${job}. Wish granted!"
  - `WORK: { [jobOrJobVariant: string]: string[] }`: every key of `JOBS` with ≥ 2 lines; `'job:variant'` keys where the scene differs (read `JOB_SCENES` in `src/render/scene/work.js` and `VARIANTS` in `src/sim/scenes.js`: at least the indoor ones, `guard:dungeon`, `prisoner:cell`, `miner:gallery`, `judge:hearing`, `judge:verdict`, the bakehouse, the tavern bar, the lecture, the library). Each line says what that scene shows, present tense.
  - `PAYOFF: { [cue: string]: string[] }`: every name in `STORY_CUES`, 1-2 lines each, the aftermath, opening "And ..." where it reads well ("And the pig? Fast asleep by the farmer's fire.").

- [ ] **Step 1: Write the failing tests** `the new lines cover every job and story, and fit their shots`:
  - for every `j` of `Object.keys(JOBS)`: `WORK[j]?.length >= 2`.
  - for every `c` of `STORY_CUES`: `PAYOFF[c]?.length >= 1`.
  - every `WORK` line `spokenLength <= 2.2`; every `PAYOFF` line `spokenLength <= 3.2` (23.7 s to 27.1 s minus a pause); every `CARAVAN_QUIET` `<= 4.0`; `WISH(…'blacksmith')` `<= 2.4`.
  - pool sizes as in Global Constraints (`L` pools + `MORE`).
  - no line matches `/wizard|witch|spell|magic|\$\{|undefined/i`.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Write `src/audio/lines.js` and the `STORY_CUES` export.
- [ ] **Step 4:** Run, expect PASS; `npm test` still green (Task 1 snapshot unchanged).
- [ ] **Step 5:** Commit `Narration: work lines for every job, payoffs for every story, more wordings`.

### Task 4: Wire v2 into `buildScript`

**Files:**
- Modify: `src/audio/narration.js` (`buildScript`, `fitShots`, `MUST`, `SHOT_OF`, `FIXED_AT`, `cueOf`'s `aboutJob`)
- Test: `tests/narration-rotation.test.js`

**Interfaces:**
- Consumes: `NARRATION_FROM`, `routineRoles`, `turn` (Task 2); `MORE`, `CARAVAN_QUIET`, `WISH`, `WORK`, `PAYOFF` (Task 3).
- Produces: sentence roles `work` (with `job`, anchored like `person`) and `payoff` (fixed at 23.7 s); `fitShots(S, shots, r, must)` takes the MUST set as a parameter.

Changes, all behind `const v2 = diff.date >= NARRATION_FROM` (old path untouched, same `pick` calls in the same order):
- `say = routineRoles(diff)`; `t = (pool, k) => turn(pool, diff.day, k)` with fixed `k` per role (open 0, comment 1, cta 2, goal 3, caravan 4, wish 5, tavern 6, church 7, weather 8).
- `open`: only if `say.has('open')`, wording by `t`.
- `newcomers`: `up`/`up1`/`same` only if chosen; `down`/`down1` always. Caravan days: the count line (`L.caravan`) if chosen, else `t(CARAVAN_QUIET)`, role `caravan` either way.
- Requests: drop `L.granted`. For the first featured villager (host, or guest via `with`) whose `id` is in today's granted `diff.requests`, add `t(WISH)(job)`, role `requests`, `job` set. Apprentice line only when a featured villager (or guest) has job `apprentice`, with `job: 'apprentice'`.
- Work: for each `diff.featured` host (max 2, as `byJob`), add `WORK['job:variant']` (variant `diff.scenes?.variants?.[f.id]`) else `WORK[job]`, picked by `t`, role `work`, priority 6, `job` set; skip when none. Welcomes stay as today.
- `comment`: only if chosen, by `t`. `cta`: always, by `t`. Tavern, church, weather: by `t` over the v2 pools.
- Goal / payoff: `goal` when chosen (by `t`); otherwise, when the day's story cue (`storyCue(diff.story)`) has a `PAYOFF`, add it by `t`, role `payoff`, priority 8; otherwise `goal` if `diff.next`. (Spec's "both when they fit" left out: one line at 23.7 s.)
- `MUST` for v2: `{caravan, story, goal, payoff, cta}`; pass it to `fitShots` and to the `startsEarly` drop loop. `FIXED_AT.payoff = 23.7`. `order`: `work` after `person`, `payoff` before `goal`. `SHOT_OF.work = SHOT_OF.person`; `aboutJob` includes `work`.

- [ ] **Step 1: Write the failing tests** (helper: load a saved day, set `diff.date = '2026-12-0X'`, `diff.day = 46 + i`, cues as in `tests/audio.test.js` "no long silences"):
  - `from 2026-11-30 at most 2 routine lines a day, the call to action always`: 28 days from day 2026-11-21's diff: count of roles in `{open, comment, goal}` plus `newcomers` (delta up/same, and the caravan line only when it carries the count) `<= 2`, + 1 when `remaining <= 20`; `cta` present; no sentence text of roles `open|comment|cta|caravan|goal` equal to the day before's.
  - `the granted request is said over its villager`: day 2026-11-21 moved to v2, cues with `{ kind: 'villager', job: 'merchant', job2: 'stonemason', t0: 9, t1: 13 }`: a `requests` sentence with `job: 'merchant'` anchored at 9.25; no sentence contains "job requests". Same day with `diff.requests` granted ids not featured: no `requests` sentence.
  - `work lines over the villager shots, payoff at the end`: a `work` sentence for the guard (variant `wallnight`, falls back to `WORK.guard` if no key) and for the merchant (variant `null`); on a day `goal` is not chosen, a `payoff` sentence equal to one of `PAYOFF.pig`, anchored at 23.7. A story cue missing from `PAYOFF` (set `diff.story.id = 'nosuch'`) gives `goal` instead.
  - `a caravan day without the count still talks over the caravan`: a day where `say` lacks `newcomers` and `diff.named.length > 0`: a `caravan` sentence from `CARAVAN_QUIET`.
  - `villagers leaving are always said`: `diff.delta = -12`: a `delta` sentence "12 villagers packed …" or "Sad news: 12 …" on every day of the 4-day turn.
  - `no long silences after the change`: the `silences` helper of `tests/audio.test.js` on days 2026-11-13, 11-06, 11-21 moved to v2: worst `< 2.6` s, `!startsEarly`, words `<= 85`.
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement the changes above.
- [ ] **Step 4:** Run `npm test`. Expected: all PASS, including Task 1's snapshot and the existing narration tests.
- [ ] **Step 5:** `npm run daily -- --dry-run --subs 3300` prints a script without errors (read only).
- [ ] **Step 6:** Commit `Narration from 2026-11-30: routine lines in turn, the granted request over its villager, work lines, the story's payoff (owner 2026-11-25)`.

### Task 5: Record the decision, push

**Files:**
- Modify: `docs/FEATURES.md` (the narration paragraph after "The hook": owner 2026-11-25, approach C, `NARRATION_FROM`, the routine roles, `lines.js`, `rotation.js`, the test name)
- Modify: `docs/superpowers/specs/2026-11-25-narration-rotation-design.md` (Status: implemented, commit id)

- [ ] **Step 1:** Edit both files.
- [ ] **Step 2:** `npm test` green.
- [ ] **Step 3:** Commit, `git pull --rebase --autostash origin claude/gallant-fermat-pyz8n3`, `git push origin HEAD:claude/gallant-fermat-pyz8n3`.
- [ ] **Step 4 (only if the owner asks):** listen to one day, `node scripts/preview-day.js 3300` (~1 h on CPU, read only).
