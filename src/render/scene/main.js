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
import { makePlan, evaluate } from './timeline.js';
import { createOverlay } from './overlay.js';
import { buildWorkScene } from './work.js';
import { buildCaravan } from './caravan.js';
import { buildTavernInterior } from './tavern.js';
import { buildStory } from './stories/index.js';
import { buildPatrol, buildFields } from './ambient.js';
import { buildSparring, buildDummyDrill } from './drills.js';
import { heightAt } from '../../sim/world.js';

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
  terrain.userData.uniforms.snow.value = diff.weather === 'snow' ? 0.85 : 0;
  scene.add(terrain);
  const water = buildWater(w);
  scene.add(water);
  const castle = buildCastle(M);
  scene.add(castle.group);

  // houses built or rebuilt today are animated individually in the video
  const todays = viewer ? [] : [...diff.housesBuilt, ...diff.housesRebuilt].slice(0, 60);
  const animatedIds = new Set(todays);
  const houses = buildHouses(state, w, M, { animatedIds });
  scene.add(houses.group);
  const animated = new Map();
  for (const id of todays) {
    const h = state.houses.find((x) => x.id === id);
    const a = buildAnimatedHouse(houses.shapes.get(id), h, state.seed, M, houses);
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
  let caravan = null, tavern = null;
  const stories = [];
  const yFn = (x, z) => heightAt(w, x, z) + 0.03;
  if (plan) for (const tg of plan.targets) {
    if (tg.kind === 'villager' && (tg.variant === 'walls' || tg.variant === 'sparring')) {
      // a guard on the castle walls or sparring in the courtyard, with the big name label
      const hero = { id: tg.id, name: tg.label.title, job: tg.sceneJob };
      const st = tg.variant === 'walls' ? buildPatrol({ castle, M, hero, lang: data.lang, tag: false }) : buildSparring({ M, seed: state.seed, hero, lang: data.lang, tag: false });
      scene.add(st.group);
      tg.cam = st.cam;
      tg.labelPos = st.labelPos;
      tg.pos.copy(st.focus);
      if (st.work) tg.work = st.work;
      stories.push({ st, tg });
    } else if (tg.kind === 'villager') {
      const v = state.villagers[tg.id];
      const sh = houses.shapes.get(v.house);
      const c = Math.cos(sh.rot), s = Math.sin(sh.rot);
      const ax = -s * sh.side, az = c * sh.side; // from the house toward its croft
      const anchor = new THREE.Vector3(sh.x + ax * (sh.D / 2 + 4.2), 0, sh.z + az * (sh.D / 2 + 4.2));
      anchor.y = yFn(anchor.x, anchor.z);
      const make = tg.variant === 'dummy' ? buildDummyDrill : buildWorkScene;
      const ws = make({ job: tg.sceneJob || v.job, anchor, face: Math.atan2(ax, az) + 1.1, M, seed: state.seed, id: tg.id });
      scene.add(ws.group);
      works.push(ws);
      tg.work = ws;
      tg.pos.copy(ws.focus);
      tg.labelPos.copy(ws.labelPos);
      tg.away = Math.atan2(az, ax);
    } else if (tg.kind === 'caravan') {
      caravan = buildCaravan({ w, named: diff.named.map((n) => ({ name: n.name, job: n.job })), M, seed: state.seed, yFn });
      if (!caravan) continue;
      scene.add(caravan.group);
      tg.labels = caravan.labels;
      tg.track = (t) => caravan.headAt(t, tg.t0);
      tg.banner = data.lang === 'it' ? `La carovana: ${caravan.count} nuov${caravan.count === 1 ? 'o arrivo' : 'i arrivi'}` : `The caravan: ${caravan.count} newcomer${caravan.count === 1 ? '' : 's'}`;
      tg.caravan = caravan;
    } else if (tg.kind === 'tavern') {
      tavern = buildTavernInterior({ item: buildings.items.tavern, M, seed: state.seed, patrons: tg.patrons, keepers: tg.keepers });
      tg.labels = tavern.labels;
      tg.cam = tavern.cam;
      tg.banner = data.lang === 'it' ? 'La Taverna' : 'The Tavern';
    } else if (tg.kind === 'event') {
      const st = buildStory({ story: tg.story, w, state, M, buildings, houses, yFn, seed: state.seed, lang: data.lang });
      if (!st) continue;
      scene.add(st.group);
      st.setWindow?.(tg.t0, tg.t1);
      tg.labels = st.labels;
      tg.cam = st.cam;
      tg.banner = st.banner;
      if (st.phase !== undefined) tg.phase = st.phase;
      if (st.focus) tg.pos.copy(st.focus);
      stories.push({ st, tg });
    } else if (tg.kind === 'ambient') {
      const st = tg.id === 'patrol' ? buildPatrol({ castle, M, hero: tg.hero, lang: data.lang })
        : tg.id === 'sparring' ? buildSparring({ M, seed: state.seed, hero: tg.hero, lang: data.lang })
          : buildFields({ w, M, seed: state.seed, hero: tg.hero, lang: data.lang });
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
  const env = buildEnvironment(renderer, scene, camera, { viewer, weather: diff.weather, seed: state.seed, width: width * renderer.getPixelRatio(), height: height * renderer.getPixelRatio(), quality: data.quality || (viewer ? 'high' : 'medium') });
  const overlay = viewer ? null : createOverlay(document.getElementById('stage'), data);

  const ctx = { renderer, scene, camera, env, plan, castle, houses, animated, buildings, nature, life, water, M, overlay, data, w, works, caravan, tavern, stories };
  ctx.stats = {
    setupMs: Math.round(performance.now() - t0), houses: state.houses.length, animated: animated.size, trees: nature.count,
    walkers: life.walkers, guards: life.guards, targets: plan?.targets.map((t) => `${t.kind}:${t.id ?? ''}`),
    // what each shot shows, for the sound effects track
    cues: plan?.targets.map((t, i) => ({
      kind: t.kind, id: t.id ?? null, t0: t.t0, t1: t.t1, completed: t.completed ?? null, rebuilt: !!t.rebuilt, pan: i % 2 ? 0.25 : -0.25,
      hasChapel: state.buildings.some((b) => (b.id === 'chapel' || b.id === 'cathedral') && b.status === 'done'),
      job: t.sceneJob ?? t.job ?? null, variant: t.variant ?? null, strikes: t.work ? t.work.strikeTimes(t.t0, t.t1) : [], strikeSound: t.work?.sound ?? null,
    })) ?? [],
  };
  window.__ctx = ctx;
  if (viewer) startViewer(ctx);
  return ctx.stats;
}

function applyFrame(ctx, t) {
  const { plan, camera, env, castle, animated, buildings, life, water, M, houses, nature, overlay, renderer } = ctx;
  for (const ws of ctx.works || []) ws.update(t);
  const ct = ctx.caravan && plan.targets.find((x) => x.kind === 'caravan');
  if (ct) ctx.caravan.update(t, ct.t0, ct.t1);
  for (const { st, tg } of ctx.stories || []) st.update(t, tg.t0, tg.t1);
  const ev = evaluate(plan, t);
  const inside = ev.active?.kind === 'tavern';
  if (ctx.tavern) ctx.tavern.update(t, inside);
  // flights between shots can dip into a hill: keep the camera a few metres above the ground (less in the
  // villager shots, which film people from eye level and below)
  const low = !ev.flying && ev.active?.kind === 'villager';
  const ground = heightAt(ctx.w, ev.camera.pos.x, ev.camera.pos.z) + (low ? 0.6 : 3);
  if (!inside && ev.camera.pos.y < ground) ev.camera.pos.y = ground;
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
  houses.updateLod(camera);
  nature.updateLod(camera);
  env.composer.render();
  overlay?.update(t, ev, camera);
  return ev;
}

/** Debug/thumbnail: render time t from an arbitrary camera pose. */
async function shot(pos, look, t = 10, phase) {
  const ctx = window.__ctx;
  const ev = applyFrame(ctx, t);
  ctx.camera.position.set(...pos);
  ctx.camera.lookAt(...look);
  ctx.camera.updateMatrixWorld();
  const night = ctx.env.set(phase ?? ev.phase, new (ctx.camera.position.constructor)(...look), 160, t);
  ctx.M.setNight(night);
  ctx.houses.updateLod(ctx.camera);
  ctx.nature.updateLod(ctx.camera);
  ctx.env.composer.render();
  document.getElementById('ov') && (document.getElementById('ov').style.display = 'none');
  return true;
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

window.SK = { setup, frame, shot, CASTLE };
if (window.__KINGDOM__) {
  setup(window.__KINGDOM__).then((s) => { window.__ready = s; }).catch((e) => { console.error(e); window.__error = String(e?.stack || e); });
}
