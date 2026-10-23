// The 30-second shot plan, computed from the day's diff. evaluate(t) gives camera pose, light phase,
// construction progress, visible labels and overlay state. Pure function of (plan, t).
import * as THREE from 'three';
import { BUILDINGS, JOBS, tavernScene } from '../../sim/tiers.js';
import { CASTLE } from '../../sim/world.js';
import { NIGHT_STORIES, storyCue } from './stories/index.js';
import { pickFeatured } from '../../sim/featured.js';
import { rand01 } from '../../sim/prng.js';
import { BAKEHOUSE_VARIANTS } from './bakery.js';
import { VARIANTS, AWAY_VARIANTS, NIGHT_VARIANTS, pickVariant, sceneReady } from '../../sim/scenes.js';

export const DURATION = 30;
// the wide shot with the goal and the end credits is short (3.5 s) so the daily update keeps the time
const HOOK = 2, UPDATE_END = 23.5, WIDE_END = 27;
const CARAVAN_SECONDS = 4.5, STORY_SECONDS = 4.5;
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// the scenes of each job and the ones away from the croft live in the simulation, which picks the day's
// scenes (src/sim/scenes.js); older saves without `diff.scenes` pick them here
export { VARIANTS, AWAY_VARIANTS, pickVariant };
// scenes inside a building (the baker's bakehouse, bakery.js): own camera, a hard cut in and out
export const indoorScene = (job, variant) => job === 'baker' && BAKEHOUSE_VARIANTS.has(variant);
// the croft shots move the camera in different ways, never the same way twice in a row
export const CAM_STYLES = ['push', 'reveal', 'orbit', 'low'];

