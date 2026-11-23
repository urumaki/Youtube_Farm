// The treasure of the Mine (owner 2026-11-23, src/sim/stories.js `treasure`): three days that take the whole video, one shot
// after another (timeline.js, TREASURE_SHOTS). Underground, so any weather: a set of its own deep under the castle mound
// (like the throne room), lit only by the lanterns the crew carries and a few on the timbers.
// Day 1 ('breach'): the miners at the end of the gallery, a pick rings hollow, cracks run, the wall falls in, an old tunnel
// behind it (cut stone, an arch, steps down), the old miner holds a lantern to old carvings, a cold draught bends the flames:
// "To be continued...". Day 2 ('tunnel'): the expedition with lanterns and a rope, down the old steps, a great cavern, a
// rumble, rocks come down behind them and close the way back (nobody hurt, they jump clear): "Trapped!". Day 3 ('gold'):
// the old miner feels the draught and leads on, a side chamber with an iron-bound chest of old coins, they dig up through
// loose earth into daylight, and carry the chest through the market to the cheers (then the usual wide shot, goal and call
// to action). The crew (story.crew): four miners (the fourth the old hand who reads the rock) and a guard (owner 2026-11-23: no
// scholar in the Mine); names on all of them.
// Frame: +z back toward the gallery's mouth, the crew goes toward -z; y up from the gallery's floor.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { CASTLE } from '../../../sim/world.js';
import { Builder, boxGeo, cylGeo } from '../kit.js';
import { toolGeo, particles } from '../work.js';
import { person, stride, stage, castTag, flameMaterial, flicker, ease, clamp01, apart } from './common.js';

export const TREASURE_SHOTS = {
  breach: [['dig', 0, 5], ['hollow', 5, 10], ['fall', 10, 15], ['passage', 15, 21], ['draught', 21, 30]],
  tunnel: [['ready', 0, 4.5], ['descend', 4.5, 10], ['cavern', 10, 15], ['rumble', 15, 21], ['trapped', 21, 30]],
  gold: [['follow', 0, 4.5], ['chest', 4.5, 10], ['daylight', 10, 15], ['home', 15, 23.5]],
};
const WALL = -12; // the end of the gallery, where they break through
const STEPS0 = -16, STEPS1 = -26, DROP = 3; // the old steps down (z), and how far down they go
const CAV = -37, CAVR = 10; // the cavern's middle (z) and radius
const FALL = -27.5; // where the rocks come down (the cavern's mouth)
const CHEST = new THREE.Vector3(5.2, -DROP, -43);
const EXIT = new THREE.Vector3(-4, -DROP, -46.5);
const BASE = new THREE.Vector3(0, CASTLE.ground - 180, 0); // deep under the castle mound, below the Guild Hall
const lerp = THREE.MathUtils.lerp;
const span = (u, a, b) => clamp01((u - a) / (b - a));
/** The floor's height at z (the gallery, the steps down, the cavern). */
const floorY = (z) => (z > STEPS0 ? 0 : z < STEPS1 ? -DROP : -DROP * (STEPS0 - z) / (STEPS0 - STEPS1));

