// Browser entry. window.SK.setup(data) builds the kingdom; window.SK.frame(f) renders frame f of the
// 30 s video deterministically (t = f / 30). In viewer mode an orbit camera runs in real time.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { world, CASTLE } from '../../sim/world.js';
import { makeMaterials } from './materials.js';
import { buildTerrain, buildOverlay, buildWater } from './terrain.js';
import { buildCastle } from './castle.js';
import { buildHouses, buildAnimatedHouse } from './houses.js';
import { buildBuildings } from './buildings.js';
import { buildNature } from './nature.js';
import { buildLife } from './life.js';
import { buildEnvironment } from './env.js';
import { makePlan, evaluate, indoorScene, barScene, AWAY_VARIANTS } from './timeline.js';
import { createOverlay } from './overlay.js';
import { buildWorkScene, sceneOf } from './work.js';
import { buildCaravan } from './caravan.js';
import { buildTavernInterior } from './tavern.js';
import { buildChurchInterior } from './church.js';
import { buildStory } from './stories/index.js';
import { buildFields, buildWheat } from './ambient.js';
import { buildWallWatch } from './wallwatch.js';
import { buildPasture, buildLaundry } from './everyday.js';
import { buildSparring, buildDummyDrill } from './drills.js';
import { buildBoat, buildRiverbank, buildNightWatch } from './away.js';
import { buildVisit } from './visit.js';
import { buildBakehouse } from './bakery.js';
import { buildSweepRoom } from './room.js';
import { huntSpot } from '../../sim/wall.js';
import { buildQueue } from './queue.js';
import { heightAt, WATER_LEVEL } from '../../sim/world.js';
import { JOBS } from '../../sim/tiers.js';
import { pointInObb, grow } from '../../sim/geometry.js';

const FPS = 30;

function seasonOf(date) {
  const m = Number(date.slice(5, 7));
  return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
}