export function makePlan({ state, diff, houses, animated, buildings, castle, maxTargets = 7 }) {
  const targets = [];
  const addedByHouse = new Map();
  for (const a of diff.added) if (!addedByHouse.has(a.house)) addedByHouse.set(a.house, a);
  const jobLabel = (j) => JOBS[j]?.label || j;
  // Days with named villagers follow the owner's order: the caravan opens the video (no castle hook),
  // then a few seconds of new buildings, then the named villagers at work. New houses are not shown
  // one by one on those days (they still appear finished in the town and in the wide shot).
  const people = (diff.named || []).length > 0 || Object.keys(state.names || {}).length > 0;
  const maxBuildings = people ? 2 : 3;
  // 1) buildings unlocked or finished today: a new building is the day's headline
  for (const id of [...diff.buildingsStarted, ...diff.buildingsCompleted]) {
    const it = buildings.items[id];
    if (!it || targets.some((t) => t.id === id) || targets.length >= maxBuildings) continue;
    const SMALL = ['crier_stand', 'pillory', 'tailor_stall', 'physician_booth', 'potter_stall', 'cobbler_stall', 'apiary'];
    const big = ['cathedral', 'palace', 'tournament', 'harbor', 'wall2', 'university', 'colossus', 'townhall', 'stone_bridge'].includes(id);
    targets.push({
      kind: 'building', id, pos: it.focus.clone(), radius: big ? 70 : SMALL.includes(id) ? 13 : 30, front: (it.lot?.rot ?? 0) + Math.PI / 2,
      label: { title: BUILDINGS[id].label.replace(/^the /, 'The '), sub: diff.buildingsCompleted.includes(id) ? 'Completed!' : 'Construction begins' },
      completed: diff.buildingsCompleted.includes(id),
      weight: people ? 0.9 : 1, // "a few seconds" each when the caravan and the workers share the video
    });
  }
  // houses inside the Second Wall that got another storey today (owner 2026-10-22): one shot of the new
  // storey going up under its roof
  const raised = (diff.housesRaised || []).filter((id) => animated.get(id)?.raised);
  if (raised.length) {
    const id = raised[0], a = animated.get(id), n = diff.housesRaised.length;
    targets.push({
      kind: 'house', id, raised: true, pos: a.mid.clone(), labelPos: a.top.clone(), radius: 22, front: a.shape.rot + (a.shape.side > 0 ? -Math.PI / 2 : Math.PI / 2),
      label: { title: 'Building upward', sub: n === 1 ? 'A house gets a new storey' : `${n} houses get a new storey` }, extra: 0, weight: people ? 0.9 : 1,
    });
  }
  // 2) the caravan of villagers named today, then a few named villagers at work
  const today = diff.named || [];
  if (today.length) targets.unshift({ kind: 'caravan', id: 'caravan', pos: new THREE.Vector3(), radius: 14, front: 0, label: null, labels: [], weight: 2.8, count: today.length });
  // the day's story event (bandits, a quarrel, merchants, Halloween...) comes right after the caravan
  if (diff.story) {
    const night = NIGHT_STORIES.has(diff.story.id);
    targets.splice(today.length ? 1 : 0, 0, {
      kind: 'event', id: storyCue(diff.story), story: diff.story, pos: (buildings.items.market || buildings.items.well)?.focus.clone() ?? castle.keep.clone(),
      // a hard cut in and out ("meanwhile..."): no high flight over the town, and dusk scenes change the light
      radius: 12, front: 0, label: null, labels: [], weight: 2, cut: true, phase: night ? 1 : undefined,
    });
  }
  const INTEREST = ['blacksmith', 'toolsmith', 'woodcutter', 'baker', 'stonemason', 'fisherman', 'carpenter', 'miller', 'guard', 'knight', 'farmer', 'peasant'];
  // requests granted today come first ("you asked, the Lord granted"), then the newest names
  const asked = (n) => (n.requestDay === state.day ? 1 : 0);
  const named = Object.entries(state.names || {}).map(([id, n]) => ({ id: Number(id), ...n, job: state.villagers[Number(id)]?.job }))
    .filter((n) => n.id < state.villagers.length)
    .sort((a, b) => asked(b) - asked(a) || (b.day ?? 0) - (a.day ?? 0) || (INTEREST.indexOf(a.job) + 1 || 99) - (INTEREST.indexOf(b.job) + 1 || 99) || a.id - b.id);
  // the tavern interior closes the "at work" part when the tavern stands: named innkeepers and brewers
  // serve behind the bar, other named villagers drink at the tables
  // (not within three days of the last time: diff.scenes, src/sim/scenes.js)
  const scenes = diff.scenes || null;
  const tavern = people && named.length > 0 && buildings.items.tavern && (scenes ? scenes.tavern : tavernScene(state));
  const keepers = tavern ? named.filter((n) => n.job === 'innkeeper' || n.job === 'brewer').slice(0, 2) : [];
  // or the church interior (owner 2026-10-23): named villagers praying in the pews, the priest or bishop at the altar
  const church = people && named.length > 0 && scenes?.church && buildings.items[scenes.church] ? scenes.church : null;
  const clergy = church ? named.filter((n) => n.job === 'priest' || n.job === 'bishop').sort((a, b) => (b.job === (church === 'cathedral' ? 'bishop' : 'priest')) - (a.job === (church === 'cathedral' ? 'bishop' : 'priest'))).slice(0, 2) : [];
  // who is shown at work comes from the simulation (src/sim/featured.js): today's named villagers first,
  // never yesterday's jobs again, one per job; older saves fall back to the same rule without yesterday
  // a shot can show two villagers: the guest visits the host at work (src/render/scene/visit.js)
  const featured = diff.featured || pickFeatured(state);
  const shots = featured.map((f) => ({ f, n: named.find((n) => n.id === f.id), g: f.with ? named.find((n) => n.id === f.with.id) : null }))
    .filter(({ n }) => n && !keepers.includes(n) && !clergy.includes(n))
    .slice(0, tavern || church ? 2 : people ? 3 : Math.min(3, Math.max(2, maxTargets - targets.length - 2)));
  const atWork = shots.flatMap(({ n, g }) => (g ? [n, g] : [n])); // everyone on screen at work
  const camFrom = Math.floor(rand01(state.seed, 'camstyle', state.day) * CAM_STYLES.length);
  const usedVariants = new Set();
  let crofts = 0;
  const jobSub = (n) => (n.job === 'apprentice' && n.wants ? `Apprentice ${jobLabel(n.wants)}` : jobLabel(n.job));
  for (const { f, n, g } of shots) {
    const apprentice = n.job === 'apprentice' && n.wants;
    const sceneJob = apprentice ? n.wants : n.job;
    // a host with a guest stays at home (the castle scenes have no croft to walk into)
    const variant = scenes && n.id in scenes.variants ? scenes.variants[n.id] : pickVariant(sceneJob, state.seed, state.day, n.id, usedVariants, { croft: !!g, ready: (v) => sceneReady(state, v) });
    if (variant) usedVariants.add(variant);
    const castleShot = AWAY_VARIANTS.has(variant);
    const indoor = indoorScene(sceneJob, variant);
    targets.push({
      kind: 'villager', id: n.id, job: n.job, sceneJob, variant, pos: new THREE.Vector3(), labelPos: new THREE.Vector3(), radius: 6.8, front: 0,
      // a hard cut into each villager (a flight down into a croft only shows roofs and grass)
      label: { title: n.name, sub: jobSub(n) }, work: null, weight: g ? 1.45 : 1.1, cut: castleShot || indoor, cutIn: true, interior: indoor, phase: NIGHT_VARIANTS.has(variant) ? 1 : undefined,
      camStyle: castleShot || indoor ? null : CAM_STYLES[(camFrom + crofts++) % CAM_STYLES.length],
      ...(g ? { pair: f.pair, guest: { id: g.id, name: g.name, job: g.job }, label2: { title: g.name, sub: jobSub(g) }, labelPos2: new THREE.Vector3() } : {}),
    });
  }
  // an everyday shot when there is time for it: a guard patrolling the castle walls or farmers hoeing
  // (not in winter); a named guard or farmer not shown elsewhere gets the name tag
  const month = Number(state.date.slice(5, 7)), winter = month === 12 || month <= 2;
  const flexible = targets.filter((t) => t.kind !== 'caravan' && t.kind !== 'event').length;
  let ambient = null;
  if (scenes) {
    ambient = scenes.ambient && makeAmbient(scenes.ambient);
  } else if (people && flexible <= (tavern ? 3 : 4)) {
    // not a job the previous video or today's workers already showed (diff.avoidJobs: yesterday's jobs)
    const seen = new Set([...(diff.avoidJobs || []), ...atWork.map((n) => n.job), ...atWork.map((n) => n.wants).filter(Boolean)]);
    const wallsOk = state.unlockedTiers.includes('guard') && !['guard', 'knight', 'warrior'].some((j) => seen.has(j));
    const fieldsOk = !winter && !seen.has('farmer') && !seen.has('peasant');
    // the guards either walk the walls or spar in the courtyard; on the other days, life around town:
    // farmers in the fields, a shepherd with the flock, washing day at the river
    const guards = rand01(state.seed, 'ambient', state.day) < 0.5 ? 'patrol' : 'sparring';
    const country = [fieldsOk && 'fields', !winter && !seen.has('peasant') && 'pasture', !seen.has('peasant') && 'laundry'].filter(Boolean);
    const life = country[Math.floor(rand01(state.seed, 'country', state.day) * country.length)];
    const id = wallsOk && (state.day % 2 === 1 || !life) ? guards : life || null;
    ambient = id && makeAmbient(id);
  }
  function makeAmbient(id) {
    const jobs = id === 'fields' || id === 'wheat' ? ['farmer', 'peasant'] : id === 'pasture' || id === 'laundry' ? ['peasant', 'farmer'] : ['guard', 'knight', 'warrior'];
    const hero = named.find((n) => jobs.includes(n.job) && !atWork.includes(n) && !keepers.includes(n)) || null;
    return { kind: 'ambient', id, pos: castle.keep.clone(), radius: 8, front: 0, label: null, labels: [], weight: 1.1, cut: true,
      hero: hero && { id: hero.id, name: hero.name, job: hero.job }, sceneJob: id === 'fields' || id === 'wheat' ? 'farmer' : null };
  }
  if (ambient) targets.push(ambient);
  if (tavern) {
    const patrons = named.filter((n) => !keepers.includes(n) && !atWork.includes(n) && n.id !== ambient?.hero?.id).slice(0, 8);
    targets.push({
      kind: 'tavern', id: 'tavern', pos: buildings.items.tavern.focus.clone(), radius: 10, front: 0, label: null, labels: [],
      weight: 1.8, cut: true, // a hard cut inside (and out again): the camera never flies through the walls
      patrons: patrons.map((n) => ({ name: n.name, job: n.job })), keepers: keepers.map((n) => ({ name: n.name, job: n.job })),
    });
  }
  if (church) {
    // the newest names in the front pews (the caravan's newcomers too: the church shows them again, seated)
    const worshippers = named.filter((n) => !clergy.includes(n) && !atWork.includes(n) && n.id !== ambient?.hero?.id).slice(0, church === 'cathedral' ? 16 : 12);
    targets.push({
      kind: 'church', id: church, pos: buildings.items[church].focus.clone(), radius: 10, front: 0, label: null, labels: [],
      weight: 1.8, cut: true, // a hard cut inside and out, as for the tavern
      clergy: clergy.map((n) => ({ name: n.name, job: n.job })), worshippers: worshippers.map((n) => ({ name: n.name, job: n.job })),
    });
  }
  // 3) new or rebuilt houses fill the rest (a spread of them), only on days without named villagers
  const fresh = [...diff.housesBuilt, ...diff.housesRebuilt].filter((id) => animated.has(id) && !animated.get(id).raised);
  const houseIdx = people ? [] : pickSpread(fresh.length, Math.min(Math.max(0, maxTargets - targets.length), fresh.length));
  for (const i of houseIdx) {
    const id = fresh[i];
    const a = animated.get(id);
    const v = addedByHouse.get(id);
    targets.push({
      kind: 'house', id, pos: a.mid.clone(), labelPos: a.top.clone(), radius: 24, front: a.shape.rot + (a.shape.side > 0 ? -Math.PI / 2 : Math.PI / 2),
      label: v?.name ? { title: v.name, sub: jobLabel(v.job) } : { title: 'New home', sub: v ? jobLabel(v.job) : '' },
      rebuilt: diff.housesRebuilt.includes(id), extra: 0,
    });
  }
  // losses
  for (const id of [...diff.housesAbandoned, ...diff.housesRuined].slice(0, 2)) {
    const sh = houses.shapes.get(id);
    if (!sh || targets.length >= maxTargets) continue;
    const who = diff.removed.find((r) => r.house === id);
    targets.push({
      kind: 'loss', id, pos: new THREE.Vector3(sh.x, sh.base + 5, sh.z), radius: 27, front: sh.rot + Math.PI / 2,
      label: { title: who?.name ? `${who.name} left` : diff.housesRuined.includes(id) ? 'A house falls to ruin' : 'A family moved away', sub: diff.housesRuined.includes(id) ? 'Ruins' : 'Abandoned' },
    });
  }
  const extraHouses = fresh.length - houseIdx.length;
  const firstHouse = targets.find((t) => t.kind === 'house');
  if (extraHouses > 0 && firstHouse) firstHouse.extra = extraHouses;
  // a quiet day: show the story event
  const story = diff.events.find((e) => e.type !== 'weather' && e.type !== 'construction' && e.type !== 'milestone') || diff.events[0];
  if (targets.length < 2) {
    const ev = story?.type;
    if (ev === 'spotlight') {
      const v = state.villagers[story.villager];
      const sh = v && houses.shapes.get(v.house);
      if (sh) targets.push({ kind: 'story', pos: new THREE.Vector3(sh.x, sh.base + 4, sh.z), radius: 22, front: sh.rot + Math.PI / 2, label: { title: v.name || `The ${JOBS[v.job].label.toLowerCase()}`, sub: JOBS[v.job].label } });
    } else if ((ev === 'market_day' || ev === 'festival' || ev === 'trade') && buildings.items.market) {
      targets.push({ kind: 'story', pos: buildings.items.market.focus.clone(), radius: 40, front: Math.PI / 2, label: null });
    } else if (ev === 'trade' && buildings.items.dock) {
      targets.push({ kind: 'story', pos: buildings.items.dock.focus.clone(), radius: 30, front: 0, label: null });
    }
    for (const p of state.pendingConstruction) {
      if (targets.length >= 2) break;
      const it = buildings.items[p.building];
      if (it && !targets.some((t) => t.id === p.building)) targets.push({ kind: 'building', id: p.building, pos: it.focus.clone(), radius: 40, front: (it.lot?.rot ?? 0) + Math.PI / 2, label: { title: BUILDINGS[p.building].label.replace(/^the /, 'The '), sub: `${Math.round((1 - p.daysLeft / p.daysTotal) * 100)}% built` } });
    }
  }
  if (targets.length < 2) targets.push({ kind: 'castle', pos: castle.keep.clone(), radius: 62, front: 0.6, label: null });
  if (targets.length < 2) targets.push({ kind: 'gate', pos: castle.signPos.clone(), radius: 30, front: 0, label: null });

  // kingdom extent for the wide shot
  const box = new THREE.Box3(new THREE.Vector3(-60, 0, -60), new THREE.Vector3(80, 30, 60));
  for (const sh of houses.shapes.values()) box.expandByPoint(new THREE.Vector3(sh.x, sh.base, sh.z));
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // the caravan replaces the castle hook: it starts at 0 s, the counter overlay still shows over it
  const start = targets[0]?.kind === 'caravan' ? 0 : HOOK;
  // some shots have a fixed length (owner: the caravan lasts 4-5 s at most); the rest share the remaining
  // time by weight
  const fixedLen = (tg) => (targets.length < 2 ? null : tg.kind === 'caravan' ? CARAVAN_SECONDS : tg.kind === 'event' ? STORY_SECONDS : null);
  const fixedTotal = targets.reduce((a, tg) => a + (fixedLen(tg) ?? 0), 0);
  const totalW = targets.reduce((a, tg) => a + (fixedLen(tg) === null ? tg.weight || 1 : 0), 0);
  let tc = start;
  for (const tg of targets) {
    tg.t0 = tc;
    tc += fixedLen(tg) ?? ((UPDATE_END - start - fixedTotal) * (tg.weight || 1)) / totalW;
    tg.t1 = tc;
  }
  // overcast days keep more light at the end so the wide shot stays readable
  const dusk = ['fog', 'rain', 'snow', 'cloudy'].includes(diff.weather) ? 0.55 : 0.8;
  return { targets, center, extent: Math.max(size.x, size.z), story, dusk, start };
}