let SET = null;
/** The whole underground, built once per render and shared by the shots. */
function underground(M, seed) {
  if (SET && SET.M === M) return SET;
  const group = new THREE.Group(); // (at the shot group's origin: each shot takes it while on screen, `lights`)
  const b = new Builder();
  // the gallery: floor, rough walls, ceiling, timber sets
  b.add('dirt', boxGeo(4, 0.3, 16), 0, -0.15, -4);
  b.add('rock', boxGeo(5, 4, 0.6), 0, 1.8, 4.2); // the gallery's far end (the way up to the yard is out of sight)
  for (const s of [-1, 1]) b.add('rock', boxGeo(0.6, 3.6, 16), s * 2.3, 1.8, -4);
  b.add('rock', boxGeo(5, 0.5, 16), 0, 3.55, -4);
  for (let z = 2; z > WALL + 1; z -= 2.3) {
    for (const s of [-1, 1]) b.add('woodDark', boxGeo(0.22, 3.3, 0.22), s * 1.8, 1.65, z);
    b.add('woodDark', boxGeo(3.9, 0.25, 0.25), 0, 3.25, z);
  }
  // the rails of the ore carts
  for (const s of [-1, 1]) b.add('iron', boxGeo(0.06, 0.06, 14), s * 0.45, 0.03, -4);
  // the old tunnel behind the wall: cut stone, arches, the steps down
  for (let z = WALL - 0.5; z > STEPS1 - 1; z -= 1) {
    const y = floorY(z);
    b.add('stoneDark', boxGeo(3, 0.3, 1), 0, y - 0.15, z);
    for (const s of [-1, 1]) b.add('stoneDark', boxGeo(0.5, 3.4, 1), s * 1.75, y + 1.7, z);
    b.add('stoneDark', boxGeo(4, 0.4, 1), 0, y + 3.4, z);
  }
  for (let z = WALL - 2; z > STEPS1; z -= 3.2) {
    const y = floorY(z);
    for (const s of [-1, 1]) b.add('stone', boxGeo(0.4, 2.9, 0.4), s * 1.35, y + 1.45, z);
    b.add('stone', boxGeo(3.1, 0.4, 0.45), 0, y + 3.0, z);
  }
  // the carvings on the left wall near the breach: rings and lines cut in the stone
  for (let i = 0; i < 5; i++) b.add('gold', boxGeo(0.03, 0.08, 0.6), -1.48, 1.2 + i * 0.3, WALL - 2.6 - (i % 2) * 0.3);
  // the cavern floor
  b.add('dirt', boxGeo(26, 0.3, 26), 0, -DROP - 0.15, CAV);
  // a broken arch and the plinth of the chest's chamber
  b.add('stone', boxGeo(0.6, 2.6, 0.6), CHEST.x - 1.6, -DROP + 1.3, CHEST.z + 0.8);
  b.add('stone', boxGeo(0.6, 1.4, 0.6), CHEST.x + 1.6, -DROP + 0.7, CHEST.z + 0.8);
  b.add('stone', boxGeo(2.4, 0.45, 0.6), CHEST.x - 0.7, -DROP + 2.75, CHEST.z + 0.8, 0, 0, -0.25);
  b.add('stone', boxGeo(2.2, 0.3, 1.6), CHEST.x, -DROP + 0.15, CHEST.z);
  // the way out: a slope of loose earth up to the surface
  for (let k = 0; k < 6; k++) b.add('dirt', boxGeo(2.6, 0.45 * (k + 1), 0.9), EXIT.x, -DROP + 0.225 * (k + 1), EXIT.z - 0.5 - k * 0.85);
  group.add(b.build(M));
  // the cavern's dome (seen from inside) and its stalactites and stalagmites
  const dome = new THREE.Mesh(new THREE.SphereGeometry(CAVR + 2, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6b645a', roughness: 1, side: THREE.BackSide, flatShading: true }));
  dome.scale.set(1, 0.55, 1);
  dome.position.set(0, -DROP - 0.2, CAV);
  group.add(dome);
  const crag = M.crag || M.rock;
  for (let i = 0; i < 30; i++) {
    const a = rand01(seed, 'tst', i) * 6.28, r = 3 + rand01(seed, 'tst', i, 1) * (CAVR - 3);
    const x = Math.cos(a) * r, z = CAV + Math.sin(a) * r;
    if (Math.hypot(x - CHEST.x, z - CHEST.z) < 2.6 || Math.hypot(x - EXIT.x, z - EXIT.z) < 2.5 || Math.abs(x) < 2.2) continue;
    const h = 0.6 + rand01(seed, 'tst', i, 2) * 1.8, up = i % 2;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.25 + h * 0.15, h, 6), crag);
    c.position.set(x, up ? -DROP + h / 2 : -DROP + (CAVR + 2) * 0.55 * Math.sqrt(Math.max(0, 1 - (r / (CAVR + 2)) ** 2)) - h / 2 - 0.3, z);
    if (!up) c.rotation.x = Math.PI;
    group.add(c);
  }
  // the breach wall: blocks of rock that fall in on day 1 (and lie as rubble after)
  const blocks = [];
  for (let i = 0; i < 18; i++) {
    const x = -1.5 + (i % 6) * 0.6, y = 0.3 + Math.floor(i / 6) * 0.9;
    const m = new THREE.Mesh(boxGeo(0.62, 0.92, 0.7), M.rock);
    m.castShadow = true;
    group.add(m);
    blocks.push({ m, x, y, k: rand01(seed, 'tblk', i) });
  }
  const wallBack = new THREE.Mesh(boxGeo(3.8, 3.4, 0.4), M.rock); // behind the blocks (day 1, before the breach)
  wallBack.position.set(0, 1.7, WALL - 0.6);
  group.add(wallBack);
  // the rockfall at the cavern's mouth (day 2 falls, day 3 lies)
  const rocks = [];
  for (let i = 0; i < 22; i++) {
    const s = 0.5 + rand01(seed, 'trk', i) * 0.6;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), crag);
    m.castShadow = true;
    group.add(m);
    rocks.push({ m, x: -1.3 + rand01(seed, 'trk', i, 1) * 2.6, y: -DROP + 0.3 + (i % 5) * 0.55, z: FALL + (rand01(seed, 'trk', i, 2) - 0.5) * 1.2, d: rand01(seed, 'trk', i, 3) });
  }
  // the chest: iron-bound, its lid on a hinge, coins inside that shine
  const chest = new THREE.Group();
  const lid = new THREE.Group();
  const cb = (geo, mat, parent = chest) => { const o = new THREE.Mesh(geo, mat); o.castShadow = true; parent.add(o); return o; };
  cb(boxGeo(1.1, 0.6, 0.7).translate(0, 0.3, 0), M.woodDark);
  for (const x of [-0.45, 0, 0.45]) cb(boxGeo(0.06, 0.62, 0.72).translate(x, 0.31, 0), M.iron);
  lid.position.set(0, 0.6, -0.35);
  chest.add(lid);
  cb(cylGeo(0.35, 0.35, 1.1, 12, 4, false).rotateZ(Math.PI / 2).scale(1, 0.55, 1).translate(0, 0, 0.35), M.woodDark, lid);
  const coinMat = new THREE.MeshStandardMaterial({ color: '#ffcf40', metalness: 0.9, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.6 });
  for (let i = 0; i < 40; i++) cb(cylGeo(0.05, 0.05, 0.015, 10).translate(-0.45 + rand01(seed, 'tc', i) * 0.9, 0.56 + rand01(seed, 'tc', i, 1) * 0.05, -0.28 + rand01(seed, 'tc', i, 2) * 0.56), coinMat);
  chest.position.copy(CHEST).setY(CHEST.y + 0.3);
  group.add(chest);
  const glow = new THREE.PointLight('#ffc860', 0, 5, 1.5);
  glow.position.set(0, 0.9, 0);
  chest.add(glow);
  // daylight at the top of the slope (day 3), a disc of sky and a beam
  const sky = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20), new THREE.MeshBasicMaterial({ color: '#fff4d8' }));
  sky.scale.setScalar(1.4);
  sky.position.set(EXIT.x, -DROP + 3.6, EXIT.z - 5.6);
  group.add(sky);
  const sun = new THREE.SpotLight('#fff1cf', 0, 22, 0.5, 0.6, 1);
  sun.position.set(EXIT.x, -DROP + 4.5, EXIT.z - 7);
  sun.target.position.set(EXIT.x, -DROP, EXIT.z + 1);
  group.add(sun, sun.target);
  // a dim fill so the walls never go fully black, and the dust
  const fill = new THREE.PointLight('#8f7a5a', 0, 30, 1.2);
  group.add(fill);
  const dust = particles(120, '#b8a98c', 0.09, false);
  group.add(dust);
  SET = { M, group, blocks, wallBack, rocks, chest, lid, glow, sky, sun, fill, dust };
  return SET;
}