async function setup(data) {
  const t0 = performance.now();
  const { state, diff } = data;
  const viewer = data.mode === 'viewer';
  const width = viewer ? window.innerWidth : data.width || 1080, height = viewer ? window.innerHeight : data.height || 1920;
  await Promise.all([document.fonts.load('700 40px Cinzel'), document.fonts.load('800 40px Inter')]).catch(() => {});

  const w = world(state.seed);
  const season = seasonOf(state.date);
  const renderer = new THREE.WebGLRenderer({ antialias: viewer, preserveDrawingBuffer: !viewer, powerPreference: 'high-performance' });
  renderer.setPixelRatio(viewer ? Math.min(2, window.devicePixelRatio) : 1);
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = viewer ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('stage').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(viewer ? 50 : 52, width / height, 1, 30000);
  const M = makeMaterials(state.seed);

  const terrain = buildTerrain(w, { season });
  terrain.userData.uniforms.overlayMap.value = buildOverlay(w, state);
  terrain.userData.uniforms.pavedMap.value = terrain.userData.uniforms.overlayMap.value.userData.paved;
  terrain.userData.uniforms.snow.value = diff.weather === 'snow' ? 0.85 : 0;
  scene.add(terrain);
  const water = buildWater(w);
  scene.add(water);
  const castle = buildCastle(M);
  scene.add(castle.group);

  // houses built or rebuilt today are animated individually in the video, and a few that got another storey
  const raisedToday = (diff.housesRaised || []).filter((id) => !diff.housesBuilt.includes(id)).slice(0, 6);
  const todays = viewer ? [] : [...diff.housesBuilt, ...diff.housesRebuilt].slice(0, 60).concat(raisedToday);
  const animatedIds = new Set(todays);
  const houses = buildHouses(state, w, M, { animatedIds });
  scene.add(houses.group);
  const animated = new Map();
  for (const id of todays) {
    const h = state.houses.find((x) => x.id === id);
    const a = buildAnimatedHouse(houses.shapes.get(id), h, state.seed, M, houses, { raised: raisedToday.includes(id) });
    animated.set(id, a);
    scene.add(a.group);
  }
  const buildings = buildBuildings(w, state, M, { season });
  scene.add(buildings.group);
  const nature = buildNature(w, state, M, { season });
  scene.add(nature.group);

  const plan = viewer ? null : makePlan({ state, diff, houses, animated, buildings, castle });
  // chimneys of animated houses start smoking once their roof is on
  const extraChimneys = [];
  if (plan) for (const tg of plan.targets) {
    const a = tg.kind === 'house' && animated.get(tg.id);
    if (a?.chimneyTop) extraChimneys.push({ pos: a.chimneyTop, dark: false, rate: 1, startAt: tg.t0 + (tg.t1 - tg.t0) * 0.8 });
  }
  for (const [id, a] of animated) if (a.chimneyTop && !plan?.targets.some((tg) => tg.id === id)) extraChimneys.push({ pos: a.chimneyTop, dark: false, rate: 1, startAt: 21 });
  const life = buildLife(w, state, M, castle, houses, buildings, { weather: diff.weather, extraChimneys });
  scene.add(life.group);
  // named villagers are shown at work in their croft; today's named villagers arrive in a caravan
  const works = [];
  const ctx0 = {};
  let caravan = null, tavern = null, church = null;
  const stories = [];
  const yFn = (x, z) => heightAt(w, x, z) + 0.03;
  const interiors = []; // villagers working inside a building (the baker's bakehouse), lit while the camera is in
  const ambientScene = (id, hero) => {
    const a = { w, M, seed: state.seed, hero, lang: data.lang };
    const watch = (o) => buildWallWatch({ castle, w, state, M, seed: state.seed, hero, lang: data.lang, ...o });
    return id === 'patrol' ? watch({ mode: 'day' }) : id === 'change' ? watch({ mode: 'change' })
      : id === 'sparring' ? buildSparring(a) : id === 'pasture' ? buildPasture(a) : id === 'laundry' ? buildLaundry(a)
        : id === 'wheat' ? buildWheat({ ...a, month: Number(state.date.slice(5, 7)) }) : buildFields(a);
  };
  const awayScene = (variant, hero, home, guest = null) => {
    const ground = (x, z) => heightAt(w, x, z);
    // guards on the castle walls or the Second Wall: by day, at night, the changing of the guard
    const WATCH = { walls: ['castle', 'day'], wallnight: ['castle', 'night'], change: ['castle', 'change'], wall2: ['wall2', 'day'], wall2night: ['wall2', 'night'], wall2change: ['wall2', 'change'] };
    if (WATCH[variant]) return buildWallWatch({ where: WATCH[variant][0], mode: WATCH[variant][1], castle, w, state, M, seed: state.seed, hero, lang: data.lang, tag: false });
    // an everyday shot as the villager's own scene (owner 2026-10-23): the big name label where the small tag would be
    if (['fields', 'wheat', 'pasture', 'laundry'].includes(variant)) {
      const st = ambientScene(variant, hero);
      if (!st) return null;
      const tag = st.labels.shift();
      return { ...st, labels: [], banner: null, labelPos: tag?.pos ?? st.focus.clone().add(new THREE.Vector3(0, 1.6, 0)) };
    }
    return variant === 'sparring' ? buildSparring({ M, seed: state.seed, hero, lang: data.lang, tag: false })
        : variant === 'boat' ? buildBoat({ w, M, hero, home, heightAt: ground })
          : variant === 'rod' || variant === 'net' ? buildRiverbank({ w, M, hero, home, heightAt: ground, mode: variant, guest })
          : buildNightWatch({ w, M, hero, home, heightAt: ground });
  };
  // where a villager works: the croft behind the house, facing away from it; the Fletcher works in the yard of
  // the Fletcher's Workshop once it stands (owner 2026-10-23), with the street (and the camera) in front
  const shop = state.buildings.some((b) => b.id === 'fletcher_workshop' && b.status === 'done') ? buildings.items.fletcher_workshop : null;
  // and fighters drilling at the straw dummy do it in the castle's training yard (owner 2026-10-23); merchants at a market
  // stall, the tax collector at the Counting House door, the apothecary at the shop (`face`: the way they look, along
  // the front, so the camera on the street sees the queue in profile)
  // (`y` above the lot's level, `back`: the camera on the lot's back side, -z)
  // the ground under a spot: the top of a building's paved foundation or a square's sloping side, else the terrain
  const pads = Object.values(buildings.items).filter((it) => it.pad && it.lot?.hw > 0);
  const floorOf = (x, z) => {
    let y = yFn(x, z);
    for (const { lot, base, padH, flare } of pads) {
      const c = Math.cos(-lot.rot), s = Math.sin(-lot.rot), dx = x - lot.x, dz = z - lot.z;
      const out = Math.max(Math.abs(dx * c - dz * s) - lot.hw - 0.5, Math.abs(dx * s + dz * c) - lot.hd - 0.5);
      if (out <= 0) y = Math.max(y, base + 0.05);
      else if (out < flare) y = Math.max(y, base + 0.05 - (padH * out) / flare);
    }
    return y;
  };
  // a spot in front of a lot may be off its foundation, down on the grass (2026-10-24: the woodcutter in front of the sawmill
  // and his visitor stood 0.25 m up in the air)
  const atLot = (item, x, z, { y = 0, back = false } = {}) => {
    const { lot } = item, o = item.toWorld([0, 0, 0]), e = item.toWorld([1, 0, 0]), s = back ? -1 : 1;
    const floorAt = (px, pz) => (pointInObb(grow(lot, 0.4), px, pz) ? item.base + y : floorOf(px, pz));
    const anchor = item.toWorld([x, y, z]);
    anchor.y = floorAt(anchor.x, anchor.z);
    return { anchor, ax: -Math.sin(lot.rot) * s, az: Math.cos(lot.rot) * s, floorAt, face: Math.atan2(e.x - o.x, e.z - o.z) };
  };
  const done = (id) => state.buildings.some((b) => b.id === id && b.status === 'done') && buildings.items[id];
  // owner 2026-10-23: the jobs with a workplace of their own work there once it stands, every scene of the job: the smith in
  // the forge's yard, the woodcutter by the sawmill's log pile, the mason on the quarry's top terrace by the cut blocks, the
  // miller at the windmill door, the executioner at the foot of the pillory (the camera on the market square); lot-local
  // spots in front of each building, the croft scene's props around them
  const PLACES = {
    blacksmith: ['forge', 1.6, 6.4], toolsmith: ['forge', 1.6, 6.4], woodcutter: ['sawmill', 0.8, 9.2],
    stonemason: ['quarry', -8, -12.4, { y: 0.2, back: true }], miller: ['windmill', 2.6, 5.4], executioner: ['pillory', 0.3, -3.0, { back: true }],
    // owner 2026-10-25: the potter, the tailor and the cobbler in front of their stalls on the market square, the scholar
    // on the University's lawn, the cooper, the bell founder and the clockmaker in front of their workshops on the ward squares
    potter: ['potter_stall', 0, 2.7], tailor: ['tailor_stall', 0, 2.7], cobbler: ['cobbler_stall', 0, 2.7],
    scholar: ['university', 6, -3, { y: 0.12 }], cooper: ['cooperage', 0, 3.6], bellfounder: ['bell_foundry', 0, 3.8], clockmaker: ['clock_tower', 0, 4.2],
  };
  // farmers work in one of the fields (owner 2026-10-23), on the crop (its surface is 0.12 m above the ground); the
  // odd ones, which have no hay bales in summer and autumn (buildFields in buildings.js)
  const fieldCount = Math.min(w.fields.length, 2 + Math.ceil(state.villagers.filter((v) => v.job === 'farmer').length / 2));
  const atField = (id) => {
    const f = w.fields[1 + 2 * (Math.abs(id) % Math.min(2, Math.floor(fieldCount / 2)))], c = Math.cos(f.rot), s = Math.sin(f.rot);
    const lx = f.hw * (id % 2 ? 0.35 : -0.35), lz = f.hd * 0.5;
    const anchor = new THREE.Vector3(f.x + lx * c - lz * s, 0, f.z + lx * s + lz * c);
    anchor.y = heightAt(w, anchor.x, anchor.z) + 0.12;
    return { anchor, ax: -s, az: c, floorAt: (x, z) => yFn(x, z) + (pointInObb(f, x, z) ? 0.09 : 0) };
  };
  // market stalls: two stall scenes in one video never share a stall
  const stalls = new Map();
  const stallOf = (id) => {
    if (!stalls.has(id)) {
      const used = new Set(stalls.values());
      let k = Math.abs(id) % 8;
      while (used.has(k) && used.size < 8) k = (k + 1) % 8;
      stalls.set(id, k);
    }
    return stalls.get(id);
  };
  // an alley between two houses near the rat catcher's (owner 2026-10-23): beside a house, clear from its front to its
  // back, with the next house 1.5 to 3 m away; the camera at its street end
  const shapes = [...houses.shapes.values()], inverse = new Map();
  const inHouse = (p, skip, pad) => shapes.some((o) => {
    if (o === skip || Math.abs(o.x - p.x) > 14 || Math.abs(o.z - p.z) > 14) return false;
    if (!inverse.has(o)) inverse.set(o, o.matrix.clone().invert());
    const q = p.clone().applyMatrix4(inverse.get(o));
    return Math.abs(q.x) < o.W / 2 + pad && Math.abs(q.z) < o.D / 2 + pad;
  });
  const alleyBy = (sh) => {
    const near = shapes.filter((o) => Math.hypot(o.x - sh.x, o.z - sh.z) < 160).sort((a, b) => Math.hypot(a.x - sh.x, a.z - sh.z) - Math.hypot(b.x - sh.x, b.z - sh.z));
    for (const o of near.slice(0, 80)) for (const sd of [1, -1]) {
      const at = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(o.matrix);
      const x = sd * (o.W / 2 + 1.0);
      if ([-o.D / 2, 0.3, o.D / 2].some((z) => inHouse(at(x, z), o, 0.3))) continue;
      if (!inHouse(at(sd * (o.W / 2 + 3.0), 0), o, 0.05)) continue;
      const anchor = at(x, 0.3), street = at(x, -1).sub(at(x, 0)).setY(0).normalize();
      anchor.y = yFn(anchor.x, anchor.z);
      // the camera looks down the alley from its street end, slowly in
      const from = at(x, -o.D / 2 - 2.6), to = at(x, -o.D / 2 - 0.6), look = anchor.clone().setY(anchor.y + 0.8);
      from.y = yFn(from.x, from.z) + 1.7; to.y = yFn(to.x, to.z) + 1.5;
      const cam = (u) => ({ pos: from.clone().lerp(to, u * u * (3 - 2 * u)), look });
      return { anchor, ax: street.x, az: street.z, floorAt: null, cam };
    }
    return null;
  };
  // the far grass beyond the fields (as the flock at pasture, everyday.js): the shepherd's pen
  const farField = [...w.fields].sort((a, b) => b.z * -1 - a.z * -1 || b.x - a.x).slice(0, 6).sort((a, b) => b.x - a.x)[0];
  // the hunter: in a clearing in the woods outside the Second Wall, shooting outward toward the trees
  const hunt = huntSpot(w, state);
  const workPlace = (job, sh, variant = null, id = 0) => {
    if (variant === 'counting' && buildings.items.counting_house) return atLot(buildings.items.counting_house, -2.3, 2.1);
    if (variant === 'shop' && buildings.items.apothecary_shop) return atLot(buildings.items.apothecary_shop, -1.6, 2.4);
    if (variant === 'booth' && buildings.items.physician_booth) return atLot(buildings.items.physician_booth, -1.6, 2.6);
    // the priest blesses one of the fields
    if (variant === 'bless' && fieldCount > 1) return atField(id);
    // the crier up on the Crier's Stand, calling to the square
    if (variant === 'stand' && buildings.items.crier_stand) return { ...atLot(buildings.items.crier_stand, 0.1, 0.25, { y: 0.77 }), face: undefined };
    const place = PLACES[job] && done(PLACES[job][0]);
    if (place) return { ...atLot(place, ...PLACES[job].slice(1)), face: undefined };
    if (job === 'farmer' && fieldCount > 1 && state.buildings.some((b) => b.id === 'fields')) return atField(id);
    if (variant === 'stall' && buildings.items.market) {
      // behind the counter of one of the eight stalls (buildings.js), facing the middle of the square
      const m = buildings.items.market, k = stallOf(id), side = k < 4 ? -1 : 1, x = [-15, -5, 5, 15][k % 4];
      const anchor = m.toWorld([x, 0.05, side * 11.65]), mid = m.toWorld([x, 0, 0]);
      const d = new THREE.Vector3().subVectors(mid, anchor).setY(0).normalize();
      return { anchor, ax: d.x, az: d.z, floorAt: () => m.base + 0.05, face: Math.atan2(d.x, d.z) };
    }
    // the bard and the jester perform in the market square, between the north stalls and the road
    if ((variant === 'square' || variant === 'proclaim' || variant === 'preach') && buildings.items.market) {
      const m = buildings.items.market, x = [-11, 11, -3, 3][Math.abs(id) % 4];
      const anchor = m.toWorld([x, 0.05, -6.5]), d = m.toWorld([x, 0.05, 0]).sub(anchor).setY(0).normalize();
      return { anchor, ax: d.x, az: d.z, floorAt: () => m.base + 0.05 };
    }
    if (variant === 'alley') { const a = alleyBy(sh); if (a) return a; }
    if (variant === 'pen' && farField) {
      const anchor = new THREE.Vector3(farField.x + farField.hw + 12, 0, farField.z + 2);
      anchor.y = yFn(anchor.x, anchor.z);
      return { anchor, ax: 0, az: 1, floorAt: null };
    }
    // the falconer in the same clearing, a few steps to one side, the falcon flying out over the grass
    if (variant === 'meadow') {
      const { ox, oz } = hunt, anchor = new THREE.Vector3(hunt.x - ox * 4 + oz * 4, 0, hunt.z - oz * 4 - ox * 4);
      anchor.y = yFn(anchor.x, anchor.z);
      // facing out over the grass, the falcon's loop in front of him (work.js); the camera side on, far enough back to
      // keep the falconer and the whole loop in the picture
      const mid = anchor.clone().add(new THREE.Vector3(ox * 1.25, 1.5, oz * 1.25)), side = new THREE.Vector3(oz, 0, -ox);
      const from = mid.clone().addScaledVector(side, 8.6), to = mid.clone().addScaledVector(side, 7.8);
      from.y = Math.max(from.y + 0.4, yFn(from.x, from.z) + 1.4); to.y = Math.max(to.y + 0.3, yFn(to.x, to.z) + 1.4);
      const cam = (u) => ({ pos: from.clone().lerp(to, u * u * (3 - 2 * u)), look: mid });
      return { anchor, ax: side.x, az: side.z, floorAt: null, face: Math.atan2(ox, oz), cam };
    }
    if (variant === 'boar' || variant === 'stag') {
      const { ox, oz } = hunt, anchor = new THREE.Vector3(hunt.x - ox * 3, 0, hunt.z - oz * 3);
      anchor.y = yFn(anchor.x, anchor.z);
      // the camera behind the hunter's shoulder, looking down the line of the shot; the arrow flies along the hunter's
      // -1.3 rad (work.js)
      const k = Math.cos(0.3), q = Math.sin(0.3);
      return { anchor, ax: -ox * k + oz * q, az: -oz * k - ox * q, floorAt: null, face: Math.atan2(ox, oz) + Math.atan2(Math.cos(1.3), Math.sin(1.3)) };
    }
    // the engineer in front of a building going up, the plan in hand
    if (variant === 'site') {
      const id0 = (state.pendingConstruction || []).map((p) => p.building).find((b) => buildings.items[b]?.lot?.hw > 0);
      if (id0) return { ...atLot(buildings.items[id0], 0, buildings.items[id0].lot.hd + 3.5), face: undefined };
    }
    if (variant === 'dummy' && castle.training) {
      const { at, view, floor } = castle.training;
      return { anchor: at.clone(), ax: view[0], az: view[1], floorAt: () => floor };
    }
    if (job === 'fletcher' && shop) {
      const { lot } = shop;
      const floorAt = (x, z) => (pointInObb(grow(lot, 0.4), x, z) ? shop.base : yFn(x, z));
      return { anchor: shop.toWorld([0.2, 0, 3.6]), ax: -Math.sin(lot.rot), az: Math.cos(lot.rot), floorAt };
    }
    const c = Math.cos(sh.rot), s = Math.sin(sh.rot);
    const ax = -s * sh.side, az = c * sh.side; // from the house toward its croft
    const anchor = new THREE.Vector3(sh.x + ax * (sh.D / 2 + 4.2), 0, sh.z + az * (sh.D / 2 + 4.2));
    anchor.y = yFn(anchor.x, anchor.z);
    return { anchor, ax, az, floorAt: null };
  };
  // the work scene in a croft: the bakehouse for bakers, the straw dummy for fighters, else work.js; people queueing in
  // front of a few (queue.js)
  const workScene = (o) => {
    const ws = workSceneOnly(o), q = sceneOf(o.job, o.variant).queue;
    if (!q) return ws;
    const queue = buildQueue(q, { M, seed: state.seed, id: o.id });
    ws.group.add(queue.group);
    ws.group.updateMatrixWorld(true);
    ws.focus = ws.group.localToWorld(queue.mid.clone());
    const update = ws.update;
    ws.update = (t, ...a) => { update(t, ...a); queue.update(t); };
    return ws;
  };
  const workSceneOnly = ({ job, variant, anchor, ax, az, away, id, face, t0 = 0 }) => {
    if (indoorScene(job, variant)) return (job === 'chimneysweep' ? buildSweepRoom : buildBakehouse)({ variant, anchor, away, M, seed: state.seed, id, heightAt: (x, z) => heightAt(w, x, z) });
    const make = variant === 'dummy' ? buildDummyDrill : buildWorkScene;
    // scenes by the house (the beggar against its back wall): `home` metres out from the wall, facing the croft
    const { home, homeTurn = 0 } = sceneOf(job, variant);
    if (home !== undefined) {
      const at = anchor.clone().addScaledVector(new THREE.Vector3(ax, 0, az), home - 4.2);
      at.y = yFn(at.x, at.z);
      return make({ job, variant, anchor: at, face: Math.atan2(ax, az) + homeTurn, M, seed: state.seed, id });
    }
    // turned 1.1 rad from the camera side (a profile view of the work), or as the scene asks
    return make({ job, variant, anchor, face: face ?? Math.atan2(ax, az) + (sceneOf(job, variant).turn ?? 1.1), M, seed: state.seed, id, t0 });
  };
  if (plan) for (const tg of plan.targets) {
    if (tg.kind === 'villager' && barScene(tg.variant) && buildings.items.tavern) {
      // the innkeeper or brewer behind the bar of the tavern (owner 2026-10-23), a visitor at the counter
      // or the bard playing in the corner by the fireplace
      const bar = tg.variant === 'inn' ? buildTavernInterior({ item: buildings.items.tavern, M, seed: state.seed, minstrel: { name: tg.label.title } })
        : buildTavernInterior({ item: buildings.items.tavern, M, seed: state.seed, keepers: [{ name: tg.label.title, job: tg.sceneJob }], bar: true, guest: tg.guest || null });
      interiors.push({ ws: bar, tg });
      tg.cam = bar.cam;
      tg.pos.copy(bar.focus);
      tg.labelPos.copy(bar.labelPos);
      if (tg.guest) tg.labelPos2 = bar.labelPos2;
    } else if (tg.kind === 'villager' && AWAY_VARIANTS.has(tg.variant)) {
      // away from the croft, with the big name label: a guard on the castle walls, sparring in the courtyard
      // or on the night watch; a fisherman out in a boat
      const hero = { id: tg.id, name: tg.label.title, job: tg.sceneJob };
      const st = awayScene(tg.variant, hero, houses.shapes.get(state.villagers[tg.id].house), tg.guest);
      if (!st) continue;
      // a guest the scene has no place for gets no name tag (only the river scenes take one)
      if (tg.guest) { if (st.labelPos2) tg.labelPos2 = st.labelPos2; else tg.label2 = null; }
      st.setWindow?.(tg.t0, tg.t1);
      scene.add(st.group);
      tg.cam = st.cam;
      tg.labelPos = st.labelPos;
      tg.pos.copy(st.focus);
      if (st.work) tg.work = st.work;
      stories.push({ st, tg });
    } else if (tg.kind === 'villager') {
      const v = state.villagers[tg.id];
      const { anchor, ax, az, floorAt, face, cam } = workPlace(tg.sceneJob || v.job, houses.shapes.get(v.house), tg.variant, tg.id);
      tg.away = Math.atan2(az, ax);
      const ws = workScene({ job: tg.sceneJob || v.job, variant: tg.variant, anchor, ax, az, away: tg.away, id: tg.id, face, t0: tg.t0 });
      scene.add(ws.group);
      if (ws.room) { scene.add(ws.room); interiors.push({ ws, tg }); tg.cam = (u) => ws.cam(u, !!tg.guest); } else works.push(ws);
      if (cam) tg.cam = cam; // a place with its own camera (down an alley)
      tg.work = ws;
      tg.pos.copy(ws.focus);
      tg.labelPos.copy(ws.labelPos);
      if (ws.radius) tg.radius = ws.radius;
      if (tg.guest) {
        // a second named villager walks in: frame them both, a little wider
        const visit = buildVisit({ host: ws, hostJob: tg.sceneJob || v.job, guest: tg.guest, pair: tg.pair, away: tg.away, M, yFn: ws.floorAt || floorAt || yFn, t0: tg.t0, t1: tg.t1 });
        scene.add(visit.group);
        stories.push({ st: visit, tg });
        tg.labelPos2 = visit.labelPos2;
        if (visit.work) tg.work = visit.work;
        tg.pos.lerp(visit.stand.clone().setY(visit.stand.y + 1.1), 0.4);
        tg.radius = 7.8;
      }
    } else if (tg.kind === 'caravan') {
      caravan = buildCaravan({ w, named: diff.named.map((n) => ({ name: n.name, job: n.job })), M, seed: state.seed, yFn });
      if (!caravan) continue;
      scene.add(caravan.group);
      tg.labels = caravan.labels;
      tg.track = (t) => caravan.headAt(t, tg.t0);
      tg.banner = data.lang === 'it' ? `La carovana: ${caravan.count} nuov${caravan.count === 1 ? 'o arrivo' : 'i arrivi'}` : `The caravan: ${caravan.count} newcomer${caravan.count === 1 ? '' : 's'}`;
      tg.caravan = caravan;
    } else if (tg.kind === 'tavern') {
      tavern = buildTavernInterior({ item: buildings.items.tavern, M, seed: state.seed, patrons: tg.patrons, keepers: tg.keepers, musician: tg.musician });
      tg.labels = tavern.labels;
      tg.cam = tavern.cam;
      tg.banner = data.lang === 'it' ? 'La Taverna' : 'The Tavern';
    } else if (tg.kind === 'church') {
      church = buildChurchInterior({ item: buildings.items[tg.id], kind: tg.id, M, seed: state.seed, clergy: tg.clergy, worshippers: tg.worshippers });
      tg.labels = church.labels;
      tg.cam = church.cam;
      tg.banner = data.lang === 'it' ? (tg.id === 'cathedral' ? 'La Cattedrale' : 'La Cappella') : tg.id === 'cathedral' ? 'The Cathedral' : 'The Chapel';
    } else if (tg.kind === 'event') {
      const st = buildStory({ story: tg.story, w, state, M, buildings, houses, yFn, seed: state.seed, lang: data.lang, water });
      if (!st) continue;
      scene.add(st.group);
      st.setWindow?.(tg.t0, tg.t1);
      tg.labels = st.labels;
      tg.cam = st.cam;
      tg.banner = st.banner;
      if (st.phase !== undefined) tg.phase = st.phase;
      if (st.work) tg.work = st.work; // arrows hitting the targets
      if (st.focus) tg.pos.copy(st.focus);
      stories.push({ st, tg });
    } else if (tg.kind === 'ambient') {
      const st = ambientScene(tg.id, tg.hero);
      if (!st) continue;
      scene.add(st.group);
      tg.labels = st.labels;
      tg.cam = st.cam;
      tg.banner = st.banner;
      tg.pos.copy(st.focus);
      if (st.work) tg.work = st.work;
      stories.push({ st, tg });
    }
  }
  // builders at each building going up (owner 2026-10-24). The vertical frame is narrow, so they stand in a loose group on
  // the line from the camera (halfway through its move round the building, timeline.js) to the building, low in the frame;
  // never inside a building (they step back out of it toward the camera), over water, in a house or on another lot. Seen
  // only during the building's shot
  const crews = [];
  const SPOTS = [[-0.9, 0], [0.8, 0.1], [0.05, -0.08], [-0.4, 0.17], [1.3, 0.06]]; // across the view (x D/8) and deeper (x D/10), at least 1.7 m and 1.3 m
  if (plan) for (const tg of plan.targets) {
    const item = tg.kind === 'building' && tg.builders?.length && buildings.items[tg.id], lot = item?.lot;
    if (!lot || !(lot.hw > 0) || lot.onWater) continue;
    const others = Object.values(buildings.items).filter((it) => it !== item && it.lot?.hw > 0 && it !== buildings.items[lot.onPlaza]);
    const r = tg.radius, a = tg.front + 0.2, f = tg.pos;
    const cam = new THREE.Vector3(f.x + Math.cos(a) * r, 0, f.z + Math.sin(a) * r);
    const dir = new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a)), side = new THREE.Vector3(-dir.z, 0, dir.x);
    // the ground 16 degrees below the middle of the frame for a small building, 11 for the others (their name tags stay
    // above the captions)
    const H = f.y + r * 0.5 - floorOf(f.x, f.z), D = H / Math.tan(Math.atan((r * 0.5 + 2) / r) + (r < 20 ? 0.28 : 0.19));
    const wide = Math.max(D / 8, 1.7), deep = Math.max(D / 10, 1.3);
    const labels = [];
    tg.builders.forEach((b, i) => {
      const [across, deeper] = SPOTS[i % SPOTS.length];
      const spot = cam.clone().addScaledVector(dir, D + deep * 10 * deeper).addScaledVector(side, wide * across);
      // squares (the wards, the market) are open paving: builders may stand on them
      for (let k = 0; k < 60 && !lot.plaza && pointInObb(grow(lot, 1.2), spot.x, spot.z); k++) spot.addScaledVector(dir, -0.5);
      if (heightAt(w, spot.x, spot.z) < WATER_LEVEL + 0.3 || inHouse(spot, null, 0.8) || others.some((it) => pointInObb(grow(it.lot, 0.3), spot.x, spot.z))) return;
      spot.y = floorOf(spot.x, spot.z);
      const [job, variant] = b.role.split(':');
      // side on to the camera, half of them each way (the one with the plan looks toward the building)
      const turn = (sceneOf(job, variant).turn ?? 1.1) * (i % 2 ? -1 : 1);
      const ws = buildWorkScene({ job, variant, anchor: spot, face: Math.atan2(-dir.x, -dir.z) + turn, M, seed: state.seed, id: b.id, color: JOBS[b.job]?.color, t0: tg.t0 });
      ws.group.visible = false;
      scene.add(ws.group);
      crews.push({ ws, tg });
      labels.push({ pos: spot.clone().setY(spot.y + 2.1), title: b.name, sub: b.sub });
    });
    if (labels.length) tg.labels = labels;
  }
  // test renders (--gallery): every work scene and visit asked for, one at a time, in the croft behind the
  // first named villager's house (kept clear like in the video)
  if (data.gallery) {
    const sh = houses.shapes.get(state.villagers[Number(Object.keys(state.names || {})[0] ?? 0)].house);
    const ax = -Math.sin(sh.rot) * sh.side, az = Math.cos(sh.rot) * sh.side;
    const anchor = new THREE.Vector3(sh.x + ax * (sh.D / 2 + 4.2), 0, sh.z + az * (sh.D / 2 + 4.2));
    anchor.y = yFn(anchor.x, anchor.z);
    const away = Math.atan2(az, ax);
    ctx0.galleryAway = away;
    ctx0.gallery = data.gallery.map((g, i) => {
      if (AWAY_VARIANTS.has(g.variant) || g.job === 'ambient') { // scenes with their own camera, played over 3 s
        const st = g.job === 'ambient' ? ambientScene(g.variant, { id: 9100 + i, name: 'Test', job: 'peasant' }) : awayScene(g.variant, { id: 9100 + i, name: 'Test', job: g.job }, sh, g.guest ? { job: g.guest } : null);
        st.setWindow?.(0, 3);
        scene.add(st.group);
        return { ws: { group: st.group, update: (t) => st.update(t, 0, 3) }, st, focus: st.focus };
      }
      if (barScene(g.variant) && buildings.items.tavern) {
        const bar = g.variant === 'inn' ? buildTavernInterior({ item: buildings.items.tavern, M, seed: state.seed, minstrel: { name: 'Test' } })
          : buildTavernInterior({ item: buildings.items.tavern, M, seed: state.seed, keepers: [{ name: 'Test', job: g.job }], bar: true, guest: g.guest ? { name: 'Guest', job: g.guest } : null });
        return { ws: { group: bar.group, room: bar.group, update: bar.update, cam: bar.cam }, focus: bar.focus };
      }
      const at = workPlace(g.job, sh, g.variant, i), gAway = Math.atan2(at.az, at.ax);
      const ws = workScene({ job: g.job, variant: g.variant, anchor: at.anchor, ax: at.ax, az: at.az, away: gAway, id: 9100 + i, face: at.face });
      scene.add(ws.group);
      if (ws.room) scene.add(ws.room);
      const visit = g.guest ? buildVisit({ host: ws, hostJob: g.job, guest: { job: g.guest }, pair: g.pair, away: gAway, M, yFn: ws.floorAt || at.floorAt || yFn, t0: 0, t1: 3 }) : null;
      if (visit) scene.add(visit.group);
      return { ws, visit, away: gAway, cam: at.cam, focus: visit ? ws.focus.clone().lerp(visit.stand.clone().setY(visit.stand.y + 1.1), 0.4) : ws.focus };
    });
  }
  const env = buildEnvironment(renderer, scene, camera, { viewer, weather: diff.weather, seed: state.seed, width: width * renderer.getPixelRatio(), height: height * renderer.getPixelRatio(), quality: data.quality || (viewer ? 'high' : 'medium') });
  const overlay = viewer ? null : createOverlay(document.getElementById('stage'), data);

  const ctx = { ...ctx0, renderer, scene, camera, env, plan, castle, houses, animated, buildings, nature, life, water, M, overlay, data, w, works, interiors, caravan, tavern, church, stories, crews };
  ctx.stats = {
    setupMs: Math.round(performance.now() - t0), houses: state.houses.length, animated: animated.size, trees: nature.count,
    walkers: life.walkers, guards: life.guards, targets: plan?.targets.map((t) => `${t.kind}:${t.id ?? ''}`),
    // what each shot shows, for the sound effects track
    cues: plan?.targets.map((t, i) => ({
      kind: t.kind, id: t.id ?? null, t0: t.t0, t1: t.t1, completed: t.completed ?? null, rebuilt: !!t.rebuilt, raised: !!t.raised, pan: i % 2 ? 0.25 : -0.25,
      hasChapel: state.buildings.some((b) => (b.id === 'chapel' || b.id === 'cathedral') && b.status === 'done'),
      job: t.sceneJob ?? t.job ?? null, variant: t.variant ?? null, job2: t.guest?.job ?? null, pair: t.pair ?? null, strikes: t.work ? t.work.strikeTimes(t.t0, t.t1) : [], strikeSound: t.work?.sound ?? null,
    })) ?? [],
  };
  window.__ctx = ctx;
  if (viewer) startViewer(ctx);
  return ctx.stats;
}