function pickSpread(n, k) {
  if (k <= 0) return [];
  if (k >= n) return [...Array(n).keys()];
  return [...Array(k).keys()].map((i) => Math.round((i * (n - 1)) / (k - 1 || 1)));
}

// ---------------------------------------------------------------- camera
const HOOK_FROM = { pos: new THREE.Vector3(150, 44, 64), look: new THREE.Vector3(CASTLE.half, CASTLE.ground + 10, 0) };
const HOOK_TO = { pos: new THREE.Vector3(72, 17, -13), look: new THREE.Vector3(CASTLE.half + 4, CASTLE.ground + 9, 0) };

function orbitPose(tg, u) {
  if (tg.cam) return tg.cam(u); // scenes with their own camera (tavern interior, story events)
  if (tg.kind === 'caravan' && tg.track) {
    // in the road ahead of the column, looking back at it as it comes into town
    const t = tg.t0 + u * (tg.t1 - tg.t0);
    const h = tg.track(t);
    // ahead and to one side, so the column runs diagonally across the frame and the name tags spread
    const a = h.dir + 0.62 - 0.22 * u;
    return {
      pos: new THREE.Vector3(h.pos.x + Math.cos(a) * 10.5, h.pos.y + 4.3, h.pos.z + Math.sin(a) * 10.5),
      look: h.pos.clone().add(new THREE.Vector3(-Math.cos(h.dir) * 6.5, 0.6, -Math.sin(h.dir) * 6.5)),
    };
  }
  if (tg.kind === 'villager' && tg.away !== undefined) {
    // at work in the croft: the camera stands on the open side, the house behind as a backdrop
    const R = tg.radius, e = ease(u);
    let a, r, h, lookY;
    if (tg.camStyle === 'push') { a = tg.away + 0.3 - 0.4 * u; r = R * (1.4 - 0.65 * e); h = 3.4 - 2.1 * e; lookY = -0.35 + 0.25 * e; } // from wide and high, a dolly in to a close shot
    else if (tg.camStyle === 'reveal') { a = tg.away - 0.55 + 0.85 * e; r = 2.7 + (R - 2.7) * e; h = 0.75 + 1.0 * e; lookY = -0.4 + 0.3 * e; } // close on the hands, pulling back to show the scene
    else if (tg.camStyle === 'low') { a = tg.away + 0.75 - 1.5 * u; r = R * 0.8; h = 0.1; lookY = 0.35; } // low angle, tracking past
    else { a = tg.away + 0.45 - 0.9 * u; r = R; h = 1.7; lookY = -0.1; }
    return {
      pos: new THREE.Vector3(tg.pos.x + Math.cos(a) * r, tg.pos.y + h, tg.pos.z + Math.sin(a) * r),
      look: tg.pos.clone().add(new THREE.Vector3(0, lookY, 0)),
    };
  }
  const r = tg.radius;
  const small = tg.kind === 'house' || tg.kind === 'loss' || tg.kind === 'story' || tg.kind === 'villager';
  const a = tg.front + 0.55 - 0.7 * u;
  const h = r * (small ? 0.3 : 0.5);
  return {
    pos: new THREE.Vector3(tg.pos.x + Math.cos(a) * r, tg.pos.y + h, tg.pos.z + Math.sin(a) * r),
    look: tg.pos.clone().add(new THREE.Vector3(0, small ? -1 : -2, 0)),
  };
}
function widePose(plan, u) {
  const e = Math.max(260, plan.extent);
  const a = 0.75 - 0.25 * u;
  return {
    pos: new THREE.Vector3(plan.center.x + Math.cos(a) * e * 0.85, e * 0.55 + 40, plan.center.z + Math.sin(a) * e * 0.85),
    look: plan.center.clone().add(new THREE.Vector3(-e * 0.05, 0, 0)),
  };
}
function mixPose(a, b, k) {
  return { pos: a.pos.clone().lerp(b.pos, k), look: a.look.clone().lerp(b.look, k) };
}
/** Fly between poses: lerp plus a lift so long moves arc above the town. */
function fly(a, b, k) {
  const p = mixPose(a, b, ease(k));
  p.pos.y += Math.sin(Math.PI * k) * Math.min(60, a.pos.distanceTo(b.pos) * 0.25);
  return p;
}