/** The crew as rigs with lanterns: [four miners..., guard] (null: a nameless miner). */
function crewOf(M, story, group) {
  const list = (story.crew || []).slice(0, 5);
  const jobs = ['miner', 'miner', 'miner', 'miner', 'guard'];
  return list.map((c, i) => {
    const job = c?.job || jobs[i];
    const P = person(M, JOBS[job]?.color || '#6a5a48');
    P.c = c || { name: null, job };
    P.i = i;
    const lantern = new THREE.Group();
    const add = (geo, mat) => { const o = new THREE.Mesh(geo, mat); lantern.add(o); return o; };
    add(boxGeo(0.16, 0.22, 0.16).translate(0, -0.12, 0), M.iron);
    const flame = add(new THREE.ConeGeometry(0.05, 0.14, 6).translate(0, -0.12, 0), flameMaterial('#ffcf70'));
    const light = new THREE.PointLight('#ffc27a', 0, 9, 1.6);
    light.position.set(0, -0.12, 0);
    lantern.add(light);
    P.l.hand.add(lantern);
    P.lantern = { lantern, flame, light };
    if (job === 'miner') { const pick = toolGeo('pick', M); P.r.hand.add(pick); P.pick = pick; }
    group.add(P.root);
    return P;
  });
}

/** The parts every shot has: the set (shown only while the shot is on), the crew, the lights, the tags. */
function shotBase(args) {
  const { story, M, seed } = args;
  const S = underground(M, seed);
  const group = new THREE.Group();
  group.position.copy(BASE);
  group.visible = false;
  const crew = crewOf(M, story, group);
  const tags = crew.filter((P) => P.c?.name).map((P) => ({ P, ...castTag(P.c), pos: new THREE.Vector3() }));
  const tmp = new THREE.Vector3();
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).add(BASE);
  const place = (ls) => { group.updateMatrixWorld(true); for (const l of ls) l.pos.copy(l.P.root.getWorldPosition(tmp)).setY(tmp.y + 2.3); };
  return { S, group, crew, tags, toWorld, place };
}
/** Shows the shared set while this shot is on; the lanterns lit, flames flickering (and leaning in the draught). */
function lights(B, t, on, { lean = 0, fill = 1.2 } = {}) {
  if (on && B.S.group.parent !== B.group) B.group.add(B.S.group); // the shared set goes with the shot on screen
  B.group.visible = on;
  for (const P of B.crew) {
    P.lantern.light.visible = on;
    P.lantern.light.intensity = on ? 7 * (1 + 0.1 * Math.sin(t * 13 + P.i)) : 0;
    flicker(P.lantern.flame, t, P.i);
    P.lantern.flame.rotation.z = lean;
  }
  B.S.fill.visible = on;
  B.S.fill.intensity = on ? fill : 0;
}
const walkTo = (P, x, z, dx, dz, ph, amp = 0.5) => {
  P.root.position.set(x, floorY(z), z);
  P.root.rotation.y = Math.atan2(dx, dz);
  P.body.rotation.set(0, 0, 0);
  if (amp) stride(P, ph, amp);
  else for (const l of P.legs) l.rotation.x = 0;
};
const lanternUp = (P, a = -1.2) => P.l.g.rotation.set(a, 0, 0.15);
/** The blocks of the breach wall: standing (k 0), falling in (0..1), lying as rubble (1). */
function wallAt(S, k) {
  S.wallBack.visible = k <= 0;
  for (const bl of S.blocks) {
    const f = clamp01((k - bl.k * 0.5) / 0.5);
    bl.m.position.set(bl.x + (bl.k - 0.5) * f, lerp(bl.y, 0.3 + bl.k * 0.3, ease(f)), WALL - 0.1 - 1.6 * ease(f) * (0.5 + bl.k));
    bl.m.rotation.set(f * bl.k * 2, f * (bl.k - 0.5), f * bl.k);
  }
}
/** The rocks at the cavern's mouth: up in the roof (k 0), coming down (0..1), a heap closing the way (1). */
function rockfallAt(S, k) {
  for (const r of S.rocks) {
    const f = clamp01((k - r.d * 0.5) / 0.5);
    r.m.visible = k > 0;
    r.m.position.set(r.x, lerp(-DROP + 3.2, r.y, f * f), r.z);
    r.m.rotation.set(f * 3 * r.d, f * 2, 0);
  }
}
/** Dust in the air around (x, y, z): falling slowly (k: how much). */
function dustAt(S, seed, t, x, y, z, k, spread = 2) {
  const arr = S.dust.geometry.attributes.position.array;
  for (let i = 0; i < 120; i++) {
    if (rand01(seed, 'tdu', i) > k) { arr[i * 3 + 1] = -1e4; continue; }
    const f = (t * 0.2 + rand01(seed, 'tdu', i, 1)) % 1;
    arr[i * 3] = x + (rand01(seed, 'tdu', i, 2) - 0.5) * spread * 2 + 0.2 * Math.sin(t + i);
    arr[i * 3 + 1] = y + 3 - 3 * f;
    arr[i * 3 + 2] = z + (rand01(seed, 'tdu', i, 3) - 0.5) * spread * 2;
  }
  S.dust.geometry.attributes.position.needsUpdate = true;
}
/** A miner swinging the pick at the wall in front (period 1.3 s). */
function dig(P, t, ph = 0) {
  const p = ((t + ph) % 1.3) / 1.3;
  const a = p < 0.55 ? lerp(-1.2, -2.6, ease(p / 0.55)) : p < 0.7 ? lerp(-2.6, -1.0, (p - 0.55) / 0.15) : -1.0;
  P.r.g.rotation.set(a, 0, 0);
  P.body.rotation.x = 0.15 + 0.15 * clamp01((p - 0.55) / 0.15);
  for (const l of P.legs) l.rotation.x = 0;
  P.l.g.rotation.set(-0.5, 0, 0.2);
}
/** Each shot's setting of the set: the wall, the rockfall, the chest, daylight. */
function setState(S, step, shot, u) {
  const breached = step !== 'breach' || ['passage', 'draught'].includes(shot);
  wallAt(S, step === 'breach' && shot === 'fall' ? ease(span(u, 0.25, 0.75)) : breached ? 1 : 0);
  rockfallAt(S, step === 'gold' ? 1 : step === 'tunnel' && shot === 'rumble' ? span(u, 0.35, 0.8) : step === 'tunnel' && shot === 'trapped' ? 1 : 0);
  S.lid.rotation.x = step === 'gold' && shot === 'chest' ? -1.9 * ease(span(u, 0.45, 0.7)) : 0;
  S.glow.intensity = step === 'gold' && shot === 'chest' ? 5 * span(u, 0.5, 0.75) : 0;
  const day = step === 'gold' && shot === 'daylight' ? span(u, 0.35, 0.6) : 0;
  S.sky.visible = day > 0;
  S.sun.intensity = 40 * day;
}