// interiors film with a wider lens (bakery.js); the usual lens everywhere else
function setFov(camera, fov) {
  camera.userData.fov0 ??= camera.fov;
  const f = fov || camera.userData.fov0;
  if (camera.fov !== f) { camera.fov = f; camera.updateProjectionMatrix(); }
}

function applyFrame(ctx, t) {
  const { plan, camera, env, castle, animated, buildings, life, water, M, houses, nature, overlay, renderer } = ctx;
  for (const ws of ctx.works || []) ws.update(t);
  for (const { ws, tg } of ctx.crews || []) {
    ws.group.visible = t >= tg.t0 - 0.1 && t <= tg.t1 + 0.1;
    if (ws.group.visible) ws.update(t);
  }
  const ct = ctx.caravan && plan.targets.find((x) => x.kind === 'caravan');
  if (ct) ctx.caravan.update(t, ct.t0, ct.t1);
  let quiet = false; // a guard scene on the castle walls is on: no other guards walking through it
  for (const { st, tg } of ctx.stories || []) {
    st.update(t, tg.t0, tg.t1);
    if (st.quietCastle && t >= tg.t0 - 0.1 && t <= tg.t1 + 0.1) quiet = true;
    if (st.bannerAt) tg.banner = st.bannerAt(t, tg.t0, tg.t1); // a title that changes (the New Year countdown)
  }
  const ev = evaluate(plan, t);
  const inside = ev.active?.kind === 'tavern' || ev.active?.kind === 'church' || !!ev.active?.interior;
  if (ctx.tavern) ctx.tavern.update(t, ev.active?.kind === 'tavern');
  if (ctx.church) ctx.church.update(t, ev.active?.kind === 'church');
  for (const { ws, tg } of ctx.interiors || []) ws.update(t, ev.active === tg);
  // flights between shots can dip into a hill: keep the camera a few metres above the ground (less in the
  // villager shots, which film people from eye level and below)
  const low = !ev.flying && ev.active?.kind === 'villager';
  const ground = heightAt(ctx.w, ev.camera.pos.x, ev.camera.pos.z) + (low ? 0.6 : 3);
  if (!inside && ev.camera.pos.y < ground) ev.camera.pos.y = ground;
  setFov(camera, ev.camera.fov);
  camera.position.copy(ev.camera.pos);
  camera.lookAt(ev.camera.look);
  camera.updateMatrixWorld();
  const night = env.set(ev.phase, ev.camera.look, ev.shadowRadius, t, inside ? 1 : 0);
  M.setNight(night);
  castle.update(t, { bridgeOpen: ev.bridge });
  for (const [id, a] of animated) a.set(ev.progress.has('h' + id) ? ev.progress.get('h' + id) : 1);
  for (const [k, p] of ev.progress) if (k[0] === 'b') {
    const id = k.slice(1);
    const it = buildings.items[id];
    const bd = ctx.data.state.buildings.find((b) => b.id === id);
    if (!it || !bd) continue;
    const target = bd.status === 'done' ? 1 : Math.max(0.08, 1 - (ctx.data.state.pendingConstruction.find((x) => x.building === id)?.daysLeft ?? 0) / (bd.daysTotal || 1));
    const start = bd.status === 'done' ? (bd.daysTotal ? Math.max(0, target - 0.25) : 1) : 0;
    it.setProgress(start + (target - start) * p);
  }
  water.userData.uniforms.time.value = t;
  life.update(t, { night, camera, wind: [1, 0.35], viewportH: renderer.domElement.height });
  life.hideGuards(quiet || !!ctx.galleryQuiet);
  houses.updateLod(camera);
  nature.updateLod(camera);
  env.composer.render();
  overlay?.update(t, ev, camera);
  return ev;
}