export function evaluate(plan, t) {
  // stay in daylight through the update shots, then go to dusk for the wide shot
  const out = { phase: (plan.dusk ?? 0.8) * smooth(16, 25, t), bridge: 1, labels: [], progress: new Map(), shadowRadius: 120 };
  // drawbridge lowers in the hook and rises again at the end so the video loops
  out.bridge = t < 1.8 ? ease(t / 1.8) : t > 28.2 ? 1 - ease((t - 28.2) / 1.8) : 1;
  let pose;
  const start = plan.start ?? HOOK;
  if (t < start) {
    pose = mixPose(HOOK_FROM, HOOK_TO, easeOut(t / HOOK));
    out.shadowRadius = 140;
  } else if (t < UPDATE_END) {
    const i = plan.targets.findIndex((tg) => t >= tg.t0 && t < tg.t1);
    const tg = plan.targets[Math.max(0, i)];
    const u = (t - tg.t0) / (tg.t1 - tg.t0);
    const here = orbitPose(tg, u);
    // the first shot flies in from the hook, unless the video opens directly on it (caravan)
    // shots marked `cut` (the tavern interior) start and end with a hard cut, `cutIn` only start with one
    const prev = tg.cut || tg.cutIn || plan.targets[i - 1]?.cut ? null : i <= 0 ? (start > 0 ? HOOK_TO : null) : orbitPose(plan.targets[i - 1], 1);
    const flyT = Math.min(1.1, (tg.t1 - tg.t0) * 0.35);
    out.flying = !!prev && t - tg.t0 < flyT;
    pose = out.flying ? fly(prev, here, (t - tg.t0) / flyT) : here;
    out.shadowRadius = Math.max(80, tg.radius * 2.6);
    out.active = tg;
    out.activeU = u;
    if (tg.phase !== undefined) out.phase = tg.phase; // dusk scenes (cut in and out)
  } else if (t < WIDE_END) {
    const last = orbitPose(plan.targets.at(-1), 1);
    const wide = widePose(plan, (t - UPDATE_END) / (WIDE_END - UPDATE_END));
    pose = !plan.targets.at(-1).cut && t - UPDATE_END < 1.4 ? fly(last, wide, (t - UPDATE_END) / 1.4) : wide;
    out.shadowRadius = Math.max(260, plan.extent * 0.75);
  } else {
    pose = fly(widePose(plan, 1), HOOK_FROM, (t - WIDE_END) / (DURATION - WIDE_END));
    out.shadowRadius = 260;
  }
  // construction progress for each target, tied to its segment
  for (const tg of plan.targets) {
    if (tg.kind === 'house') {
      const p = t < tg.t0 ? 0 : t > tg.t1 ? 1 : ease(Math.min(1, (t - tg.t0) / ((tg.t1 - tg.t0) * 0.82)));
      out.progress.set('h' + tg.id, p);
    } else if (tg.kind === 'building') {
      out.progress.set('b' + tg.id, t < tg.t0 ? 0 : ease(Math.min(1, (t - tg.t0) / ((tg.t1 - tg.t0) * 0.8))));
    }
  }
  out.camera = pose;
  out.section = t < start ? 'hook' : t < UPDATE_END ? 'update' : t < WIDE_END ? 'wide' : 'cta';
  return out;
}

function smooth(a, b, x) { return ease((x - a) / (b - a)); }
function easeOut(x) { return 1 - (1 - x) ** 3; }
export { HOOK, UPDATE_END, WIDE_END };
