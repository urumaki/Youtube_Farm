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
- `npm test` — must stay green (node:test, ~60 tests).
- `npm run render -- --subs 118 --from 72 [--names "A,B"] [--stills 4,15,24]` — test render, never
  touches `state/`. `--names` fakes commenters. `--real` starts from the real `state/` (next day, read
  only) instead of a fresh two-day test kingdom: needed to test anything that exists only later (tavern).
- `npm run daily -- --dry-run --subs 80` — simulate the next real day without saving (no video).
- `node scripts/preview-day.js 1600 [date]` — render the next real day (real comments since the last saved day, the given
  subscribers) to `output/<date>_en_preview_<subs>.mp4`, read only: nothing saved, nothing published.
- `node scripts/verify-video.js output/x.mp4` — format checks.
- `node scripts/map.js` — map of the town from above (`output/map.png`): houses by storeys, free plots,
  fields, the Second Wall with gates, buildings standing / going up / still to come with their goal.
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
  Untrusted input (owner 2026-10-23): comment text goes only through `plainText` (2000 chars, no control or
  zero-width characters) and fixed regexes; author ids and times are checked for their shape (`comments.js`);
  a name is cleaned to letters, digits, space and . _ - and dropped if it reads like code or a prompt
  (`looksLikeCode`) or is offensive. Bad words: `src/sim/badwords.js`, generated from the LDNOOBW lists
  (CC BY 4.0, six languages) minus real names and harmless words; whole words, phrases and long roots.
  Nothing from a comment is ever run, given to a shell, or sent to a language model.
- `src/render/scene/` Three.js scene rendered frame by frame in headless Chromium (`capture.js`).
  Shot plan in `timeline.js`. Days with named villagers (owner's choice, 2026-10-19): the video opens on the
  caravan of today's named villagers with name tags (`caravan.js`, no castle hook; the counter shows over it
  for 2 s; owner 2026-10-23: smaller tags at three heights, and those that would overlap take turns
  through the shot, so every newcomer's name and job shows for a while, `overlay.js`; they walk three abreast, up to 60, the rest
  ride in the wagons) → up to 2 new buildings, ~2.5 s each → 3 named villagers at work (`work.js`) → wide shot with
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
  torches, thunderstorm over the square (only on grey days; the day turns to rain). Picked by the owner
  2026-10-20: the King (the owner) rides through town in an open carriage while the crowd cheers (`royal.js`),
  a pig loose in the square chased by the farmer (`pig.js`), an archery contest with a winner's rosette
  (`archery.js`), the river flooding with a sandbag wall on rainy days (`flood.js`), New Year's Eve
  countdown round the bonfire on 31/12 (`newyear.js`; the big title changes over time via `bannerAt`).
  Owner: medieval only, nothing magic
  (no wizards, witches, spells; the alchemist became the Apothecary, "speziale"). Tone rule (owner): named villagers are heroes or comic, never
  villains or victims; nobody gets hurt. Test one with `npm run render -- --real --subs N --story bandits`.
- Owner rules 2026-10-21: (1) a commenter who writes they could not find themselves in the last short
  ("can't see myself", "my name wasn't there", "non mi vedo"; `complainsFromText` in `requests.js`) gets
  `complainDay` and comes first in the next video (`featured.js`). (2) Dropped 2026-10-22 (owner): there was no
  story event on days with 15 or more new commenters; now a story can happen on any day. (3) No scene
  again within 3 days (`src/sim/scenes.js`, `state.sceneLog`): the simulation now picks the tavern yes/no,
  each villager's scene variant and the everyday shot, and saves them as `diff.scenes` (the renderer uses
  them; older saves still pick in `timeline.js`). (4) Stories over several quiet days (`steps`, one a day,
  `state.storyArc` waits for the next quiet day): merchants arrive / dance round a fire at night with named
  villagers (`camp.js`) / leave with named villagers waving; the King arrives / holds a feast in the square
  (`feast.js`) / rides home; archery heats / final; flood rises / recedes ("the wall held"); quarrel / peace.
  Test a step with `--story merchants:camp`. `node scripts/replan-day.js <day> [--save]` plans a saved day
  again with the current rules (used for 2026-10-21, whose short the owner took down).
