# Work animations with the new rig, and a place for every job — design

Owner, 2026-11-25. Status: approved by the owner on 2026-11-25. Third part (a new running order for the videos) comes after
these two, in a design of its own.

## Why

The owner finds the villagers' work animations robotic. Each one is a single sine wave repeated identically, with no
elbows or knees, and the baker slides back and forth with his feet. Some scenes also make no sense:
- the baker's peel goes through the oven;
- the farmer hoes a small patch of soil laid on top of the kingdom's yellow field.

The owner saw a prototype of a new rig (before/after clips of 7 jobs, `--rig2`) and said the movement is "decisamente
meglio". They want:
1. every work animation redone with the new rig, and every scene checked for problems like those above, which
   "should not exist";
2. a place to work for every job that has none (now about twenty jobs work in the croft behind their house), unless
   that place comes with a goal. The owner's example: the tax collector behind a barred counter, people bringing sacks
   of coins, two guards always beside the counter.

Success: a viewer sees villagers who move like people at work, in a place that fits the job, with nothing passing
through anything.

## Goals

- Every villager rig in a work scene uses the new joints and the life layer (below), in every job and variant.
- No tool, hand or body passes through a prop or building in any work scene, outside the spot where it is meant to strike.
- The farmer hoes, sows and scythes the kingdom's own fields, with no fake soil patch.
- Every job with a sensible workplace has one (list below), in the mixed form the owner chose.
- The tax collector works behind a barred counter at the Counting House, taxpayers queue with coin sacks, and two guards
  stand beside it in every shot of it.

## Non-goals

- New jobs, new story events, or new goals.
- The order of shots in the video, the scene rotation, how many villagers a video shows. That is the third part.
- Changing how villagers look (bodies, outfits, colours). The blocky style stays. The owner chose to keep the look and
  improve the motion.
- Story scenes (`stories/`), the caravan, the tavern and church interiors, the joust. They use the same `rig()` and get
  the new joints for free (straight by default, so they look the same). Their motion is not reworked here.

## Anti-goals (a failure even if it works)

- Any scene where a tool, hand or person goes through a wall, an oven, a table, a prop or another person.
- Feet sliding on the ground, or a person floating above it or sunk into it.
- A sound or a burst of sparks with no blow (the pauses must also pause the impacts).
- Moving plots or existing buildings (the stable-world rule): new lots only after the existing ones, as `placeStreetLot` does.
- Anything going live while the owner is away (2026-11-27 to 11-30), see Rollout.

## Constraints

