// The 30-second shot plan, computed from the day's diff. evaluate(t) gives camera pose, light phase,
// construction progress, visible labels and overlay state. Pure function of (plan, t).
import * as THREE from 'three';
import { BUILDINGS, JOBS } from '../../sim/tiers.js';
import { CASTLE } from '../../sim/world.js';

export const DURATION = 30;
const HOOK = 2, UPDATE_END = 22, WIDE_END = 27;
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function makePlan({ state, diff, houses, animated, buildings, castle, maxTargets = 7 }) {
  const targets = [];
  const addedByHouse = new Map();
  for (const a of diff.added) if (!addedByHouse.has(a.house)) addedByHouse.set(a.house, a);
  const jobLabel = (j) => JOBS[j]?.label || j;
  // 1) buildings unlocked or finished today come first: a new building is the day's headline
  for (const id of [...diff.buildingsStarted, ...diff.buildingsCompleted]) {
    const it = buildings.items[id];
    if (!it || targets.some((t) => t.id === id) || targets.length >= 3) continue;
    const big = ['cathedral', 'palace', 'tournament', 'harbor', 'wall2', 'university', 'colossus', 'townhall'].includes(id);
    targets.push({
      kind: 'building', id, pos: it.focus.clone(), radius: big ? 70 : 30, front: (it.lot?.rot ?? 0) + Math.PI / 2,
      label: { title: BUILDINGS[id].label.replace(/^the /, 'The '), sub: diff.buildingsCompleted.includes(id) ? 'Completed!' : 'Construction begins' },
      completed: diff.buildingsCompleted.includes(id),
    });
  }
  // 2) villagers named by commenters: newest names first, then earlier ones, followed on their walk
  const named = Object.entries(state.names || {}).map(([id, n]) => ({ id: Number(id), ...n }))
    .filter((n) => n.id < state.villagers.length)
    .sort((a, b) => (b.day ?? 0) - (a.day ?? 0) || a.id - b.id);
  for (const n of named.slice(0, Math.min(3, Math.max(2, maxTargets - targets.length - 2)))) {
    const v = state.villagers[n.id];
    targets.push({ kind: 'villager', id: n.id, pos: new THREE.Vector3(), labelPos: new THREE.Vector3(), radius: 8, front: 0, label: { title: n.name, sub: jobLabel(v.job) }, track: null });
  }
  // 3) new or rebuilt houses fill the rest (a spread of them)
  const fresh = [...diff.housesBuilt, ...diff.housesRebuilt].filter((id) => animated.has(id));
  const houseIdx = pickSpread(fresh.length, Math.min(Math.max(0, maxTargets - targets.length), fresh.length));
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

  const seg = (UPDATE_END - HOOK) / targets.length;
  targets.forEach((tg, i) => { tg.t0 = HOOK + i * seg; tg.t1 = HOOK + (i + 1) * seg; });
  // overcast days keep more light at the end so the wide shot stays readable
  const dusk = ['fog', 'rain', 'snow', 'cloudy'].includes(diff.weather) ? 0.55 : 0.8;
  return { targets, center, extent: Math.max(size.x, size.z), story, dusk };
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
  if (tg.kind === 'villager' && tg.track) {
    // walk backwards in front of the villager, slightly off-axis: the street ahead is always open,
    // while a camera beside them would end up inside the houses
    const t = tg.t0 + u * (tg.t1 - tg.t0);
    const p = tg.track(t), dir = tg.trackDir(t);
    tg.pos.copy(p);
    tg.labelPos.copy(p).add(new THREE.Vector3(0, 2.3, 0));
    const a = dir + 0.32 - 0.2 * u;
    return {
      pos: new THREE.Vector3(p.x + Math.cos(a) * tg.radius, p.y + 3.6, p.z + Math.sin(a) * tg.radius),
      look: p.clone().add(new THREE.Vector3(0, 1.1, 0)),
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
  if (t < HOOK) {
    pose = mixPose(HOOK_FROM, HOOK_TO, easeOut(t / HOOK));
    out.shadowRadius = 140;
  } else if (t < UPDATE_END) {
    const i = plan.targets.findIndex((tg) => t >= tg.t0 && t < tg.t1);
    const tg = plan.targets[Math.max(0, i)];
    const u = (t - tg.t0) / (tg.t1 - tg.t0);
    const here = orbitPose(tg, u);
    const prev = i <= 0 ? HOOK_TO : orbitPose(plan.targets[i - 1], 1);
    const flyT = Math.min(1.1, (tg.t1 - tg.t0) * 0.35);
    pose = t - tg.t0 < flyT ? fly(prev, here, (t - tg.t0) / flyT) : here;
    out.shadowRadius = Math.max(80, tg.radius * 2.6);
    out.active = tg;
    out.activeU = u;
  } else if (t < WIDE_END) {
    const last = orbitPose(plan.targets.at(-1), 1);
    const wide = widePose(plan, (t - UPDATE_END) / (WIDE_END - UPDATE_END));
    pose = t - UPDATE_END < 1.4 ? fly(last, wide, (t - UPDATE_END) / 1.4) : wide;
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
  out.section = t < HOOK ? 'hook' : t < UPDATE_END ? 'update' : t < WIDE_END ? 'wide' : 'cta';
  return out;
}

function smooth(a, b, x) { return ease((x - a) / (b - a)); }
function easeOut(x) { return 1 - (1 - x) ** 3; }
export { HOOK, UPDATE_END, WIDE_END };
