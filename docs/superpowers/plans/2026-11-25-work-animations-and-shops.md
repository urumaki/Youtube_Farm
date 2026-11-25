# Work animations with the new rig, and a place for every job — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every villager work scene moves like a person at work (elbows, planted feet, breathing, varied strokes, pauses) with
nothing passing through anything, and every job that should have a workplace has one: shop fronts on houses (several per
trade), four new buildings, existing buildings for a few.

**Architecture:**
- The prototype rig (uncommitted in this worktree: `work.js`, `outfits.js`, the `--rig2` switch in `main.js` and
  `pipeline.js`) becomes permanent.
- A Node-side clip check samples every work scene and lists contacts with props, and a test keeps that list empty.
- Shops are worked out from the state at render time by a pure module (`src/sim/shops.js`). `houses.js` draws them, and
  `workPlace` in `main.js` sends each villager to their shop.
- The four new buildings are owner commissions on new street lots laid out after everything else.

**Tech Stack:** Node ESM, `node:test`, three.js (headless Chromium for renders, plain Node for geometry checks).

**Spec:** `docs/superpowers/specs/2026-11-25-work-animations-and-shops-design.md`

## Global Constraints

- **Branch:**
  - all work on `claude/work-animations-shops`, created from `claude/gallant-fermat-pyz8n3`, committed and pushed as you go;
  - never merged into `claude/gallant-fermat-pyz8n3` (the owner merges after 2026-12-01).
- **Determinism:**
  - every frame a pure function of `t`; randomness only from `rand01(seed, ...)` / `hash(...)`, never `Math.random()`;
  - `strikeTimes()` must equal the blows drawn (the sounds come from it).
- **Stable world:** no plot, street or existing lot moves. New lots are placed after every existing `placeStreetLot` call in `world()`.
- **Renders:** stills only (`--gallery` with a few `--gallery-times`, `--stills`), never a full video (owner 2026-11-25).
- **Tests:** `npm test` stays green after every task.
- **Content:** medieval only, nothing magic, nobody hurt. CC0 sounds only.
- **Rig numbers from the spec:**
  - elbow at 0.32 m down the arm, hand 0.34 m below the elbow;
  - hip→knee 0.27 m, knee→ankle 0.27 m, ankle 0.06 m above the ground;
  - stroke length ±9%, height ±8%;
  - a pause after about 1 stroke in 6, lasting 1.4-2.2 s.
- **Shop sizes from the spec (workers per place):** carpenter 5, tax collector 4 (group 0 at the Counting House, the
  others on houses, 2 guards at every counter), cook 3, barber 1, brewer 2, weaver 2.
