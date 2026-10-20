// The 30-second shot plan, computed from the day's diff. evaluate(t) gives camera pose, light phase,
// construction progress, visible labels and overlay state. Pure function of (plan, t).
import * as THREE from 'three';
import { BUILDINGS, JOBS, tavernScene } from '../../sim/tiers.js';
import { CASTLE } from '../../sim/world.js';
import { NIGHT_STORIES } from './stories/index.js';
import { pickFeatured } from '../../sim/featured.js';

export const DURATION = 30;
// the wide shot with the goal and the end credits is short (3.5 s) so the daily update keeps the time
const HOOK = 2, UPDATE_END = 23.5, WIDE_END = 27;
const CARAVAN_SECONDS = 4.5, STORY_SECONDS = 4.5;
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

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
    const SMALL = ['crier_stand', 'pillory'];
    const big = ['cathedral', 'palace', 'tournament', 'harbor', 'wall2', 'university', 'colossus', 'townhall'].includes(id);
    targets.push({
      kind: 'building', id, pos: it.focus.clone(), radius: big ? 70 : SMALL.includes(id) ? 13 : 30, front: (it.lot?.rot ?? 0) + Math.PI / 2,
      label: { title: BUILDINGS[id].label.replace(/^the /, 'The '), sub: diff.buildingsCompleted.includes(id) ? 'Completed!' : 'Construction begins' },
      completed: diff.buildingsCompleted.includes(id),
      weight: people ? 0.9 : 1, // "a few seconds" each when the caravan and the workers share the video
    });
  }
  // 2) the caravan of villagers named today, then a few named villagers at work
  const today = diff.named || [];
  if (today.length) targets.unshift({ kind: 'caravan', id: 'caravan', pos: new THREE.Vector3(), radius: 14, front: 0, label: null, labels: [], weight: 2.8, count: today.length });
  // the day's story event (bandits, a quarrel, merchants, Halloween...) comes right after the caravan
  if (diff.story) {
    const night = NIGHT_STORIES.has(diff.story.id);
    targets.splice(today.length ? 1 : 0, 0, {
      kind: 'event', id: diff.story.id, story: diff.story, pos: (buildings.items.market || buildings.items.well)?.focus.clone() ?? castle.keep.clone(),
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
  const tavern = people && named.length > 0 && buildings.items.tavern && tavernScene(state);
  const keepers = tavern ? named.filter((n) => n.job === 'innkeeper' || n.job === 'brewer').slice(0, 2) : [];
  // who is shown at work comes from the simulation (src/sim/featured.js): today's named villagers first,
  // never yesterday's jobs again, one per job; older saves fall back to the same rule without yesterday
  const featured = diff.featured || pickFeatured(state);
  const picked = featured.map((f) => named.find((n) => n.id === f.id)).filter((n) => n && !keepers.includes(n));
  const atWork = picked.slice(0, tavern ? 2 : people ? 3 : Math.min(3, Math.max(2, maxTargets - targets.length - 2)));
  for (const n of atWork) {
    const apprentice = n.job === 'apprentice' && n.wants;
    const sub = apprentice ? `Apprentice ${jobLabel(n.wants)}` : jobLabel(n.job);
    targets.push({
      kind: 'villager', id: n.id, job: n.job, sceneJob: apprentice ? n.wants : n.job, pos: new THREE.Vector3(), labelPos: new THREE.Vector3(), radius: 6.8, front: 0,
      label: { title: n.name, sub }, work: null, weight: 1.1,
    });
  }
  // an everyday shot when there is time for it: a guard patrolling the castle walls or farmers hoeing
  // (not in winter); a named guard or farmer not shown elsewhere gets the name tag
  const month = Number(state.date.slice(5, 7)), winter = month === 12 || month <= 2;
  const flexible = targets.filter((t) => t.kind !== 'caravan' && t.kind !== 'event').length;
  let ambient = null;
  if (people && flexible <= (tavern ? 3 : 4)) {
    // not a job the previous video or today's workers already showed (diff.avoidJobs: yesterday's jobs)
    const seen = new Set([...(diff.avoidJobs || []), ...atWork.map((n) => n.job)]);
    const wallsOk = state.unlockedTiers.includes('guard') && !['guard', 'knight', 'warrior'].some((j) => seen.has(j));
    const fieldsOk = !winter && !seen.has('farmer') && !seen.has('peasant');
    const id = wallsOk && (state.day % 2 === 1 || !fieldsOk) ? 'patrol' : fieldsOk ? 'fields' : null;
    if (id) {
      const jobs = id === 'patrol' ? ['guard', 'knight', 'warrior'] : ['farmer', 'peasant'];
      const hero = named.find((n) => jobs.includes(n.job) && !atWork.includes(n) && !keepers.includes(n)) || null;
      ambient = { kind: 'ambient', id, pos: castle.keep.clone(), radius: 8, front: 0, label: null, labels: [], weight: 1.1, cut: true,
        hero: hero && { id: hero.id, name: hero.name, job: hero.job }, sceneJob: id === 'fields' ? 'farmer' : null };
      targets.push(ambient);
    }
  }
  if (tavern) {
    const patrons = named.filter((n) => !keepers.includes(n) && !atWork.includes(n) && n.id !== ambient?.hero?.id).slice(0, 8);
    targets.push({
      kind: 'tavern', id: 'tavern', pos: buildings.items.tavern.focus.clone(), radius: 10, front: 0, label: null, labels: [],
      weight: 1.8, cut: true, // a hard cut inside (and out again): the camera never flies through the walls
      patrons: patrons.map((n) => ({ name: n.name, job: n.job })), keepers: keepers.map((n) => ({ name: n.name, job: n.job })),
    });
  }
  // 3) new or rebuilt houses fill the rest (a spread of them), only on days without named villagers
  const fresh = [...diff.housesBuilt, ...diff.housesRebuilt].filter((id) => animated.has(id));
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
    const a = tg.away + 0.45 - 0.9 * u;
    return {
      pos: new THREE.Vector3(tg.pos.x + Math.cos(a) * tg.radius, tg.pos.y + 1.7, tg.pos.z + Math.sin(a) * tg.radius),
      look: tg.pos.clone().add(new THREE.Vector3(0, -0.1, 0)),
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
    // shots marked `cut` (the tavern interior) start and end with a hard cut
    const prev = tg.cut || plan.targets[i - 1]?.cut ? null : i <= 0 ? (start > 0 ? HOOK_TO : null) : orbitPose(plan.targets[i - 1], 1);
    const flyT = Math.min(1.1, (tg.t1 - tg.t0) * 0.35);
    pose = prev && t - tg.t0 < flyT ? fly(prev, here, (t - tg.t0) / flyT) : here;
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