function shot(args, def) {
  const B = shotBase(args);
  const { story, seed } = args;
  return {
    group: B.group, labels: def.labels ? def.labels(B) : B.tags, interior: true, low: !!def.low, banner: def.banner ?? null,
    ...(def.bannerAt ? { bannerAt: def.bannerAt } : {}), ...(def.footer ? { footer: def.footer } : {}),
    focus: B.toWorld(...def.focus),
    cam: (u) => { const c = def.cam(u); return { pos: B.toWorld(...c[0]), look: B.toWorld(...c[1]), fov: c[2] || 62 }; },
    setWindow(t0, t1) { B.t0 = t0; B.t1 = t1; },
    update(t, t0, t1) {
      const on = t >= t0 - 0.05 && t <= t1 + 0.05;
      lights(B, t, on, { lean: def.lean ? def.lean(clamp01((t - t0) / (t1 - t0))) : 0, fill: def.fill ?? 1.2 });
      if (on) B.S.fill.position.set(def.focus[0], def.focus[1] + 2.5, def.focus[2] + 1.5);
      if (!on) return;
      const u = clamp01((t - t0) / (t1 - t0));
      setState(B.S, story.step, story.shot, u);
      dustAt(B.S, seed, t, 0, -50, 0, 0);
      def.play(B, t, u, t1 - t0);
      apart(B.crew, 0.55); // nobody walks through anybody (owner 2026-11-23)
      B.place(def.labels ? def.labels(B) : B.tags);
    },
  };
}