- Second Wall (owner 2026-10-21: never over houses, may leave houses outside, must reach the river): its
  route is planned on the day it begins (`src/sim/wall.js`, saved as `state.wall2.pts`): a zigzag line on
  rays from the town centre, chosen to miss houses, lots and fields, from the west bank round the north and
  east to the south bank (the river closes the rest), a tower at every corner, gates where roads cross,
  square to the road (owner 2026-10-21; the wall turns into the gate towers; roads are drawn up to the
  gates, `terrain.js`). Houses in its way move to the next free plot, checked every day so a change to
  `wallLayout` moves them too (`ensureWall2`, `diff.housesMoved`); new houses skip plots on it
  (`nextFreePlot`, `state.nextPlot`).
  Never over a field or a building lot either (owner 2026-10-22: it crossed two wheat fields and then the
  quarry): the route may go far out (up to 2x the first plan) round them, and a saved route that crosses one
  is planned again once (`crossesFields`, `ensureWall2`).
  It goes up in stretches from the gate nearest the market, over low foundations along the whole route.
  `w.wall2` (the old ellipse) still only shapes the plot list, so plot ids and positions stay stable.
- Taller houses (owner 2026-10-22): once the Second Wall is begun, a newcomer with no free bed first makes
  the lowest house inside the walls one storey taller (`raiseHouse` in `simulate.js`, `insideWall2` in
  `wall.js`; up to 3 storeys, +2 beds each; `h.floors`, `h.cap0` = capacity as built, `diff.housesRaised`);
  new plots (outside the walls) only when every house inside has 3 storeys. `houseFloors` gives a house's
  storeys for the simulation and the renderer. The video shows one raised house: the scaffold goes up and
  the new top storey rises under its roof (`buildAnimatedHouse(..., { raised })`; the top storey is its own
  layer, `top`, in `houseKit.js`), with the narrator line `raised`. No gardens behind the houses (owner
  2026-10-22): no vegetable beds, sheds, carts or wattle fences; only a woodpile and barrels beside them.
- Guards on the walls (owner 2026-10-21, `wallwatch.js`): day watch (walks, stops, looks out), night watch
  by a brazier at dusk, changing of the guard (march up, salute, the old guard leaves), on the castle walls
  (guard variants `walls`, `wallnight`, `change`) and on the Second Wall once finished (`wall2`,
  `wall2night`, `wall2change`; `sceneReady` in `scenes.js`). About 40% of the guards up there carry a bow
  and quiver instead of the spear. The everyday guard shots are patrol, sparring or the changing of the
  guard. The castle's background guards (`life.js`) are hidden during these shots. Test with
  `--real --gallery "guard:change,guard:wall2night"` (the Second Wall ones need a state where it is done).
- Terraced houses and dense plots (owner 2026-10-23): inside the Second Wall every house fills its plot's frontage
  and the gap to the next, square to the street with its front on one line (`streetLine` in `houses.js`), so
  the streets read as rows. New houses take the dense plots (`w.densePlots`, ids from `DENSE_ID`, narrow
  5-7 m frontages close together, laid out after everything else; `s.plotsV` 2, `s.nextDense`), passing over any
  plot a standing house covers, so houses already built never move and more fit on each street (at 1300
  subscribers, 47 of the new houses stand inside the walls). The old plot list (`w.plots`) stays for them.
- More house looks (owner 2026-10-23, `houseKit.js`): of the timber-framed houses, 3 in 10 turn their gable to the
  street (`gabled`), 2 in 10 have a shop on the ground floor with a counter of goods and a red or blue awning
  (`shop`), 1 in 10 are red brick with crow-stepped gables front and back (`brick`, material `brick`); picked by
  plot id in `houseShape` (`houses.js`).
- Training yard (owner 2026-10-23, `castle.js`): a sanded square in the castle courtyard between the well and
  the barracks, with a rail fence, two straw dummies, a rack of spears and two shields. The guards' and knights'
  straw dummy drill (variant `dummy`) now happens there instead of in their croft (`castle.training`,
  `workPlace` in `main.js`); the sparring shot is right beside it.