- Everything stays a pure function of `t` (deterministic frames). Any randomness comes from `rand01(seed, ...)`, never `Math.random()`.
- `strikeTimes()` must match what is drawn, because the sound effects come from it.
- Renders are slow (~7.7 s a frame for a 1080×1920 gallery PNG on the owner's PC). Checks are done mostly with code;
  stills are used only where the eye is needed.
- `npm test` stays green. Medieval only, nobody hurt. No new owner decisions recorded outside `docs/FEATURES.md`.

## Approaches considered

**Animation:**
- **A. Keep the blocky characters, improve the rig and motion procedurally (chosen).** The owner saw it in the prototype
  and approved it.
- **B. New skinned characters with ready-made animations (CC0 packs).** A bigger jump, but every outfit, held tool and
  story scene would need redoing. Not chosen: the owner wants the current look.

**Places:**
- **Mixed (chosen by the owner).** New buildings in town for the big trades; for the small trades, a shop front with a
  counter and a sign on the villager's own house; existing buildings for jobs that fit one already.
- **Every job a new building.** Not chosen: much more work and much more room on the map.

## Part 1: the new rig and every work animation

### The rig (from the prototype, `src/render/scene/work.js`)

Made permanent, with no `--rig2` switch:
- **Arms:**
  - the upper arm (shoulder pivot `P.r.g` / `P.l.g`, as now);
  - an elbow group (`P.r.elbow`) at 0.32 m;
  - the forearm, with the hand group under it at 0.34 m.
  - The hand ends where it does now (0.66 m), so with the elbow straight every pose is unchanged.
- **Standing legs:**
  - hip groups at the body's hips, knee at 0.27 m, foot at 0.27 m (ankle 0.06 m above the ground);
  - `legIK(P, feet)` keeps the feet planted where they are placed and bends the knees when the hips drop or move.
  - Walking, seated and on-the-ground rigs keep their present legs.
- **Outfit parts:** parts that hang below the elbow (the falconer's glove) move to the forearm (`outfits.js dress`).

### The life layer (every work scene)

- **Clock:**
  - every stroke a little longer or shorter (±9%) and higher or lower (±8%);
  - now and then (about 1 stroke in 6) a pause of 1.4-2.2 s after a stroke;
  - strokes, props, particles and sounds all read this clock.
  - Jobs where timing is scripted keep the plain clock: once, archer, errand, adit, cart, the dancer, the juggler, the
    musicians, the sleeper, the drinker, the spy.
- **Elbows:**
  - strikes: bent on the backswing, almost straight at the blow (the props are calibrated with the elbow at the blow's angle);
  - pushing: straightening with the push;
  - smooth and stirring work: an easy bend that lags the shoulder.
- **Body:**
  - breathing;
  - weight moving from foot to foot, the spine tilting against it;
  - a lean back on the backswing, the knees giving a little after a heavy blow.
- **Head:** on the work, with a glance aside now and then.
- **Pauses:** stand up straight, then a hand to the brow, a stretch of the back, or a look round. The free hand leaves
  the handle; the tool rests where the stroke ended.
- **Pushing jobs** (the baker at the oven and kneading, the chimney sweep, the tanner, the stablehand, the carpenter
  sawing, the sailor hauling): no more sliding of the whole rig. The hips go forward and back over planted, staggered
  feet; the body leans and the arms straighten.

### Every animation, one by one

For each job and variant (about 120 configs in `JOB_SCENES`, one per job and variant), the builder:
1. tunes the life layer's numbers where the defaults do not suit, through per-scene config fields, so that a cut of
   wood, a stir of a pot and a smoker each have their own feel;
2. runs the clip check (below) and fixes every hit;
3. looks at gallery stills at a few times, including one in a pause.

Known fixes:
- **Baker at the oven:** the peel goes into the oven's mouth, not through its wall. Aim the scene at the mouth: the
  peel's reach, its angle, the rig's distance from the oven.
- **Farmer on the fields** (`atField` in `main.js`): no `field` soil patch when the scene is on one of the kingdom's
  fields. The farmer hoes, sows and scythes the crop that is there. The fake patch stays only where there is no field
  (the croft before the fields stand).

### The clip check (new, a test)

A check that samples every work scene over a few cycles, the pauses included. At each sample it tests:
- the tool's tip and both hands against the boxes of the scene's props;
- the rig's body against them.

It reports any that is inside a box. The impact point and the props a hand holds (the handle, the dough, the rope) are
allowed. The feet are tested against the ground: no float, no sink.

- It runs in `npm test` if the work scenes can be built under Node: `work.js` already imports under Node, and `three` needs no DOM for geometry. Otherwise it
  runs in the render page as `SK.clipCheck()` from a script, and the builder records the result in the plan's ledger.
- Before the fixes it must flag the baker's peel. That is its own test.

## Part 2: a place for every job

**Rule:** a job whose scenes all happen in the croft, and that has a place where such work is really done, gets one. A
job gets none when that place will come with a goal (the goal will bring it), or when the job has no workplace.

Owner 2026-11-25: more than one shop for a big trade, each with a number of workers that fits the trade. Counts are
of all villagers of the job (1 subscriber = 1 villager; only those who commented have a name), from the state of 2026-11-25.
Shops = villagers ÷ workers per shop, rounded up.

| Job | Villagers (named) | Workers per place | Places today | Place | Kind |
| --- | --- | --- | --- | --- | --- |
| Carpenter | 110 (33) | 5 | 22 | a carpenter's shed: bench, planks, sawhorse | shop front |
| Tax collector | 23 (23) | 4 | 6 | the Counting House's barred counter, and 5 barred counters on houses; 2 guards at each | existing building + shop fronts |
| Cook, the pot scene | 8 (8) | 3 | 3 | a cookshop counter with the stew pot | shop front |
| Barber | 2 (2) | 1 | 2 | a striped pole, a chair, a basin | shop front |
| Brewer, the stirring scene | 2 (2) | 2 | 1 | a brewing vat under an awning | shop front |
| Weaver | 0 | 2 | 0 | a loom under an awning (when one arrives) | shop front |
| Stablehand | 5 (5) | 5 | 1 | Stables: a row of stalls with horses, hay | new building |
| Teacher | 3 (3) | 3 | 1 | Schoolhouse: a small hall with benches, children | new building |
| Astronomer | 2 (2) | 2 | 1 | Observatory: a round stone tower with an open top | new building |
| Tanner | 1 (1) | 2 | 1 | Tannery: vats and hides on frames, on the river bank | new building |
| Philosopher, Physicist | 3, 1 | — | — | the University's lawn, as the scholar and the librarian (the physicist's ramp and bells there) | existing building |
| Adviser, Diplomat | 2, 1 | — | — | the steps of the Town Hall | existing building |

A new building takes all the job's villagers. If a job outgrows its building's number, a second one is the owner's
call, not automatic.

No place:
- beggar, spy, jester, weirdo, sweeper, apprentice (works with their master's job), messenger (at a villager's door),
  prisoner;
- the jobs outside town that already have a spot: hunter, falconer, shepherd, fisherman.

### New buildings

- **Commissioned:** they go in `COMMISSIONS` (`tiers.js`), so each is begun on a day the kingdom runs and is built with
  the usual construction shots. At most 2 buildings begin a day (owner's rule), so the four take two days, which gives
  the videos two days of "a new building begins". A goal's buildings go before the commissions in the queue (the Dungeon's goal is 20 subscribers away). *Builder's call (minor).*
- **Laid out:** on street lots after the existing plots (`placeStreetLot` in `world.js`, as the Fletcher's and the
  Engineers' Workshops). The Tannery on a lot by the river, below the town.
- **Used:** each job's scenes move there once it stands (`PLACES` in `main.js`), with the croft scene before. Once
  finished, the building's "Completed!" shot shows the first named villager of the job at work.

### Shop fronts

- **What it is:** a lean-to roof, a counter and a hanging sign on the street side of a house. The work is done at the
  counter, seen from the street. The camera is on the street, a visitor at the counter.
- **On the map (owner 2026-11-25):** the shops are always there, in every shot of the town.
  - **How many:** a job with N villagers and W workers per shop has ceil(N / W) shops (table above).
  - **Which houses:** the job's villagers in order of index, in groups of W. Each group's shop is on the house of its
    first villager. Worked out from the state at render time, with no new state field, so a new shop opens when the job
    grows past a multiple of W.
  - **Who works where:** a villager's scenes are at their group's shop.
  - **When a villager leaves:** the groups are worked out again. A shop can move, which is rare (the owner accepts it as
    the town changing).
  - **Drawing:** `houses.js` adds the shop front to each of those houses; `workPlace` puts the scene at the counter of
    the villager's shop.
  - **A house with two shops** (two villagers of different trades): the second goes on the other street side if there
    is one, else on the next house of its group. *Builder's call (minor).*

### The Counting House counter

The front of the Counting House gets:
- a counter window with iron bars;
- the tax collector inside behind it, counting and writing;
- a queue of villagers, each carrying a sack of coins, who puts it on the counter and walks off;
- two guards in tabards, standing one at each side of the counter (the same at each of the 5 barred counters on houses), in every shot of it (the counting scene, the
  building's own shots, the wide shots that pass it).

The `counting` scene moves behind the counter. The `rounds` scene (the collector going door to door) stays.

## Rollout

- **Branch:** the work is done on a branch of its own, `claude/work-animations-shops`, and merged into
  `claude/gallant-fermat-pyz8n3` only when the owner approves it after coming back (from 2026-12-01). So nothing changes
  in the daily videos while they are away, and the new narration and voice (from 2026-11-26) are measured alone for a
  few days.
- **Commits:** the branch is committed and pushed as work goes (the owner's rule for every change), but not merged.
- **For the owner's return (owner 2026-11-25: stills only, no full renders, no "before" clips):**
  - gallery stills of every job with the new rig, one of them in a pause;
  - stills of each new building, each shop front and the Counting House counter;
  - `--stills` of a real day with the new places on the map.
- **Renders while building:** stills only (`--gallery` with a few times, `--stills`), never a full video. So the work
  is not held up by renders of an hour or more.

## Left to the builder

- The life layer's exact numbers per scene, within the ranges above.
- The look of each new building and shop front, in the town's existing style (`buildings.js`, `houseKit.js`), medieval
  and plausible.
- Where on the street lots each new building goes, within the stable-world rule.
- Whether the clip check runs under Node or in the page.