// ------------------------------------------------------------------ day 1: the breach
const D1 = {
  dig: {
    banner: 'Deep in the Mine', focus: [0, 1.4, WALL + 2], low: true,
    // from the rock face itself, high, looking back at the miners' faces as the picks come down toward the camera, the
    // lanterns behind them down the gallery
    cam: (u) => [[1.45, 3.05, WALL + 0.35 + 0.15 * u], [-0.5, 0.7, WALL + 2.8], 76],
    play(B, t) {
      B.crew.forEach((P, i) => {
        if (i < 3) { walkTo(P, [-1.3, -0.45, 0.45][i], WALL + [1.0, 2.0, 1.1][i], 0, -1, 0, 0); P.root.rotation.y = Math.PI - [0.3, 0.45, 0.6][i]; dig(P, t, i * 0.4); }
        else { walkTo(P, -1.0 + (i - 3) * 2.0, WALL + 4.2 + (i - 3) * 0.6, 0, -1, 0, 0); lanternUp(P, -0.9); }
      });
    },
  },
  hollow: {
    banner: null, bannerAt: (t, t0, t1) => ((t - t0) / (t1 - t0) > 0.35 ? 'That rock sounds... hollow' : null), focus: [0, 1.4, WALL], low: true,
    // close, from the side: the pick striking, then the miner turning to the others
    cam: (u) => [[1.6, 1.5, WALL + 0.9 - 0.2 * u], [-0.9, 1.3, WALL + 0.5]],
    labels: (B) => B.tags.filter((l) => l.P.i === 0 || l.P.i === 1),
    play(B, t, u) {
      B.crew.forEach((P, i) => {
        if (i === 0) { walkTo(P, -0.5, WALL + 0.8, 0, -1, 0, 0); if (u < 0.55) dig(P, t); else { P.r.g.rotation.set(-1.1, 0, 0); P.body.rotation.x = 0; P.root.rotation.y = Math.PI - 1.2; } }
        else if (i === 1) { walkTo(P, -1.2, WALL + 2.2, 0.5, -1, 0, 0); P.r.g.rotation.set(u > 0.6 ? -1.6 : -0.2, 0, 0); }
        else walkTo(P, -1.0 + (i - 2) * 0.5, WALL + 5 + i * 0.4, 0, -1, 0, 0);
      });
      dustAt(B.S, 7, t, 0, 0.5, WALL + 0.2, 0.35 * span(u, 0.2, 0.6), 1.2);
    },
  },
  fall: {
    banner: 'Break through!', focus: [0, 1.4, WALL],
    cam: (u) => [[0.4, 2.5, WALL + 8.5], [0, 1.3, WALL - 0.5]],
    play(B, t, u) {
      B.crew.forEach((P, i) => {
        const back = ease(span(u, 0.25, 0.45));
        walkTo(P, [-1.4, 1.4, -1.4, 1.4, -1.4][i], WALL + 1.2 + back * 1.6 + Math.floor(i / 2) * 1.3, 0, -1, 0, 0); // to the walls, the middle clear
        P.r.g.rotation.set(u > 0.3 ? -1.9 : -1.0, 0, 0.3); // arms up before their faces
        P.l.g.rotation.set(u > 0.3 ? -1.9 : -0.6, 0, -0.3);
      });
      dustAt(B.S, 9, t, 0, 0.5, WALL - 0.5, 0.9 * span(u, 0.3, 0.55) * (1 - 0.6 * span(u, 0.7, 1)), 2);
    },
  },
  passage: {
    banner: 'An old tunnel nobody knew about', focus: [0, 1, WALL - 2],
    // from inside the old tunnel, the lanterns coming through the hole and lighting the arch and the steps
    cam: (u) => [[0.6, 1.9 - 0.5 * u, WALL - 7 + u], [0, 1.5, WALL + 1]],
    fill: 0.5,
    play(B, t, u) {
      B.crew.forEach((P, i) => {
        const z = WALL + 2.5 + i * 1.1 - 4.5 * ease(span(u, 0.1 + i * 0.06, 0.8));
        walkTo(P, (i % 2 ? 0.45 : -0.45), z, 0, -1, t * 5 + i, z < WALL + 1.5 && u < 0.85 ? 0.4 : 0);
        lanternUp(P, -1.5);
      });
    },
  },
  draught: {
    banner: null, bannerAt: (t, t0, t1) => ((t - t0) / (t1 - t0) > 0.62 ? 'To be continued...' : 'Old carvings... and a cold draught'),
    focus: [-1, 1.4, WALL - 2.8], fill: 0.4,
    lean: (u) => 0.5 * span(u, 0.3, 0.45),
    // from deeper in the tunnel, the old miner's face at the carvings; then the camera backs away into the dark
    cam: (u) => { const back = ease(span(u, 0.6, 1)); return [[0.7, 1.9, WALL - 5.2 - back * 4], [-0.9, 1.5 - back * 0.3, WALL - 2.4]]; },
    play(B, t, u) {
      B.crew.forEach((P, i) => {
        const old = i === 3; // the old miner
        if (old) { walkTo(P, -0.8, WALL - 2.6, -1, -0.2, 0, 0); lanternUp(P, -1.9); P.r.g.rotation.set(-1.4, 0, 0); }
        else walkTo(P, -0.2 + (i % 3) * 0.6, WALL - 1.2 + Math.floor(i / 3) * 0.9 - (i === 4 ? 0.4 : 0), 0, -1, 0, 0);
        if (u > 0.45) P.root.rotation.y = Math.PI * 0 + (i % 2 ? 0.25 : -0.25); // all turn to look down the dark tunnel
      });
    },
  },
};