- Woodcutter (owner 2026-10-21): only the arm holding the axe moves (one-handed overhead chop, the body
  and the other arm stay still); the handcart scene is no longer picked.
- Wheat fields (owner 2026-10-22, `buildWheat` in `ambient.js`, everyday shot `wheat`): many farmers in one
  field. July to November the harvest (three reapers with scythes at the edge of the ripe wheat, two
  binding sheaves, one loading a cart, stooks), March to June hoeing and sowing in the young green wheat.
  Test with `--gallery ambient:wheat` (add `--date 2026-04-15` for spring).
- Who is shown at work (`src/sim/featured.js`, owner 2026-10-20): picked by the simulation and saved as
  `state.featured`: villagers named today first (the narrator welcomes only jobs on screen), then granted
  requests, never a job the previous video showed (`diff.avoidJobs`), one per job. Saves without
  `featured` use the old rule to know what the previous video showed.
- `npm run render -- --day 2026-10-20` renders a saved day again with today's code (read only,
  `output/<day>_<lang>_again.mp4`). Replacing a published video is the owner's call:
  `node scripts/republish-day.js <day>` uploads the re-render (old id kept under `replaced` in
  `state/published.json`; the old video is left as it is). Day 2026-10-21 was replaced (FtbcqR75UUc, then uploaded again as aUlKLkUDX88 at the owner's request).
- Everyday shots (`ambient.js`, `everyday.js`, owner 2026-10-20): when the update has room, guards
  (odd days, and in winter: patrolling the castle wall walk or sparring in the courtyard), else one of
  farmers hoeing in the field nearest the castle, a shepherd with the flock on the grass beyond the fields,
  or washing day at the river; never a job already shown yesterday or today; a named guard, farmer or
  peasant not shown elsewhere gets the name tag. Test one with `--gallery ambient:pasture`.
  They also introduce new villagers (owner 2026-10-23, `INTRO`/`introVariant` in `scenes.js`): a villager named today
  whose job has an everyday shot is shown in it with the big name label, alone (no visit, `intro` in `pickFeatured`):
  a new guard comes on duty at the changing of the guard (on the Second Wall once it stands), a knight spars, a farmer
  works in the wheat or the fields with the others, a peasant at the washing by the river, a shepherd with the flock.
  Not in winter for the land ones, not a scene shown in the last 3 days. They are also ordinary scenes of those jobs
  (`fields`, `wheat`, `laundry`, `pasture` in `VARIANTS`, away scenes drawn by `ambientScene` via `awayScene`).
- Villager shots vary (owner 2026-10-20): every common job has 2-3 scenes, one picked per villager and day
  (`VARIANTS` in `timeline.js`; `'job:variant'` entries in `JOB_SCENES`, `work.js`): guards on the walls,
  sparring or at the straw dummy (`drills.js`); farmers hoeing, sowing or reaping; the smith at the anvil,
  quenching or at the bellows; the fletcher shooting at a target... The croft shots cut in hard and move
  the camera a different way each time (`CAM_STYLES`). Name labels pop in. Bakers never work in the
  open (owner 2026-10-20): a bakehouse stands in their croft (`bakery.js`), with the oven beside them,
  the peel, its own wide-lens camera and a hard cut in and out like the tavern; guests walk in by the door.
  The beggar sits against the back wall of his house swigging from a bottle, or lies asleep by it snoring
  (Z sprites), or stands by a crate with a mug (`home`/`homeTurn` in `JOB_SCENES` place a scene by the house).
  Bards strum a lute on a stool (and one always plays in the tavern); woodcutters also load a handcart.
  Scenes away from the croft (`AWAY_VARIANTS`, own camera, hard cut): guards on the walls, sparring, or on
  the night watch with a lantern at dusk; fishermen always on the river (owner 2026-10-22): in a rowing boat,
  or on a plank jetty at the bank near their house casting a rod or throwing a round net and hauling it in
  (`buildRiverbank` in `away.js`). The fisherman is never a visit host (`VISIT_HOSTS`): he is not at home;
  a guest planned on older saved days stands on the jetty with him and cheers at the catch.
- Paved streets (owner 2026-10-22): every street, lane and track inside the Second Wall is cobbled, the
  roads outside stay dirt. `buildOverlay` (`terrain.js`) draws a mask of the paved stretches and the terrain
  shader puts a tiled cobble texture there in world space (the overlay is about a pixel a metre).
- Ships in the harbor and boats at the dock (owner 2026-10-22, `ship` in `life.js`): a lofted hull (pointed
  bow, sheer rising to both ends, planks and a dark wale, tarred below the waterline), a deck, stem and stern
  posts; ships get a rudder, a bellied square sail on a yard, a bowsprit and, when big, castles fore and aft.
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
  Added 2026-10-22: 1250 Tailor + Tailor's Stall, 1500 Physician (moved from 2500) + Physician's Booth
  (both on the market square, work scenes `sewing` and `remedies`). The Noble at 10,000 became the Tax
  Collector (no noble titles as jobs; comments asking for lord, landlord, noble, duke or baron get it).
  Jobs folded together (owner 2026-10-22, `MERGED` in `tiers.js`): Warrior into Guard, Sailor into
  Fisherman, Toolsmith into Blacksmith, Town Weirdo into Jester. The tier weights are unchanged (so no other
  villager changes job); `jobFor`, `migrate` (names, requests waiting) and the comment keywords map them.
  Also added 2026-10-22, each with a work scene: 850 Potter + Potter's Stall, 1750 Cobbler + Cobbler's
  Stall (market square), 2000 Cooper + Cooperage (East Ward square), 3000 Beekeeper + Beehives (corner of
  a field west of the castle), 4000 Bell Founder + Bell Foundry (North Ward square), 7500 Clockmaker +
  Clock Tower (South Ward square). The Great Bridge (owner 2026-10-23: at 10,000 with the Royal Palace, was
  250,000) crosses the river where the Noble Quarter's avenue ends, so a road can run on to it. The Royal Palace
  stands on the free ground beside the University (`placePalace` in `world.js`, after the plots; its first lot in
  the east stays reserved so the streets there do not move).
- University and Noble Quarter (owner 2026-10-22): the open ground below the castle (between it and the
  river) is kept for them. The University is the 1000 goal (moved from 5000, which is now the South Ward)
  with its scholars (work scene `desk`: writing in a book at a sloped desk): a quadrangle with a cloister,
  a chapel with a spire and a gatehouse on the lane from the avenue. The Noble Quarter: an avenue from the
  castle approach southwards with cross streets (`buildNobleQuarter` in `world.js`, laid out after the
  plots so plot ids never move; `w.finePlots`, ids from 100000). From the day the University is begun,
  newcomers who are merchants, knights, scholars, physicians, the mayor, reeve, bishop and the like live
  there (`FINE_JOBS` in `simulate.js`, `s.nextFine`), 8 to a house, and nobody else does. Their houses
  (`arch: 'fine'` in `houseKit.js`): a stone ground floor with a carved doorway, timber-framed upper floors
  oversailing the street, an oriel window, two chimneys and two dormers, three storeys. The river closes the
  town where the Second Wall does not run, so `insideWall2(..., w)` counts that ground as inside (paved
  streets, taller houses). Check views with `node scripts/viewer.js` (`window.__controls` moves the camera). The beehives
  and the bridge are virtual lots added after the plots (`world.js`), so plots never move. Jobs only by
  request: Rat Catcher, Chimney Sweep, Falconer, Cook, and (owner 2026-10-23, from the comments of 2026-10-22)
  Hunter (shoots at a straw deer, no animal hurt), Butcher (cleaver, ham, sausages), Engineer (hammers a model
  trebuchet that throws a turnip; unlocked at 2500 in place of the Weaver, before that asking makes an apprentice), Shepherd (crook, sheep grazing in the croft), Tanner (scrapes a hide on the
  beam). The same day more comment words were added for jobs the kingdom has (typos like "gaurd", weaponsmith,
  pub, harbour, herbalist, messenger, bishop, politician/lawyer for the reeve, architect for the mason...), and a
  name asked for ("call me Hunter") is never read as a job request.
- Buildings begin only when the video can show them (owner 2026-10-23): at most 2 a day once villagers have
  names (3 before), as `timeline.js` shows them (`SHOWN_STARTS` in `simulate.js`); the others wait in
  `s.buildQueue` (in tier order, commissions last) and begin on the next days (`diff.buildingsWaiting`). The
  fields, the wall guard and the charter stone have no shot and take no room.
- Jobs folded together again (owner 2026-10-23, `MERGED`): the Mayor and the Reeve into the Tax Collector (so tax
  collectors come from 250, the Reeve's tier; apprentices waiting for the job were promoted), the Weaver into the Tailor,
  the Chronicler into the Scholar, the Admiral into the Sailor (so the Fisherman). Comment words follow; `availableJobs`
  and `tierOfJob` map through `mergedJob`.
- Own places instead of the croft (owner 2026-10-23), variants that need a building (`NEEDS` in `scenes.js`, else the job's
  usual croft scene): merchants behind one of the market stalls weighing goods on a balance for a haggling customer
  (`merchant:stall`); the tax collector at a table by the door of the Counting House with a queue of taxpayers holding
  their purses (`taxcollector:counting`); the apothecary at the Apothecary's Shop with a queue of the sick and the lame
  (crutches, a bandaged head, an arm in a sling, a cough; `apothecary:shop`). The queues are `queue.js` (`queue` in the
  scene config); `workPlace` in `main.js` gives the place and the way the worker faces. The Counting House (tier 250,
  with the first tax collector) and the Apothecary's Shop (tier 5000) are workshops on free ground by a street near the
  market (`placeStreetLot` in `world.js`, after the dense plots so nothing moves). A building added later to a tier the
  kingdom already reached is queued like a new one (the Counting House on the real kingdom). Test with
  `npm run render -- --real --subs 775 --built counting_house,apothecary_shop --gallery "merchant:stall,taxcollector:counting,apothecary:shop"`
  (`--built` makes buildings stand finished in a test render).
  More of them (owner 2026-10-23, `PLACES` in `main.js`): once their building stands, every scene of the job happens in
  front of it with the croft scene's props (visits too): the smith in the forge's yard under the awning, the woodcutter by
  the sawmill's log pile, the mason on the quarry floor, the miller at the windmill door, the executioner chopping cabbages
  at the foot of the pillory (the camera on the market square); farmers work in one of the odd fields (no hay bales there),
  standing on the crop (`atField`). The crier rings his bell up on the Crier's Stand (`crier:stand`, no visit: a host with a
  guest stays in the croft, `SOLO_VARIANTS`). Innkeepers and brewers serve behind the bar inside the tavern once it is open
  (`inside`: `buildTavernInterior(..., { bar: true, guest })`, own camera and lamps, a visitor stands at the counter; never
  on a tavern day); their croft scenes are no longer picked then (`UNTIL` in `scenes.js`). Test with
  `npm run render -- --real --subs 1400 --gallery "blacksmith:anvil,woodcutter:chop,stonemason:block,miller:sacks,farmer:hoe,executioner,crier:stand,innkeeper:inside+fisherman"`.
  And (owner 2026-10-23, same day): the carpenter hauls a handcart of planks and logs through his croft (`carpenter:cart`,
  `haul`, walks across the shot); the bard plays a pipe in the market square for two listeners, a hat for coins at his feet
  (`bard:square`), or the lute in the tavern's corner (`bard:inn`, `buildTavernInterior(..., { minstrel })`, own camera); the
  jester juggles three burning torches in the square (`jester:square`, `torches`); the rat catcher chases rats in an alley
  between two houses near his own (`alleyBy` in `main.js`: beside a house, clear front to back, the next house 1.5-3 m away;
  the camera looks down it from the street, `cam` from `workPlace`); the chimney sweep sweeps the flue from a big fireplace
  inside a house (`chimneysweep:house`, `room.js`: a room at his croft seen only during the shot, like the bakehouse); the
  cook ladles stew and holds out a bowl at a market stall (`cook:stall`), the butcher chops under hanging hams at one
  (`butcher:stall`; two stall scenes in one video never share a stall, `stallOf`); the hunter shoots at a boar or a stag in a
  clearing outside the Second Wall (`hunter:boar`/`stag`, `huntSpot` in `wall.js`: out from the wall's northernmost corner past
  every plot, lot, field and road; no trees there, `nature.js`); the arrow lands short and the animal bolts (`once`: one
  shot per scene, from the shot's start); the falconer in the same clearing, his falcon flying a low loop in front of him and back to the glove, always in the
  picture (`falconer:meadow`, own side camera, one flight from the shot's start); the shepherd at the gate of a sheep pen on the grass beyond the fields
  (`shepherd:pen`); the tanner with a long rack of hides drying behind him; the engineer checks a plan on a parchment in front
  of a building going up (`engineer:site`, only while something other than the wall is under construction). Every jester
  wears a jester's cap and every chimney sweep has a face black with soot, in every scene (`dress` in `work.js`, by the
  job's own tunic colour). Test with `--gallery "carpenter:cart,bard:square,bard:inn,jester:square,ratcatcher:alley,chimneysweep:house,cook:stall,butcher:stall,hunter:boar,shepherd:pen,tanner,engineer:site"`.
- Fixes of 2026-10-23 (owner, after the day's re-render): roofs are closed underneath (`gableGeo` has a bottom face; seen
  from below the eaves the forge's roof looked as if it floated) and the forge's awning is a slate lean-to on a beam and two
  posts; neighbouring houses that ran into each other give up half the overlap (`fitNeighbours` in `houses.js`: side walls
  stand 0.3 m apart, more beside a gable turned to the street, whose eaves are on the sides); the raised house's shot looks
  at it square from high over the street (`pose` in `timeline.js`); more narrator lines about buildings and houses, never
  the same one twice in a video (`fresh` in `narration.js`), and every line fits its shot (owner, same day: with the new
  lines the voice ran 2 s late over the shots): `fitShots` estimates how long each line takes (`spokenLength`), takes a
  shorter variant of a line that would run past its shot (each template list has short ones: "Up goes the Potter's
  Stall!"), drops a line that would still run into the next shot or whose shot another line took, then applies the word
  budget; the lines naming a job or a building take their shots first, one welcome per villager shot; the tavern seats 14 with name tags that take turns like the
  caravan's (`overlay.js`), and the one playing the lute always has a name: a named bard, else another named villager
  tagged "Bard tonight" (`musician`).
- Builders at building sites (owner 2026-10-24): every building shot (going up or completed) shows 3-5 named villagers at
  work in front of it with name tags, the big building label kept: one reads the plan, the others hammer at a bench, cut
  stone, saw, lay stones (`crewRoles` in `timeline.js`: their own trade's role first). Picked in `makePlan` (`tg.builders`):
  nobody already on screen elsewhere in the video, engineers, carpenters and masons first, then those waiting longest
  (`state.lastShown`). Placed in `main.js` (`crews`) on the line from the camera to the building, low in the narrow frame,
  stepping out of the building toward the camera (squares are open paving). Spots in front of a lot are on the ground under
  them (`floorOf`: a foundation's top, a square's sloping side, else the terrain): before 2026-10-24 `atLot` put the
  woodcutter by the sawmill and his visitor 0.25 m up in the air.
- Second scenes and own places (owner 2026-10-25, for the jobs that had one scene, `work.js`, `scenes.js`, `main.js`): the tax
  collector goes door to door with his tally, a householder holding out a purse in a doorway (`taxcollector:rounds`, a house
  front turned halfway to the camera, props `doorstep`); the merchant loads sacks from a stack onto a cart (`merchant:cart`);
  the physician works at the Physician's Booth with a queue of the sick once it stands (`physician:booth`); the executioner
  sharpens his axe on a grindstone at the pillory (`executioner:grind`, sparks); the jester juggles for two children
  (`jester:kids`); the crier reads a proclamation to a small crowd in the market square (`crier:proclaim`); priests and
  bishops (red stole; the bishop a mitre, `dress`) bless a field with holy water (`priest:bless`, needs the fields), preach
  to a crowd in the square (`priest:preach`) or pray at a wayside cross by the house (`shrine`); `bishop:*` uses the
  priest's scenes. Listeners and children stand on the side away from the camera (`crowd`, `kids`). The potter, the tailor
  and the cobbler work in front of their stalls on the market square, the scholar on the University's lawn, the cooper,
  the bell founder and the clockmaker in front of their workshops (`PLACES`), once those stand. Test with
  `npm run render -- --real --subs 1900 --built physician_booth,tailor_stall,university,cobbler_stall --gallery "taxcollector:rounds,merchant:cart,physician:booth,executioner:grind,jester:kids,crier:proclaim,priest:bless,priest:preach,priest,bishop:preach,potter,tailor,scholar,cobbler"`.
- Church interior (owner 2026-10-23, `church.js`): the Chapel, or the Cathedral once built, with pews both sides of a red
  carpet, villagers praying on them (hands together, heads bowed), stained glass, candles, the priest blessing from behind
  the altar (in the Cathedral always a bishop with mitre and crozier; another named cleric reads at the lectern). The
  newest named villagers sit in the front pews with small name tags that take turns, as in the caravan (12 in the
  Chapel, 16 in the Cathedral). It closes the "at work" part like the tavern (two villager shots), never on a tavern day
  and not again within 3 days (`churchToday` in `scenes.js`, `diff.scenes.church`); on that day priests and bishops are
  only shown there (`pickFeatured`); on the other days they are out at work (below). The building's outside is hidden while the camera is in (the
  Cathedral's transept and aisles are solid boxes across the nave). Test with `npm run render -- --real --subs 775 --church
  [--built cathedral] --stills 19,21,23`.
- Commissions (owner 2026-10-23): buildings with no goal, begun on the next day the kingdom runs, whatever its
  size (`COMMISSIONS` in `tiers.js`, saved with tier `commission`). The first is the Fletcher's Workshop: a
  thatched timber workshop with bows on the wall, a fletching bench under a lean-to, a barrel of arrows, staves
  drying and a straw target (`fletcher_workshop` in `buildings.js`, one day to build), on the free ground nearest the market
  that fronts a street (`placeFletcherWorkshop` in `world.js`, after the plots, so nothing moves).
  Once it stands, Fletchers work in its yard instead of their croft (`workPlace` in `main.js`: fletching at
  a bench, shooting at a target, visits), with the street and the camera in front.
- `src/audio/` narration templates (names are never read aloud), Kokoro TTS (`am_adam`), procedural
  music, camera-driven sound effects with strikes synced to the work animations (`sfx.js`).
  The voice follows the shots: `produceVideo` first sets the scene up once to get the shot plan
  (`sceneCues`), `sentenceAnchors` gives each sentence the start of the shot it talks about (goal at
  23.7 s, call to action at 27.1 s), and `schedule` in `tts/index.js` waits for those times but never
  so long that the rest no longer fits. With the shot plan known, `buildScript` puts the sentences in the
  order of the shots they wait for and keeps the ones with a shot of their own (day 7, 2026-10-22: the
  narrator fell silent over the raised house while a sentence waited for a later villager); a sentence about
  a building waits for that building's shot. On caravan days there is no "+N villagers" sentence.
- `src/publish/` YouTube upload (resumable, OAuth); `state/published.json` prevents double uploads.
- `.github/workflows/daily.yml` runs at 03:17 UTC (GitHub often starts it hours late);
  `voice-samples.yml` renders TTS samples on demand.

## Open ideas the owner mentioned
- Choose a less robotic free voice (Chatterbox or Edge voices; samples via the Voice samples action).
- Done: comment text picks a job and a name (`src/sim/requests.js`), end credits roll in the wide shot
  (`overlay.js`). Owner does not want royal family or noble titles (prince, princess) as jobs for now. Done: tavern interior with named patrons.
  Ideas not done: narrator jokes for refused requests ("clone me", "landlord").

## Status (2026-10-24)
- Daily upload works (first videos 74VLgbuvzGU, YQjmBQNZlo4, 2mydn7mgvjU; 2026-10-23 is bb3qhk45GRw). Day 8 (2026-10-23):
  1350 subscribers, 371 named villagers, ~150 new commenters a day.
- More story events the owner may pick: wedding, tournament, villager leaving with a bundle on unsubscribe, Christmas, New Year fireworks.
- Voice still `am_adam`; owner may switch after listening to the Voice samples action.
- Owner pinned (or will pin) a comment: "call me <name>" + a job, "watch the end credits".