- **New buildings (all the job's villagers):** Stables (stablehand), Schoolhouse (teacher), Observatory (astronomer),
  Tannery (tanner, by the river).
- **Existing buildings:** philosopher and physicist on the University's lawn; adviser and diplomat at the Town Hall steps.
- **Docs:** record the owner decisions in `docs/FEATURES.md` (the work scenes and buildings sections).

## Review Focus

1. **Visits:** a visit shot (`visit.js`) turns the host round and brings a walking guest. The host's planted feet must
   turn with the root, and the guest (a walking rig) keeps its old legs. Clip-check the `+guest` gallery forms too.
2. **Story scenes reuse `rig()`:** with elbows and knees at rest, a rig must put its hands and feet exactly where the old
   rig did, or every story's poses shift.
3. **A shot that starts inside a pause:** the worker stands still. No sound, no particles, and the tool rests where the
   last stroke ended, not mid-air.
4. **Shop houses that change:** a shop's house turns to ruin or is abandoned, a shop's first villager unsubscribes, or
   two shops fall on one house. The shop must move, never sit on a ruin or vanish.
5. **Map and wide shots:** `scripts/map.js`, the time-lapse and the flights over town draw `buildHouses`. Shop fronts
   must not break batching or float off sloped house bases.

---

### Task 1: The new rig, permanent

**Files:**
- Modify: `src/render/scene/work.js` (the prototype's `rig()` changes, `legIK`, clock, `life()`; remove `globalThis.__RIG2`)
- Modify: `src/render/scene/outfits.js` (forearm parts, already in the prototype)
- Modify: `src/render/scene/main.js:48`, `src/pipeline.js` (remove the `--rig2` switch)
- Create: `tests/helpers/scene.js`, `tests/rig.test.js`

**Interfaces:**
- Produces:
  - `rig(M, color, opts)` returns `P` with `P.r.elbow`, `P.l.elbow` (always), and `P.legs2` (standing rigs only):
    `[{hip, knee, foot, x}]`. Rename the prototype's `P.rig2` to `P.legs2` and drop `P.r2`.
  - `legIK(P, feet)`, exported from `work.js`.
  - `buildWorkScene(...)` result gains `props` (the props group), `impact` (Vector3, scene-local), `clock(t)`, which
    returns `{ k, u, restS }` (restS −1 outside a pause), and `cfg`.
  - `tests/helpers/scene.js`: `fakeMaterials()`, a Proxy giving a `MeshStandardMaterial` for any key (with `.clone()`);
    `workScene(job, variant)`, which builds one with anchor `(0,0,0)`, face 0, seed 7, id 1.

- [ ] **Step 1: Create the branch from the prototype**

Run: `git switch -c claude/work-animations-shops` (the uncommitted prototype comes along).
Expected: `git status` shows the 4 modified files on the new branch.

- [ ] **Step 2: Write the failing tests in `tests/rig.test.js`**

- `rest pose matches the old rig`: with every joint at rest, the world positions of `P.r.hand`, `P.l.hand` and each foot
  group (`P.legs2[i].foot`) are within 1e-6 of the old rig's: hands `(±0.3, 0.62+0.8−0.66, 0)`, ankles `(±0.09, 0.06, 0)`.
- `feet stay planted`: for `baker:oven`, `blacksmith` and `farmer`, sample `update(t)` for t from 0 to 12 s every
  0.05 s. Each foot's world position moves less than 0.005 m from its first sample, and its y stays within 0.01 of 0.06.
- `no sound or blow in a pause`: for `blacksmith`, every time in `strikeTimes(0, 30)` has `clock(t).restS === -1`. At
  least one pause exists in 0..30 s (seed 7, id 1; pick another id in the helper if not).
- `pause shows no particles`: for `blacksmith` at a time 0.5 s into a pause that starts more than 1 s after the last
  blow, every particle position is parked (`>= 1e4`).
- `strokes vary`: the gaps between consecutive `strikeTimes(0, 30)` that are not split by a pause take at least 3
  distinct values (to 0.01 s).

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test tests/rig.test.js`
Expected: FAIL (`P.legs2` undefined, `clock` not returned).

- [ ] **Step 4: Make the prototype permanent**

- Delete `globalThis.__RIG2`, `R2` and every `--rig2` line. The elbow and leg joints are always built.
- Rename `P.rig2` to `P.legs2`, and expose `props`, `impact`, `clock` and `cfg` on the scene.
- Keep the prototype's numbers. Fix its `var legs2` into a `let` declared before the branches.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test tests/rig.test.js && npm test`
Expected: PASS, the whole suite green.

- [ ] **Step 6: Commit and push**

```bash
git add -A src/render/scene/work.js src/render/scene/outfits.js src/render/scene/main.js src/pipeline.js tests/helpers/scene.js tests/rig.test.js
git commit -m "Work scenes: elbows, planted feet, breathing, strokes that vary and pauses (owner 2026-11-25)"
git push -u origin claude/work-animations-shops
```

### Task 2: The clip check

**Files:**
- Create: `src/render/scene/clipcheck.js`, `tests/clip.test.js`
- Modify: `src/render/scene/work.js` (export `JOB_SCENES`, `sceneOf`; mark allowed contacts with `userData.touch`)

**Interfaces:**
- Consumes: Task 1's `workScene()`, `ws.props`, `ws.impact`, `ws.clock`, `ws.tool`, `ws.rig`.
- Produces:
  - `clipCheck(ws, { from = 0, to = 12, step = 0.05 }) → [{ part, t, mesh }]`, where `part` is `'tool' | 'handR' | 'handL'
    | 'head' | 'body'`. Each hit is a point inside a prop mesh's oriented box (shrunk by 0.02 m). The box is the mesh's
    geometry bounding box in its own local frame, and the point is transformed into that frame.
  - Not a hit:
    - the tool's tip within 0.25 m of `ws.impact` while the stroke is in `u ∈ [hit−0.1, hit+0.1]`;
    - any part inside a mesh whose `userData.touch` is true (handles, the dough, a rope, a hide being worked);
    - meshes that are a ground or floor (`userData.floor`).
  - The tool's test point is `tool.userData.tip` if set, else the far end of the tool's bounding box.
  - `allScenes() → ['job', 'job:variant', ...]`: every `JOB_SCENES` key whose props build under Node.

- [ ] **Step 1: Write the failing tests in `tests/clip.test.js`**

- `the check finds the baker's peel in the oven`: `clipCheck(workScene('baker', 'oven'))` has a hit with `part === 'tool'`.
  This test is renamed and inverted in Task 3, once the fix lands.
- `the check passes a clean scene`: `clipCheck(workScene('blacksmith'))` is `[]` (fix the props or allow-list here if not).
- `every scene builds under Node`: `allScenes().length >= 100`.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/clip.test.js`
Expected: FAIL (`clipcheck.js` missing).

- [ ] **Step 3: Implement `clipCheck` and `allScenes` in `src/render/scene/clipcheck.js`**

Use `THREE.Mesh.geometry.boundingBox` with `mesh.matrixWorld` inverted per sample. Call `ws.group.updateMatrixWorld(true)`
after each `update(t)`. Skip the rig's own meshes and the tool's.

- [ ] **Step 4: Run them to verify they pass**

Run: `node --test tests/clip.test.js && npm test`
Expected: PASS.

- [ ] **Step 5: Print the full list once and save it**

Run: `node -e "import('./src/render/scene/clipcheck.js').then(async m => { ... print scene, part, count ... })"`. Save the
output to the plan's ledger (`.superpowers/sdd/...`): it is Task 4's worklist.

- [ ] **Step 6: Commit and push**

```bash
git add src/render/scene/clipcheck.js src/render/scene/work.js tests/clip.test.js
git commit -m "Clip check: any tool, hand or body inside a prop in a work scene"
git push
```

### Task 3: The two known fixes (the baker's peel, the farmer on the fields)

**Files:**
- Modify: `src/render/scene/work.js` (`ovenmouth` props or the `baker` config; the `field` props), `src/render/scene/main.js` (`atField`)
- Modify: `tests/clip.test.js`, `tests/rig.test.js`

**Interfaces:**
- Produces: `buildWorkScene({ ..., onField = false })`. When true, the `field` props draw no soil patch and the hoe's
  impact is at the crop's surface (0.12 m). `workPlace` returns `onField: true` from `atField`, and the caller passes it on.

- [ ] **Step 1: Write the failing tests**

- `tests/clip.test.js`, invert Task 2's first test: `the baker's peel goes into the oven's mouth` →
  `clipCheck(workScene('baker','oven'))` is `[]`, and at the stroke's farthest reach the tool's tip is inside the mouth's
  opening box (`props.userData.mouth`, a `THREE.Box3` in scene coordinates that the `ovenmouth` props set).
- `tests/rig.test.js`, `a farmer on the fields has no soil patch`: `workScene('farmer', 'hoe', { onField: true })` has
  no prop mesh named `soil`, and `workScene('farmer','hoe')` still has one. Name the patch mesh `soil` in the `field` props.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/clip.test.js tests/rig.test.js`
Expected: FAIL on both.

- [ ] **Step 3: Fix the peel**

Aim the baker at the mouth: the rig's distance, the peel's angle and reach, so the blade enters through the opening.
Set `userData.mouth`.

- [ ] **Step 4: Fix the farmer on the fields**

Add the `onField` option, used for every farmer variant placed by `atField`, and the priest's `bless` too.

- [ ] **Step 5: Run the tests**

Run: `node --test tests/clip.test.js tests/rig.test.js && npm test`
Expected: PASS.

- [ ] **Step 6: Stills**

Run: `npm run render -- --real --subs 3230 --gallery "baker:oven,farmer:hoe,farmer:sow,farmer:scythe" --gallery-times 1.2,2.0`
Expected: the peel's blade inside the oven's mouth; the farmers on the yellow crop, no brown patch. Look at each PNG.

- [ ] **Step 7: Commit and push**

```bash
git commit -am "The baker's peel goes into the oven's mouth; farmers work the kingdom's fields, no soil patch (owner 2026-11-25)"
git push
```

### Task 4: Every work scene, one by one

**Files:**
- Modify: `src/render/scene/work.js` (configs and props), `src/render/scene/clipcheck.js` (allow-lists only with a reason)
- Modify: `tests/clip.test.js`

**Interfaces:**
- Consumes: Task 2's worklist, and `clipCheck` / `allScenes`.
- Produces: per-scene life-layer fields in `JOB_SCENES`, all optional:
  - `flex: [hit, back]`: elbow bend at the blow and on the backswing, rad; default `[0.08, 0.88]`;
  - `sway`: hip sway, m; default 0.028;
  - `rest: false`: no pauses;
  - `feet: [[x,z],[x,z]]`: overrides the stance.

- [ ] **Step 1: Write the failing test**

`tests/clip.test.js`: `no work scene clips` loops `allScenes()` and asserts `clipCheck(workScene(...))` is `[]`, with the
scene's name in the message.

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/clip.test.js`
Expected: FAIL, listing the worklist's scenes.

- [ ] **Step 3: Fix the scenes one family at a time**

Commit after each family:
- smiths;
- wood and stone;
- food and drink;
- farm and animals;
- market and money;
- church and court;
- learned jobs;
- performers;
- request-only jobs.

For each scene, tune the life fields so the motion fits the work (the spec: a cut of wood, a stir and a smoker each
have their own feel). Fix the hits by moving props or reach, never by allow-listing a real pass-through.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/clip.test.js && npm test`
Expected: PASS.

- [ ] **Step 5: Stills of every scene**

Run, in batches of about 20 scenes: `npm run render -- --real --subs 3230 --gallery "<batch>" --gallery-times 1.3,3.1`.
Pick the second time so that each scene shows a pause (from `ws.clock`). Look at every PNG. Fix what the eye finds and
the check cannot (a hand floating off a handle, a head through a hat). Note each look in the ledger.

- [ ] **Step 6: Commit and push**

```bash
git commit -am "Work scenes: every job tuned for the new rig, no tool or hand through a prop"
git push
```

### Task 5: Who works at which shop (`src/sim/shops.js`)

**Files:**
- Create: `src/sim/shops.js`, `tests/shops.test.js`

**Interfaces:**
- Produces:
  - `SHOP_SIZE = { carpenter: 5, taxcollector: 4, cook: 3, barber: 1, brewer: 2, weaver: 2 }`.
  - `SHOP_SCENES = { carpenter: null, taxcollector: 'counting', cook: 'cauldron', barber: null, brewer: 'stir', weaver: null }`
    (null: every scene of the job).
  - `shopsOf(state) → [{ job, k, house, members: [villagerIndex] }]`.
    - Groups: the job's villagers (index < `subscriberCount`), in index order, in groups of `SHOP_SIZE[job]`.
    - `house`: the house of the group's first member, or of the next member when that house is not `occupied` or
      already has a shop. Null when no member's house is free.
    - `taxcollector` group k = 0: `house = 'counting_house'`.
  - `shopOf(state, id, variant) → { job, k, house } | null`. Null when the job has no shop, when `SHOP_SCENES[job]` is
    set and differs from `variant`, or when the group has no house.

- [ ] **Step 1: Write the failing tests in `tests/shops.test.js`**

Build small states with `migrate` (`src/sim/state.js`), using villagers and houses fixtures written in the test:
- `groups by size`: 11 carpenters give 3 shops of 5, 5 and 1 members, in index order.
- `a shop on the first member's house`.
- `two shops never share a house`: a carpenter and a cook live in one house and both lead a group, so the cook's shop is
  on the next cook's house.
- `a ruined house passes the shop on`: house status `ruin` means the next member's house.
- `the first tax group is the Counting House`.
- `shopOf follows the scene`: cook with `'stall'` is null, with `'cauldron'` is the shop.
- `real state`: on `state/kingdom.json` (migrated), carpenter 22 shops, taxcollector 6, cook 3, barber 2, brewer 1.
  Skip the test if the counts in the real state have moved since 2026-11-25: compare with the job's villager count and
  `Math.ceil`.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/shops.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `src/sim/shops.js`**

Pure, no three.js. Read the villagers from `state.villagers` (migrated) and the houses from `state.houses` (`occupants`,
`status`).

- [ ] **Step 4: Run them to verify they pass**

Run: `node --test tests/shops.test.js && npm test`
Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/sim/shops.js tests/shops.test.js
git commit -m "Shops: several per trade, sized by trade, on the houses of their villagers (owner 2026-11-25)"
git push
```

### Task 6: Shop fronts on the houses, and the counters with guards

**Files:**
- Create: `src/render/scene/shopfronts.js`
- Modify: `src/render/scene/houses.js` (`buildHouses` adds the fronts), `src/render/scene/buildings.js` (`counting_house`
  front: a counter window with bars)
- Modify: `tests/shops.test.js`

**Interfaces:**
- Consumes: `shopsOf(state)`.
- Produces:
  - `shopFront(kind, M) → THREE.Group`, kinds `'carpenter' | 'taxcollector' | 'cook' | 'barber' | 'brewer' | 'weaver'`.
    - Frame: the counter's front centre at `(0, 0, 0)`, the street at `+z`, the house wall at `z = −1.6`, about 3.2 m wide.
    - Every group has `userData.counter`: a Vector3, where the worker stands, behind the counter.
    - `'taxcollector'` also has bars on its window and `userData.guards`: two `[x, z]` spots, one each side.
  - `buildHouses(...)` returns `shops: Map<houseId, { group, counter: Vector3 (world), face: number }>`, placed on the
    house's street side (local −z of the house shape, as `alleyBy` uses).
  - Both counters (the Counting House's and the houses') get two guards: `rig(M, JOBS.guard.color)` with a spear, idle,
    breathing (`life` with `cfg = { idle: true }`). They are drawn in every shot: on the map they are part of the
    building or the shop group.
  - `buildings.js counting_house` gains `out.counter`: a lot-local `[x, z]` behind the new counter window.

- [ ] **Step 1: Write the failing test**

`tests/shops.test.js`, `every kind of shop front builds with a counter`: each kind returns a group with
`userData.counter`, and `'taxcollector'` has 2 guard spots.

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/shops.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement the fronts**

Use the town's style (`houseKit.js`, `kit.js`):
- a lean-to roof and a counter for every kind;
- a sign: a saw, a coin, a pot, the barber's striped pole, a tankard, a skein;
- each kind's own props.

Then the barred counter on the Counting House, keeping its door and banners.

- [ ] **Step 4: Draw them in `buildHouses`**

Seat each front on the house's plinth level (`sh.base`), never floating on a slope.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Stills**

Run: `node scripts/map.js`, then `npm run render -- --real --subs 3230 --stills 2,8,14`. Look for shop fronts on houses
across town and nothing floating.

- [ ] **Step 7: Commit and push**

```bash
git commit -am "Shop fronts on the houses, the Counting House's barred counter, two guards at every tax counter (owner 2026-11-25)"
git push
```

### Task 7: Every job to its place

**Files:**
- Modify: `src/render/scene/main.js` (`workPlace`, `PLACES`), `src/render/scene/queue.js` (the `'tax'` queue carries
  coin sacks and leaves one on the counter), `src/sim/scenes.js` (`NEEDS`)
- Modify: `tests/shops.test.js`

**Interfaces:**
- Consumes: `shopOf(state, id, variant)`, `houses.shops`, the Counting House's `out.counter`.
- Produces:
  - `workPlace` returns the shop's counter for a villager with a shop (`as: 'shop'`).
  - `PLACES` gains `philosopher` and `physicist` on the University's lawn, at spots of their own clear of the scholar's
    `(6, -3)` and the librarian's `(-6, -3)`, and `adviser` and `diplomat` at the Town Hall's steps.

- [ ] **Step 1: Write the failing test**

`tests/shops.test.js`, `the tax queue brings coin sacks`: `buildQueue('tax', ...)` (`queue.js`) gives every taxpayer a
mesh named `coinSack` in a hand.

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test tests/shops.test.js`
Expected: FAIL.

- [ ] **Step 3: Route the jobs**

- Shop jobs go to `houses.shops.get(shop.house)`, or the Counting House for tax group 0.
- The `counting` scene stands behind the counter (the collector inside, the queue in front).
- The philosopher, physicist, adviser and diplomat go to their `PLACES`, once those buildings stand.

- [ ] **Step 4: Sacks in the tax queue**

Each taxpayer carries a sack, puts it on the counter at the front of the queue, and walks off.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Stills**

Run: `npm run render -- --real --subs 3230 --gallery "carpenter,carpenter:saw,taxcollector:counting,cook:cauldron,barber,brewer:stir,philosopher,physicist,adviser,diplomat" --gallery-times 1.3,3.1`.
Look at each PNG.

- [ ] **Step 7: Commit and push**

```bash
git commit -am "Every job at its place: shop counters, the tax counter with sacks of coins, the University and the Town Hall (owner 2026-11-25)"
git push
```

### Task 8: The four new buildings

**Files:**
- Modify:
  - `src/sim/tiers.js`: `BUILDINGS` gains `stables` (2 days), `schoolhouse` (2), `observatory` (3), `tannery` (2);
    `COMMISSIONS` gets all four.
  - `src/sim/world.js`: after the `court` lot, `placeStreetLot` for `stables` (7, 5), `schoolhouse` (6, 5) and
    `observatory` (4, 4), each `virtual` and `clearTrees`; then a new `placeRiverLot(w, 'tannery', 5, 4)`.
  - `src/render/scene/buildings.js`: four builders.
  - `src/render/scene/main.js`: `PLACES` for stablehand, teacher, astronomer and tanner.
  - `src/sim/simulate.js`: a goal's buildings queue before commissions.
- Modify: `tests/world.test.js`, `tests/sim.test.js`

**Interfaces:**
- Produces:
  - `placeRiverLot(w, id, hw, hd)`: the free spot nearest the market whose centre is RIVER_HALF_WIDTH + 4..14 m from the
    river, fronting a street, with the same `taken` checks as `placeStreetLot`. Front (+z) to the street.
  - Lots `w.lots.stables`, `w.lots.schoolhouse`, `w.lots.observatory`, `w.lots.tannery`.

- [ ] **Step 1: Write the failing tests**

- `tests/world.test.js`, `the new lots move nothing`:
  - every plot, fine plot, dense plot and existing lot of `world(seed)` is identical to a fixture snapshot taken before
    the change (write `tests/fixtures/world-lots-before.json` from the current code first, in this step);
  - the four new lots exist and overlap nothing.
- `tests/world.test.js`, `the tannery is by the river`: the distance from the lot's centre to the river is between
  RIVER_HALF_WIDTH + 4 and RIVER_HALF_WIDTH + 14.
- `tests/sim.test.js`, `commissions wait behind a goal`: a state at 3249 subscribers with the four commissions queued
  that reaches 3250 begins the `dungeon` first, and at most 2 buildings begin that day.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test tests/world.test.js tests/sim.test.js`
Expected: FAIL (lots missing; the order differs).

- [ ] **Step 3: Implement the lots, the commissions and the queue order**

Also, the "Completed!" shot of each new building shows the job's first named villager at work in front of it, through
the building target in `timeline.js`, as the spec says.

- [ ] **Step 4: Implement the four builders**

- Stables: a row of stalls, horses (`horseCoat`), hay.
- Schoolhouse: a small hall, benches seen through an open door.
- Observatory: a round stone tower with an open top and an armillary.
- Tannery: vats, hides on frames, a jetty to the water.

Medieval, in the existing style.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Stills**

Run: `npm run render -- --real --subs 3230 --built stables,schoolhouse,observatory,tannery --show stables,schoolhouse --stills 3,9`
Run: `npm run render -- --real --subs 3230 --built stables,schoolhouse,observatory,tannery --gallery "stablehand,teacher,astronomer,tanner" --gallery-times 1.3,3.1`
Look at each PNG.

- [ ] **Step 7: Commit and push**

```bash
git commit -am "Stables, Schoolhouse, Observatory and Tannery, commissioned; their jobs work there (owner 2026-11-25)"
git push
```

### Task 9: Docs and the stills for the owner

**Files:**
- Modify: `docs/FEATURES.md` (work scenes, buildings, a new "Shops" section with the table and the rule), `CLAUDE.md`
  (the map: `shops.js`, `shopfronts.js`, `clipcheck.js`)
- Create: `output/owner-1201/` (not committed): the stills

- [ ] **Step 1: Write the docs**

Record the owner's decisions of 2026-11-25 as in the spec.

- [ ] **Step 2: Stills for the owner's return**

- the gallery of every job with the new rig, one still in a pause;
- each new building;
- one shop front of each kind;
- the tax counter with its guards;
- `--stills 2,8,14,20,26` of a real day.

Put them all in `output/owner-1201/` and send them to the owner with `SendUserFile`.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit and push**

```bash
git commit -am "FEATURES: the new rig, the shops, the new buildings (owner 2026-11-25)"
git push
```