// ------------------------------------------------------------------ day 2: the tunnel
const D2 = {
  ready: {
    banner: 'The expedition', focus: [0, 1.4, WALL + 2],
    // from the hole in the wall, the crew facing it
    cam: (u) => [[0.5, 2.0, WALL - 1.6 + 0.3 * u], [0, 1.4, WALL + 3]],
    play(B, t, u) {
      B.crew.forEach((P, i) => { walkTo(P, -1.2 + (i % 3) * 1.2, WALL + 2.4 + Math.floor(i / 3) * 1.2, 0, -1, 0, 0); lanternUp(P, -1.0 - 0.3 * Math.sin(t * 2 + i)); });
      B.crew[4] && B.crew[4].r.g.rotation.set(-2.6, 0, 0); // the guard: "this way"
    },
  },
  descend: {
    banner: 'Down the old steps', focus: [0, -1, -20], low: true,
    cam: (u) => [[0.7, floorY(-24) + 0.9, -24.5 + 1.5 * u], [0, floorY(-18) + 1.2, -17]],
    play(B, t, u) {
      B.crew.forEach((P, i) => {
        const z = -14 - 9 * u + i * 1.3;
        walkTo(P, (i % 2 ? 0.35 : -0.35), z, 0, -1, t * 5 + i, 0.4);
        lanternUp(P, -1.3);
      });
    },
  },
  cavern: {
    banner: 'A great cavern!', focus: [0, -1.5, CAV], fill: 6.0,
    // from inside the cavern, the crew coming in with their lanterns high under the stalactites
    cam: (u) => [[1.8 - u, -DROP + 1.2, FALL - 11], [0, -DROP + 2.2, FALL - 4]],
    play(B, t, u) {
      B.crew.forEach((P, i) => {
        walkTo(P, -2.5 + i * 1.2, FALL - 5 - (i % 2) * 0.8 - 1.5 * ease(u), 0, -1, t * 4 + i, u < 0.5 ? 0.35 : 0);
        lanternUp(P, -2.4); // lanterns held high
      });
    },
  },
  rumble: {
    banner: null, bannerAt: (t, t0, t1) => ((t - t0) / (t1 - t0) > 0.3 ? 'The roof is coming down!' : 'A rumble...'),
    focus: [0, -1, FALL - 3], fill: 1.6,
    cam: (u) => { const s = u > 0.3 && u < 0.85 ? 0.06 * Math.sin(u * 160) : 0; return [[2.6 + s, -DROP + 1.6 + s, FALL - 8], [0, -DROP + 1.2, FALL - 1]]; },
    play(B, t, u) {
      B.crew.forEach((P, i) => {
        const jump = ease(span(u, 0.35 + i * 0.03, 0.55 + i * 0.03));
        const z = FALL - 1.2 - i * 0.5 - 3.5 * jump;
        walkTo(P, -1.6 + i * 0.8, z, 0, -1, t * 9 + i, jump > 0 && jump < 1 ? 0.7 : 0);
        if (jump >= 1) { P.root.rotation.y = Math.PI; P.r.g.rotation.set(-1.8, 0, 0.3); } // turned round, staring at the rocks
      });
      dustAt(B.S, 11, t, 0, -DROP + 0.5, FALL, 0.9 * span(u, 0.3, 0.5), 2.4);
    },
  },
  trapped: {
    banner: null, bannerAt: (t, t0, t1) => ((t - t0) / (t1 - t0) > 0.6 ? 'To be continued...' : 'Trapped!'),
    focus: [0, -1.5, FALL - 3], fill: 1.0,
    // from the side: the crew in profile before the heap of rocks; then up and away
    cam: (u) => { const k = ease(span(u, 0.55, 1)); return [[6 + 1.5 * k, -DROP + 1.8 + 1.5 * k, FALL - 6 - 2 * k], [-0.6, -DROP + 1.2, FALL - 3]]; },
    play(B, t, u) {
      B.crew.forEach((P, i) => {
        walkTo(P, -1.6 + i * 0.8, FALL - 4.5 - (i % 2) * 0.4, 0, 1, 0, 0);
        lanternUp(P, -1.6);
        P.r.g.rotation.set(i === 0 ? -1.8 : -0.3, 0, 0);
      });
      dustAt(B.S, 13, t, 0, -DROP + 0.5, FALL - 1, 0.5 * (1 - u), 2.5);
    },
  },
};