/** Debug/thumbnail: render time t from an arbitrary camera pose. */
async function shot(pos, look, t = 10, phase, interior = 0, fov) {
  const ctx = window.__ctx;
  const ev = applyFrame(ctx, t);
  setFov(ctx.camera, fov);
  ctx.camera.position.set(...pos);
  ctx.camera.lookAt(...look);
  ctx.camera.updateMatrixWorld();
  const night = ctx.env.set(phase ?? ev.phase, new (ctx.camera.position.constructor)(...look), interior ? 12 : 160, t, interior);
  ctx.M.setNight(night);
  ctx.houses.updateLod(ctx.camera);
  ctx.nature.updateLod(ctx.camera);
  ctx.env.composer.render();
  document.getElementById('ov') && (document.getElementById('ov').style.display = 'none');
  return true;
}

/** Test renders: gallery scene i at time t, seen from `angle` around it (the croft shots' side). */
async function galleryShot(i, t, turn = 0.25) {
  const ctx = window.__ctx;
  const angle = (ctx.gallery[i].away ?? ctx.galleryAway) + turn;
  // only the scene asked for: hide the video's own work scenes (the first one is in this same croft)
  for (const ws of [...ctx.works, ...ctx.interiors.map((x) => x.ws)]) { ws.group.visible = false; if (ws.room) ws.room.visible = false; }
  ctx.gallery.forEach((g, k) => { g.ws.group.visible = k === i; if (g.ws.room) g.ws.room.visible = k === i; if (g.visit) g.visit.group.visible = k === i; });
  const g = ctx.gallery[i];
  ctx.galleryQuiet = false;
  applyFrame(ctx, 10);
  for (const { st } of ctx.stories) st.group.visible = false;
  g.ws.update(t, !!g.ws.room);
  g.visit?.update(t);
  if (g.visit) g.visit.group.visible = true;
  if (g.st) {
    g.st.group.visible = true;
    ctx.galleryQuiet = !!g.st.quietCastle; // shot() below applies the frame again
    const c = g.st.cam(Math.min(1, t / 3));
    return shot(c.pos.toArray(), c.look.toArray(), 10, g.st.phase);
  }
  if (g.cam) { const c = g.cam(Math.min(1, t / 3)); return shot(c.pos.toArray(), c.look.toArray(), 10); }
  if (g.ws.room) { // inside the bakehouse or the tavern: its own camera and lights (the gallery shot lasts 3 s)
    const c = g.ws.cam(Math.min(1, t / 3), !!g.visit);
    return shot(c.pos.toArray(), c.look.toArray(), 10, undefined, 1, c.fov);
  }
  const pos = [g.focus.x + Math.cos(angle) * 7, g.focus.y + 1.2, g.focus.z + Math.sin(angle) * 7];
  return shot(pos, [g.focus.x, g.focus.y - 0.1, g.focus.z], 10);
}

