# Narration: routine lines in rotation, words for what is on screen — design

Owner decision 2026-11-25 (session on the video "Why Your Claude AI Videos Get 0 Views", 7_AZati5b0M): approach C.
Status: approved by the owner 2026-11-25. Start moved by the owner to 2026-11-26 (away 11-27..30, wants to see the first video): the hook trial gets only 11-23..25 alone.

## Why

The video's first point: YouTube stops pushing a Short whose script is a near copy of many others. The Shorts of
Subscriber Kingdom have been stuck at 1.4-2K views since day 16, and the copy they resemble most is themselves.
The narration of the last 14 saved days (2026-11-11 to 11-24, rebuilt with `buildScript`) shows the problem is the
skeleton, not the number of variants. Of the ~9 sentences of a usual day, 6-7 are the same bookkeeping:

| line | days of 14 |
|---|---|
| "The Lord granted N job requests today!" | 11 |
| "... more villagers and the Dungeon opens beneath the castle." (2 wordings) | 12 |
| "N newcomers roll in!" / "A caravan of N newcomers rolls into town!" | 11 |
| "Leave a comment to name a villager." / "Comment below, and ..." | 10 |
| "Day N in Subscriber Kingdom." (3 wordings) | 11 |
| "Subscribe ..." (3 wordings) | 12 |

The day's story gets one sentence. The villagers at work get "Welcome our new X!" and nothing about what they do.

## Goals
- A usual day says at most 2 routine lines plus the call to action. The routine lines take turns from day to day.
- The words freed go to what the viewer sees: what each villager on screen is doing, and a closing line that pays off
  the day's story.
- The job-requests line is said only when the villager whose request was granted is on screen, over their shot.

## Non-goals
- No change to the video length (30 s), the shots, the title, the on-screen hook or the voice (Kokoro `am_adam`).
- The stories that have their own script (`raidScript`, `ambushScript`, `grandJoustScript`, `dayInLifeScript`,
  `eventScript`, `takeoverScript`) stay as they are.
- No change to who is featured (`src/sim/featured.js`); a linked session works on villager shots.

## Anti-goals (a failure even if it works)
- Silence over a shot (more than ~1.5 s with nobody speaking where the narrator spoke before).
- A line about something not on screen at that moment.
- A name read aloud (names stay on screen only), magic, noble titles as jobs, a villager hurt or made a villain.
- Any text from a comment in the narration; no language model anywhere in the pipeline. All lines are written by hand
  in the code, as today.
- Saved days that read differently when rendered again.

## Approaches considered
- A. More wordings for the fixed lines. Cheap, but every script keeps the same meaning in the same order.
- B. Routine lines in rotation, freed words to the story and the work shots.
- C. B, and the job-requests line only when the granted villager is on screen. **Picked by the owner.**

## Design