// ------------------------------------------------------------------ day 3: the gold
const D3 = {
  follow: {
    banner: 'Follow the draught!', focus: [0, -1.5, CAV], fill: 1.4,
    lean: () => -0.45,
    cam: (u) => [[2.5, -DROP + 1.5, CAV + 5 - 2 * u], [0, -DROP + 1.4, CAV - 2]],
    play(B, t, u) {
      B.crew.forEach((P, i) => {
        const z = CAV + 4 - 5 * u - i * 1.1;
        walkTo(P, -0.6 + (i % 2) * 1.2, z, 0.2, -1, t * 5 + i, 0.4);
        lanternUp(P, -1.4);
        if (i === 3) P.r.g.rotation.set(-2.8, 0, 0); // the old miner's finger up in the air
      });
    },
  },
  chest: {
    banner: null, bannerAt: (t, t0, t1) => ((t - t0) / (t1 - t0) > 0.55 ? 'TREASURE!' : 'An old iron chest...'),
    focus: [CHEST.x, CHEST.y + 0.8, CHEST.z], fill: 1.2,
    // from behind the chest, over its lid: the crew's faces lit by the gold
    cam: (u) => [[CHEST.x + 0.4, CHEST.y + 3.0, CHEST.z - 2.8 + 0.3 * u], [CHEST.x, CHEST.y + 0.8, CHEST.z + 0.9]],
    play(B, t, u) {
      B.crew.forEach((P, i) => {
        const a = -0.9 + i * 0.45;
        walkTo(P, CHEST.x + Math.sin(a) * 1.6, CHEST.z + Math.cos(a) * 1.6, -Math.sin(a), -Math.cos(a), 0, 0);
        P.root.position.y = -DROP;
        lanternUp(P, -1.2);
        if (i < 2) P.r.g.rotation.set(u < 0.5 ? -1.0 - 0.3 * Math.sin(t * 9) : -2.8, 0, 0); // prying the lid, then arms up
        else if (u > 0.55) P.r.g.rotation.set(-2.7, 0, 0.2);
      });
    },
  },
  daylight: {
    banner: null, bannerAt: (t, t0, t1) => ((t - t0) / (t1 - t0) > 0.4 ? 'Daylight!' : 'Dig upward!'),
    focus: [EXIT.x, -DROP + 1.5, EXIT.z - 2], fill: 1.0,
    cam: (u) => [[EXIT.x + 1.4, -DROP + 1.0, EXIT.z + 5.5 - u], [EXIT.x, -DROP + 3.2, EXIT.z - 5.6]],
    play(B, t, u) {
      B.crew.forEach((P, i) => {
        const up = ease(span(u, 0.55 + i * 0.05, 0.95));
        const z = EXIT.z + 1.5 - i * 0.2 - 4.2 * up;
        P.root.position.set(EXIT.x - 0.8 + (i % 3) * 0.8, -DROP + 2.6 * up, z);
        P.root.rotation.y = Math.PI;
        if (u < 0.45 && i < 3) dig(P, t, i * 0.4); else { P.r.g.rotation.set(up > 0 ? -0.8 : -2.6, 0, 0); stride(P, t * 6 + i, up > 0 && up < 1 ? 0.45 : 0); }
      });
    },
  },
};