async function frame(f) {
  const ctx = window.__ctx;
  const ev = applyFrame(ctx, f / FPS);
  return { section: ev.section };
}

function startViewer(ctx) {
  const { renderer, camera, env, M, life, water, castle, houses, nature } = ctx;
  const controls = new OrbitControls(camera, renderer.domElement);
  camera.position.set(190, 120, 190);
  controls.target.set(60, 8, 0);
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 15;
  controls.maxDistance = 2600;
  controls.enableDamping = true;
  window.__controls = controls; // for debugging views from the console
  const slider = document.getElementById('time');
  const start = performance.now();
  const loop = () => {
    const t = (performance.now() - start) / 1000;
    controls.update();
    const phase = slider ? Number(slider.value) / 100 : 0.3;
    const dist = camera.position.distanceTo(controls.target);
    const night = env.set(phase, controls.target, Math.min(700, Math.max(90, dist * 0.9)), t);
    M.setNight(night);
    castle.update(t, { bridgeOpen: 1 });
    water.userData.uniforms.time.value = t;
    life.update(t, { night, camera, wind: [1, 0.35], viewportH: renderer.domElement.height });
    houses.updateLod(camera);
    nature.updateLod(camera);
    const t1 = performance.now();
    renderer.info.autoReset = false;
    renderer.info.reset();
    env.composer.render();
    const info = renderer.info.render;
    window.__info = { calls: info.calls, triangles: info.triangles, frameMs: Math.round(performance.now() - t1), frames: (window.__info?.frames || 0) + 1 };
    requestAnimationFrame(loop);
  };
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    env.composer.setSize(window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio());
  });
  loop();
}

window.SK = { setup, frame, shot, galleryShot, CASTLE };
if (window.__KINGDOM__) {
  setup(window.__KINGDOM__).then((s) => { window.__ready = s; }).catch((e) => { console.error(e); window.__error = String(e?.stack || e); });
}