### Start date
`NARRATION_FROM = '2026-11-26'` (Claude's call): days before it keep today's `buildScript` exactly, so saved days read
the same and the hook trial (2026-11-23 to 11-29, see `docs/FEATURES.md`, "The hook") is not mixed with this change.

### Routine lines
Routine roles: `open` (the day line), `newcomers` (`delta` / `caravan` count), `comment` (name invitation), `goal`.
- `cta` is said every day, at its fixed time (`FIXED_AT.cta`), from a pool that turns with the day (below).
- Of the routine roles, at most 2 a day. The order turns with the day: the list `[open, newcomers, comment, goal]`
  rotated by `day % 4`, the first 2 that apply that day are said (`goal` applies only with `diff.next`; `comment` and
  `newcomers` always). Stateless, so a re-render of a day reads the same. (Claude's call: a fixed turn instead of a log
  in `state.sceneLog`, simpler and deterministic.)
- Forced, on top of the 2: `goal` when `diff.next.remaining <= 20` (the goal is about to be reached: news);
  villagers leaving (`down`, `down1`), the milestone, `promoted`: they are news, not routine, and stay as today.
- The caravan shot must not go silent: when `newcomers` is not in today's 2, the caravan shot gets a caravan line
  without the number, from a pool of at least 8 (carts, bundles, a dog trotting behind...). Same for `open`: on days
  that do not open on a story (no cold open), the first line is the line of the first shot.
- Wordings inside a pool turn with the day too, `pool[(day + k) % pool.length]` with a fixed `k` per role, so no wording
  comes back before the pool is used up: `cta` (at least 6), `comment` (at least 6), `goal` (at least 4), `open`
  (at least 4), the caravan lines. The other lines that come back often (the tavern, the church, the weather) take
  their wording the same way (Claude's call), with a few more wordings each.

### Job requests (approach C)
- "The Lord granted N job requests today!" goes. In its place, when a villager on screen got the job they asked for
  today (`diff.requests` granted, matched to `diff.featured` by villager id), one line over that villager's shot, e.g.
  "This one asked to be a fletcher. Wish granted!" (a few wordings). No line when no such villager is on screen.
- The apprentice line ("N apprentices wait ...") follows the same rule: only over a featured apprentice's shot.

### Freed words, part 1: the villagers at work
- A new table `L.work[job]` (2-3 lines per job, 69 jobs), with `L.work['job:variant']` where a variant shows something
  quite different (indoor scenes, the dungeon, the mine, the court). Each line says what the villager is doing in that
  shot: "The blacksmith quenches a red-hot blade." Anchored to the villager's shot (`kind: 'villager'`), role `work`.
- A villager named today keeps a welcome, merged with the work line where it fits ("New in town: the potter, already
  at the wheel."), so one line per shot as today ("one welcome per shot").
- The pair lines (`L.pair`) stay.

### Freed words, part 2: the story's payoff
- A new table `L.payoff[cue]`, one or two lines for each story cue of `L.story` (62 cues), said over the wide shot at
  the goal's fixed time (23.7 s) when `goal` is not said that day: "And the pig? Asleep in the farmer's kitchen."
  On days where `goal` is said, the payoff goes, unless the goal line can take its short wording and both fit.
- The payoff closes the story told at the start of the video, so the viewer who stays hears how it ended.

### Unchanged machinery
Word budget (60-85 words), `fitShots`, `startsEarly`, `sentenceAnchors`, the sort by shot, `FIXED_AT`, `MUST`
(with `open` and `delta` out of it after the start date: they are routine now; `caravan`, `story`, `cta` stay in).

### Example (day 37, 2026-11-21, the pig; illustrative, the real lines are the builder's)
Today: "Day 37 in Subscriber Kingdom. A caravan of 8 newcomers rolls into town! A pig got loose in the square, and the
farmer gives chase! The Lord granted 10 job requests today! Comment below, and a villager takes your name. Just 90 more
villagers and the Dungeon opens beneath the castle. Subscribe to claim your house in the kingdom."
After: "A pig got loose in the square, and the farmer gives chase! Carts creak through the gate, eight new lives to
unpack. Up on the wall, a guard keeps watch into the night. The merchant drops by the stonemason with a deal. Meanwhile,
the tavern is full tonight! And the pig? Fast asleep by the farmer's fire. Subscribe to claim your house in the kingdom."

## Constraints
- Determinism: no `Math.random()`; draws from the seeded `rng` or from the day number.
- `npm test` stays green; English only; names never read aloud (`docs/FEATURES.md`, "English only", narration).
- Record the owner's decision in `docs/FEATURES.md` (narration section), not in `CLAUDE.md`.

## Tests (for the builder)
- Every saved day before `NARRATION_FROM` gives the same script as before the change (all files in `state/history/`).
- 28 simulated days from `NARRATION_FROM`: at most 2 routine lines + `cta` a day (plus the forced ones); no routine
  wording on two days running; no wording of `cta`, `comment` back within its pool's length.
- The requests line only when a granted villager is in `diff.featured`, and anchored to that shot.
- Every cue of `L.story` has a payoff; every job of `JOBS` has work lines.
- No silent shot: with the shot plan, every shot that had a line before still has one ("no long silences" test).
- Listen to one day: `node scripts/preview-day.js <subs>` (read only, about an hour on CPU); only when the owner asks.

## Left to the builder
The wordings (all hand-written, short enough for their shots: ~2.5 words a second), the `k` offsets, how the welcome and
the work line merge, the exact role names.