/** Day 3, last shot: the crew carries the chest through the market square to the cheers (outdoors, in the town). */
function homeShot(args) {
  const { story, M, buildings, seed } = args;
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const crew = crewOf(M, story, group);
  for (const P of crew) { P.lantern.lantern.visible = false; if (P.pick) P.pick.visible = false; }
  const chest = new THREE.Group();
  const cb = (geo, mat) => { const o = new THREE.Mesh(geo, mat); o.castShadow = true; chest.add(o); return o; };
  cb(boxGeo(1.0, 0.55, 0.65).translate(0, 0.28, 0), M.woodDark);
  for (const x of [-0.4, 0, 0.4]) cb(boxGeo(0.06, 0.57, 0.67).translate(x, 0.29, 0), M.iron);
  const coin = new THREE.MeshStandardMaterial({ color: '#ffcf40', metalness: 0.9, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.5 });
  cb(boxGeo(0.9, 0.12, 0.55).translate(0, 0.6, 0), coin);
  for (const s of [-1, 1]) cb(cylGeo(0.04, 0.04, 3.2, 6).rotateX(Math.PI / 2).translate(s * 0.62, 0.3, 0), M.wood); // the carrying poles
  group.add(chest);
  const FOLK = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#7b6a43'];
  const crowd = Array.from({ length: 12 }, (_, i) => {
    const c = story.crowd?.[i] || null;
    const P = person(M, c ? JOBS[c.job]?.color || FOLK[i % 6] : FOLK[i % 6]);
    P.c = c;
    P.root.position.set(-6 + (i % 7) * 1.7 + (i >= 7 ? 0.8 : 0), 0, -0.6 - (i >= 7 ? 1.1 : 0)); // across the way from the camera
    P.root.rotation.y = 0;
    P.ph = rand01(seed, 'tcrowd', i) * 6;
    group.add(P.root);
    return P;
  });
  const tmp = new THREE.Vector3();
  const labels = [...crew.filter((P) => P.c?.name).map((P) => ({ P, ...castTag(P.c), pos: new THREE.Vector3() })),
    ...crowd.filter((P) => P.c?.name).slice(0, 3).map((P) => ({ P, ...castTag(P.c), pos: new THREE.Vector3() }))];
  const coins = Number(story.coins || 500).toLocaleString('en-US');
  return {
    group, labels, banner: `${coins} old gold coins for the kingdom!`, phase: 0.22,
    focus: st.toWorld(0, 1.2, 2),
    cam(u) { return { pos: st.toWorld(-3.5 + 4 * u, 2.1, 7.5), look: st.toWorld(-2 + 4 * u, 1.2, 1.5) }; },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      const cx = -5 + 8 * ease(u);
      chest.position.set(cx, 0.85, 2);
      chest.rotation.y = Math.PI / 2;
      crew.forEach((P, i) => {
        const bearer = i < 4;
        const x = bearer ? cx + (i < 2 ? -1.2 : 1.2) : cx - 2.5, z = bearer ? 2 + (i % 2 ? 0.62 : -0.62) : 2;
        P.root.position.set(x, 0, z);
        P.root.rotation.y = Math.PI / 2;
        P.body.rotation.set(0, 0, 0);
        stride(P, t * 6 + i, 0.4);
        if (bearer) P.r.g.rotation.set(-0.35, 0, 0);
        else { P.r.g.rotation.set(-2.8, 0, 0); P.l.g.rotation.set(-2.6, 0, 0); } // the guard waving the crowd back... and cheering
      });
      crowd.forEach((P, i) => {
        const c = Math.sin(t * 10 + P.ph);
        P.r.g.rotation.set(-2.6 + 0.3 * c, 0, -0.2);
        P.l.g.rotation.set(i % 2 ? -2.4 - 0.3 * c : -0.2, 0, 0.2);
      });
      group.updateMatrixWorld(true);
      for (const l of labels) l.pos.copy(l.P.root.getWorldPosition(tmp)).setY(tmp.y + 2.3);
    },
  };
}

const DAYS = { breach: D1, tunnel: D2, gold: D3 };

/** The scene of one shot of the treasure's three days (args.story.step, args.story.shot). */
export function buildTreasure(args) {
  const { step, shot: name } = args.story;
  if (step === 'gold' && name === 'home') return homeShot(args);
  const def = DAYS[step]?.[name];
  return def ? shot(args, def) : null;
}
