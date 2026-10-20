// Villagers at work: a small animated scene per job (farmer hoeing, blacksmith at the anvil with
// sparks, woodcutter chopping...), placed in the villager's croft behind their house. Used for the
// shots of villagers named by commenters. Everything is a pure function of t, so frames are
// deterministic; strike times are exported for the sound effects.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rand01 } from '../../sim/prng.js';
import { JOBS } from '../../sim/tiers.js';
import { cylGeo, boxGeo } from './kit.js';

const ease = (x) => x * x * (3 - 2 * x);
const flat = (g) => { const q = g.index ? g.toNonIndexed() : g; q.deleteAttribute('uv'); return q; };
const merged = (parts) => mergeGeometries(parts.map(flat));

/**
 * A person with arms on shoulder pivots so they can swing tools. Faces +z.
 * seated: hips at seat height (0.47), thighs forward and shins down to the floor (for benches).
 */
export function rig(M, color, { seated = false, walk = false, ground = false } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // bends at the hips
  body.position.y = ground ? 0.1 : seated ? 0.47 : 0.62;
  root.add(body);
  const tunic = M.people.clone();
  tunic.color.set(color);
  let walkLegs = null;
  const add = (parent, geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  if (ground) {
    // sitting on the ground, legs stretched out in front, feet up
    const legs = [];
    for (const x of [-0.1, 0.12]) {
      legs.push(cylGeo(0.08, 0.085, 0.62, 6).rotateX(Math.PI / 2).translate(x, 0.09, 0.3 + (x > 0 ? 0.04 : 0)));
      legs.push(boxGeo(0.13, 0.24, 0.08).translate(x, 0.13, 0.64 + (x > 0 ? 0.04 : 0)));
    }
    add(root, merged(legs), M.gear);
  } else if (seated) {
    const legs = [];
    for (const x of [-0.09, 0.09]) {
      legs.push(cylGeo(0.08, 0.085, 0.42, 6).rotateX(Math.PI / 2).translate(x, 0.47, 0.2)); // thigh on the seat
      legs.push(cylGeo(0.075, 0.08, 0.45, 6).translate(x, 0.24, 0.4)); // shin down to the floor
      legs.push(boxGeo(0.13, 0.08, 0.24).translate(x, 0.04, 0.45));
    }
    add(root, merged(legs), M.gear);
  } else if (walk) {
    // legs on hip pivots, for walking and running (story events)
    walkLegs = [-0.09, 0.09].map((x) => {
      const g = new THREE.Group();
      g.position.set(x, 0.6, 0);
      root.add(g);
      add(g, merged([cylGeo(0.075, 0.085, 0.6, 6).translate(0, -0.3, 0), boxGeo(0.13, 0.08, 0.24).translate(0, -0.56, 0.04)]), M.gear);
      return g;
    });
  } else add(root, merged([cylGeo(0.075, 0.085, 0.6, 6).translate(-0.09, 0.3, 0), cylGeo(0.075, 0.085, 0.6, 6).translate(0.09, 0.3, 0),
    boxGeo(0.13, 0.08, 0.24).translate(-0.09, 0.04, 0.04), boxGeo(0.13, 0.08, 0.24).translate(0.09, 0.04, 0.04)]), M.gear);
  add(body, merged([cylGeo(0.19, 0.33, 0.9, 12).translate(0, 0.36, 0),
    new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.25, 0.5, 0.85).translate(0, 0.8, 0)]), tunic);
  add(body, merged([cylGeo(0.235, 0.24, 0.07, 12).translate(0, 0.46, 0), cylGeo(0.215, 0.2, 0.09, 12).translate(0, 1.17, 0),
    new THREE.ConeGeometry(0.2, 0.26, 12).translate(0, 1.34, 0)]), M.gear);
  add(body, merged([new THREE.SphereGeometry(0.17, 12, 10).scale(1, 1.1, 1).translate(0, 1.04, 0), cylGeo(0.07, 0.08, 0.12, 8).translate(0, 0.88, 0)]), M.skin);
  const arm = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.3, 0.8, 0);
    body.add(g);
    add(g, cylGeo(0.075, 0.095, 0.62, 8).translate(0, -0.31, 0), tunic);
    add(g, new THREE.SphereGeometry(0.06, 8, 6).translate(0, -0.66, 0), M.skin);
    const hand = new THREE.Group();
    hand.position.y = -0.66;
    g.add(hand);
    return { g, hand };
  };
  return { root, body, r: arm(1), l: arm(-1), legs: walkLegs, tunic };
}

// a soft round dot, so particles are not drawn as squares (made once, in the browser only)
let dotTexture = null;
function roundDot() {
  if (dotTexture || typeof document === 'undefined') return dotTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.55, 'rgba(255,255,255,0.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  dotTexture = new THREE.CanvasTexture(c);
  return dotTexture;
}

export function particles(count, color, size, additive) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const mat = new THREE.PointsMaterial({ color, size, map: roundDot(), sizeAttenuation: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: additive ? 1 : 0.85 });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// ------------------------------------------------------------------ jobs
// period: seconds per stroke; hit: stroke fraction at the impact; raise/down: arm angles (rad, negative
// = forward/up); fx: particles at the impact; sound: sound effect per impact.
const JOB_SCENES = {
  farmer: { period: 1.35, hit: 0.7, raise: -2.5, down: -0.75, bend: 0.32, fx: 'dirt', sound: 'hoe', tool: 'hoe', props: 'field', both: true },
  peasant: { period: 1.5, hit: 0.7, raise: -2.2, down: -0.8, bend: 0.3, fx: 'dirt', sound: 'hoe', tool: 'spade', props: 'garden', both: true },
  blacksmith: { period: 0.8, hit: 0.72, raise: -2.6, down: -1.05, bend: 0.12, fx: 'sparks', sound: 'anvil', tool: 'hammer', props: 'anvil', left: -1.0 },
  woodcutter: { period: 1.45, hit: 0.72, raise: -2.8, down: -0.9, bend: 0.25, fx: 'chips', sound: 'chop', tool: 'axe', props: 'stump', both: true },
  stonemason: { period: 0.55, hit: 0.75, raise: -1.75, down: -1.15, bend: 0.2, fx: 'dust', sound: 'chisel', tool: 'mallet', props: 'block', left: -1.05 },
  carpenter: { period: 0.6, hit: 0.75, raise: -1.9, down: -1.0, bend: 0.2, fx: 'chips', sound: 'chop', tool: 'hammer', props: 'bench', left: -0.9 },
  // the baker works inside the bakehouse (bakery.js), which builds the oven around the mouth; the peel is
  // highest when pushed into the oven and carries a loaf in
  baker: { period: 1.8, hit: 0.55, raise: -1.0, down: -0.88, bend: 0.1, fx: 'embers', sound: 'none', tool: 'peel', props: 'ovenmouth', both: true, push: true, loaf: true },
  fisherman: { period: 2.6, hit: 0.5, raise: -2.2, down: -1.0, bend: 0.05, fx: 'splash', sound: 'none', tool: 'rod', props: 'pond', both: true },
  miller: { period: 1.5, hit: 0.6, raise: -1.6, down: -1.0, bend: 0.25, fx: 'dust', sound: 'none', tool: 'sack', props: 'sacks', both: true },
  guard: { period: 3.2, hit: 0.5, raise: -0.25, down: -0.25, bend: 0, fx: null, sound: 'none', tool: 'spear', props: 'post', left: -0.6, look: true },
  knight: { period: 3.2, hit: 0.5, raise: -0.25, down: -0.25, bend: 0, fx: null, sound: 'none', tool: 'sword', props: 'post', left: -0.6, look: true },
  // jobs asked for in the comments
  innkeeper: { period: 2.4, raise: -1.75, down: -0.45, bend: 0, sound: 'none', tool: 'tankard', props: 'tavern', smooth: true, left: -0.5 },
  // the town beggar (owner 2026-10-20): sitting against the back wall of his house, swigging from a
  // bottle; 'collapsed' is asleep on the ground, snoring; 'hat' stands by a crate raising a mug. `home`:
  // metres out from the house wall (not in the croft), `homeTurn`: yaw from facing the croft
  beggar: { period: 4.6, raise: -2.1, down: -0.6, bend: -0.2, sound: 'none', tool: 'bottle', props: 'slump', drink: true, left: -0.35, ground: true, home: 0.42, focusH: 0.75, labelH: 1.75, radius: 4.6 },
  weirdo: { period: 1.1, raise: -2.6, down: -0.4, bend: 0, sound: 'none', tool: null, props: 'none', dance: true },
  jester: { period: 0.9, raise: -1.2, down: -0.8, bend: 0, sound: 'none', tool: null, props: 'none', juggle: true },
  fletcher: { period: 0.6, raise: -1.35, down: -1.05, bend: 0.22, sound: 'none', tool: null, props: 'fletch', smooth: true, left: -1.15 },
  // in-between goals: the town crier rings a hand bell by the notice board, the executioner (nobody gets
  // hurt in the kingdom) chops cabbages on the block
  crier: { period: 0.42, raise: -2.75, down: -2.2, bend: 0, sound: 'none', tool: 'handbell', props: 'notice', smooth: true, left: -1.3 },
  executioner: { period: 1.6, hit: 0.72, raise: -2.8, down: -0.9, bend: 0.25, fx: 'leaves', sound: 'chop', tool: 'axe', props: 'chopblock', both: true, hood: true },
};
const DEFAULT_SCENE = { period: 2.4, hit: 0.5, raise: -2.6, down: -0.2, bend: 0, fx: null, sound: 'none', tool: null, props: 'market', wave: true };
// Other scenes of the same jobs, 'job:variant' (owner 2026-10-20: a job is not always shown the same way;
// VARIANTS in timeline.js picks one per villager and day). Motions: sweep = a sideways swing of the whole
// body (scythe, felling axe); stir = the hands go round in circles; archer = draw, loose, the arrow flies.
Object.assign(JOB_SCENES, {
  'farmer:sow': { period: 1.3, hit: 0.3, raise: -1.5, down: -0.35, bend: 0.05, fx: 'seeds', sound: 'none', tool: null, props: 'field', smooth: true, left: -0.55, pouch: true },
  'farmer:scythe': { period: 1.6, hit: 0.45, raise: -0.95, down: -0.95, bend: 0.25, fx: 'hay', sound: 'none', tool: 'scythe', props: 'wheat', sweep: true, both: true },
  'peasant:sow': { period: 1.3, hit: 0.3, raise: -1.5, down: -0.35, bend: 0.05, fx: 'seeds', sound: 'none', tool: null, props: 'garden', smooth: true, left: -0.55, pouch: true },
  'blacksmith:quench': { period: 2.2, hit: 0.55, raise: -1.3, down: -0.5, bend: 0.2, fx: 'steam', sound: 'none', tool: 'tongs', props: 'quench', smooth: true, left: -0.4 },
  'blacksmith:bellows': { period: 1.4, hit: 0.5, raise: -1.6, down: -0.8, bend: 0.15, fx: 'embers', sound: 'none', tool: null, props: 'bellows', smooth: true, both: true },
  'woodcutter:fell': { period: 1.5, hit: 0.62, raise: -1.4, down: -1.4, bend: 0.05, fx: 'chips', sound: 'chop', tool: 'axe', props: 'tree', sweep: true, both: true },
  'stonemason:stack': { period: 2.4, hit: 0.5, raise: -1.45, down: -0.75, bend: 0.45, fx: 'dust', sound: 'none', tool: 'stone', props: 'wall', smooth: true, both: true },
  'carpenter:saw': { period: 0.7, hit: 0.5, raise: -1.2, down: -0.95, bend: 0.3, fx: 'sawdust', sound: 'none', tool: 'saw', props: 'trestle', push: true, left: -1.0 },
  'baker:knead': { period: 1.0, hit: 0.5, raise: -1.3, down: -1.0, bend: 0.3, fx: 'flour', sound: 'none', tool: null, props: 'dough', push: true, both: true },
  'fisherman:net': { period: 2.8, hit: 0.42, raise: -2.3, down: -0.8, bend: 0.15, fx: 'splash', sound: 'none', tool: 'net', props: 'pond', smooth: true, both: true, net: true },
  'miller:quern': { period: 1.2, hit: 0.5, raise: -1.1, down: -1.1, bend: 0.25, fx: 'flour', sound: 'none', tool: null, props: 'quern', stir: true, left: -0.9 },
  'fletcher:shoot': { period: 2.6, hit: 0.62, raise: -1.5, down: -1.5, bend: 0, fx: null, sound: 'straw', tool: null, props: 'butts', archer: true },
  'beggar:collapsed': { period: 3.8, raise: 0, down: 0, bend: 0, sound: 'none', tool: null, props: 'asleep', sleep: true, home: 2.4, homeTurn: Math.PI / 2, focusH: 0.45, labelH: 1.15, radius: 5 },
  'beggar:hat': { period: 3.4, raise: -1.5, down: -0.35, bend: 0.28, sound: 'none', tool: 'tankard', props: 'begging', smooth: true, left: -0.15, sway: true },
  'innkeeper:barrel': { period: 2.6, hit: 0.4, raise: -1.15, down: -0.95, bend: 0.1, fx: 'ale', sound: 'none', tool: 'tankard', props: 'keg', smooth: true, left: -0.7 },
  'brewer:stir': { period: 2.0, hit: 0.5, raise: -1.2, down: -1.2, bend: 0.2, fx: 'steam', sound: 'none', tool: 'paddle', props: 'vat', stir: true, both: true },
});
JOB_SCENES.warrior = JOB_SCENES.knight;
for (const [from, to] of [['toolsmith', 'blacksmith'], ['brewer', 'innkeeper']]) {
  for (const k of Object.keys(JOB_SCENES)) if (k === to || k.startsWith(to + ':')) JOB_SCENES[from + k.slice(to.length)] ??= JOB_SCENES[k];
}

/** The scene settings of a job, or of one of its variants. */
export const sceneOf = (job, variant) => JOB_SCENES[`${job}:${variant}`] || JOB_SCENES[job] || DEFAULT_SCENE;

// Striking tools are held like real ones: the handle leaves the fist at an angle (beta, from the
// arm's line toward the back of the hand) and the head/blade faces -z of the hand, which is the
// direction the hand moves on the down-swing. `tip` marks the striking face for calibration.
function striker(g, M, { beta, len, back = 0.06, head }) {
  const h = new THREE.Vector3(0, -Math.cos(beta), Math.sin(beta)); // handle direction
  const p = new THREE.Vector3(0, -Math.sin(beta), -Math.cos(beta)); // toward the striking face
  const along = (geo, dir) => geo.rotateX(Math.atan2(dir.z, dir.y));
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); };
  const total = len + back;
  add(along(cylGeo(0.024, 0.026, total, 6), h).translate(...h.clone().multiplyScalar(len / 2 - back / 2).toArray()), M.woodDark);
  const end = h.clone().multiplyScalar(len);
  const tipOff = head(add, along, h, p, end);
  const tip = new THREE.Object3D();
  tip.position.copy(end).addScaledVector(p, tipOff);
  g.add(tip);
  g.userData.tip = tip;
}

export function toolGeo(kind, M) {
  const wood = M.woodDark, iron = M.iron;
  const g = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); };
  if (kind === 'hammer' || kind === 'mallet') {
    striker(g, M, { beta: 0.55, len: 0.4, head: (put, along, h, p, end) => {
      const geo = kind === 'hammer' ? along(boxGeo(0.085, 0.24, 0.085), p) : along(cylGeo(0.075, 0.075, 0.2, 10), p);
      put(geo.translate(...end.toArray()), kind === 'hammer' ? iron : M.wood);
      return 0.11;
    } });
  } else if (kind === 'axe') {
    striker(g, M, { beta: 0.3, len: 0.85, back: 0.1, head: (put, along, h, p, end) => {
      // the blade sticks out on the striking side, flat in the swing plane
      put(along(boxGeo(0.03, 0.24, 0.2), p).translate(...end.clone().addScaledVector(p, 0.12).toArray()), iron);
      put(along(boxGeo(0.06, 0.08, 0.1), p).translate(...end.clone().addScaledVector(p, -0.03).toArray()), iron);
      return 0.24;
    } });
  } else if (kind === 'hoe') {
    striker(g, M, { beta: 0.35, len: 1.25, back: 0.25, head: (put, along, h, p, end) => {
      put(along(boxGeo(0.24, 0.22, 0.03), p).translate(...end.clone().addScaledVector(p, 0.11).toArray()), iron);
      return 0.22;
    } });
  } else if (kind === 'spade') {
    striker(g, M, { beta: 0.2, len: 1.1, back: 0.25, head: (put, along, h, p, end) => {
      put(along(boxGeo(0.22, 0.3, 0.03), h).translate(...end.clone().addScaledVector(h, 0.15).toArray()), iron);
      return 0;
    } });
  } else if (kind === 'peel') {
    // a long handle held level in front of the waist (tilted up from the arm), the flat blade in line with
    // it, face up, with a loaf on it
    const p = new THREE.Group();
    p.rotation.x = -0.6;
    g.add(p);
    const put = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; p.add(m); return m; };
    put(cylGeo(0.02, 0.02, 1.5, 6).translate(0, -0.6, 0), wood);
    put(boxGeo(0.34, 0.4, 0.02).translate(0, -1.5, 0), M.wood);
    g.userData.loaf = put(new THREE.SphereGeometry(0.12, 10, 8).scale(1.4, 1.1, 0.6).translate(0, -1.5, 0.08), M.hay);
  } else if (kind === 'rod') {
    add(cylGeo(0.012, 0.025, 2.6, 6).translate(0, -1.2, 0), wood);
  } else if (kind === 'spear') {
    add(cylGeo(0.025, 0.025, 2.3, 6).translate(0, 0.5, 0.05), wood);
    add(new THREE.ConeGeometry(0.05, 0.25, 6).translate(0, 1.75, 0.05), iron);
  } else if (kind === 'sword') {
    add(boxGeo(0.05, 0.9, 0.015).translate(0, 0.45, 0.1), iron);
    add(boxGeo(0.2, 0.04, 0.04).translate(0, 0, 0.1), M.gold);
  } else if (kind === 'tankard') {
    add(cylGeo(0.095, 0.09, 0.24, 12).translate(0, -0.02, 0.12), M.wood);
    add(cylGeo(0.098, 0.098, 0.035, 12).translate(0, 0.115, 0.12), M.clothIvory); // foam
    add(new THREE.TorusGeometry(0.06, 0.015, 5, 10).rotateY(Math.PI / 2).translate(0, 0, 0.23), M.woodDark); // handle
  } else if (kind === 'bucket') {
    add(cylGeo(0.16, 0.12, 0.26, 10).translate(0, -0.2, 0.1), M.wood);
    add(new THREE.TorusGeometry(0.13, 0.012, 4, 10, Math.PI).translate(0, -0.08, 0.1), M.iron);
  } else if (kind === 'bottle') {
    // held so that at the top of a swig (the beggar's arm at -2.1, -0.4) the neck is at the mouth
    const b = new THREE.Group();
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-0.48, 0.86, 0.19).normalize());
    g.add(b);
    for (const geo of [cylGeo(0.06, 0.065, 0.24, 10).translate(0, 0.1, 0), cylGeo(0.022, 0.05, 0.15, 8).translate(0, 0.29, 0)]) b.add(Object.assign(new THREE.Mesh(geo, M.greens), { castShadow: true }));
  } else if (kind === 'handbell') {
    add(cylGeo(0.025, 0.03, 0.2, 8).translate(0, 0.02, 0.06), wood);
    add(cylGeo(0.05, 0.13, 0.17, 12).translate(0, -0.15, 0.06), M.gold);
  } else if (kind === 'sack') {
    add(new THREE.SphereGeometry(0.28, 10, 8).scale(1, 1.2, 0.8).translate(0, -0.1, 0.25), M.hay);
  } else if (kind === 'scythe') {
    // a long snath along the arms with the blade at the far end, sweeping just above the ground
    add(cylGeo(0.022, 0.022, 1.6, 6).rotateX(-0.5).translate(0, -0.45, 0.35), wood);
    add(boxGeo(0.7, 0.025, 0.09).translate(-0.3, -1.15, 0.72), iron);
  } else if (kind === 'tongs') {
    add(boxGeo(0.03, 0.55, 0.03).translate(0.02, -0.27, 0.08), iron);
    add(boxGeo(0.03, 0.55, 0.03).translate(-0.02, -0.27, 0.08), iron);
    add(boxGeo(0.05, 0.35, 0.012).translate(0, -0.7, 0.08), M.ember); // the glowing blade
  } else if (kind === 'stone') {
    add(boxGeo(0.5, 0.28, 0.32).translate(-0.28, -0.12, 0.2), M.stone); // carried between both hands
  } else if (kind === 'saw') {
    // the blade goes on along the arm, toothed edge down
    add(boxGeo(0.06, 0.14, 0.12).translate(0, 0, 0.06), wood);
    add(boxGeo(0.012, 0.7, 0.15).translate(0, -0.42, 0.1), iron);
  } else if (kind === 'net') {
    add(new THREE.SphereGeometry(0.12, 8, 6).scale(1.4, 0.8, 1).translate(-0.28, -0.06, 0.1), M.hay); // the folded net
  } else if (kind === 'paddle') {
    add(cylGeo(0.025, 0.025, 1.5, 6).translate(-0.28, -0.4, 0.15), wood);
    add(boxGeo(0.12, 0.35, 0.03).translate(-0.28, -1.2, 0.15), M.wood);
  } else if (kind === 'loaf') {
    add(new THREE.SphereGeometry(0.13, 10, 8).scale(1.5, 0.75, 1).translate(0, -0.03, 0.1), M.hay);
  } else if (kind === 'fish') {
    add(new THREE.SphereGeometry(0.08, 8, 6).scale(3, 0.9, 0.5).rotateZ(Math.PI / 2).translate(0, -0.2, 0.06), M.iron);
    add(new THREE.ConeGeometry(0.07, 0.12, 4).translate(0, -0.47, 0.06), M.iron);
  } else if (kind === 'cabbage') {
    add(new THREE.SphereGeometry(0.15, 10, 8).translate(0, -0.12, 0.12), M.greens);
  } else if (kind === 'sheaf') {
    add(cylGeo(0.12, 0.16, 0.8, 8).rotateX(0.5).translate(0, 0.05, 0.25), M.hay);
  } else if (kind === 'logs') {
    for (let i = 0; i < 3; i++) add(cylGeo(0.1, 0.1, 0.9, 8).rotateZ(Math.PI / 2).translate(-0.28, 0.05 + (i === 2 ? 0.17 : 0), 0.15 + (i % 2) * 0.17 - (i === 2 ? 0.08 : 0)), M.wood);
  } else if (kind === 'basket') {
    add(cylGeo(0.24, 0.18, 0.24, 10).translate(-0.28, -0.05, 0.25), M.wood);
    for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.06, 6, 5).scale(3, 0.8, 0.6).translate(-0.33 + i * 0.05, 0.1, 0.22 + i * 0.03), M.iron);
  } else if (kind === 'bow') {
    add(new THREE.TorusGeometry(0.5, 0.018, 5, 18, Math.PI * 0.8).rotateZ(Math.PI * 0.1).rotateY(Math.PI / 2).translate(0, 0.3, 0.05), M.woodDark);
  }
  return g;
}

/** A bottle lying on its side along x. */
const emptyBottle = () => merged([cylGeo(0.06, 0.065, 0.24, 10), cylGeo(0.022, 0.05, 0.15, 8).translate(0, 0.19, 0)]).rotateZ(Math.PI / 2);

/** Props around the worker, in the worker's frame (worker at origin facing +z). Returns impact point. */
function buildProps(kind, M, add, anim = [], holder = null) {
  const brown = M.soil;
  switch (kind) {
    case 'field': {
      add(boxGeo(5, 0.06, 4).translate(0, 0.03, 1.4), brown);
      for (let i = -2; i <= 2; i++) add(boxGeo(0.35, 0.12, 3.6).translate(i * 0.95, 0.09, 1.6), brown);
      for (let i = -2; i <= 2; i += 2) for (let k = 0; k < 6; k++) add(new THREE.ConeGeometry(0.12, 0.35, 5).translate(i * 0.95, 0.3, 0.2 + k * 0.55), M.greens);
      add(cylGeo(0.28, 0.22, 0.32, 10).translate(-1.4, 0.16, -0.4), M.wood);
      return new THREE.Vector3(0, 0.08, 0.85);
    }
    case 'garden': {
      add(boxGeo(3.2, 0.06, 2.6).translate(0, 0.03, 1.0), brown);
      add(boxGeo(0.5, 0.35, 0.5).translate(-1.2, 0.18, 0.0), M.hay);
      return new THREE.Vector3(0, 0.08, 0.9);
    }
    case 'anvil': {
      add(cylGeo(0.3, 0.34, 0.55, 10).translate(0, 0.27, 0.62), M.woodDark);
      add(merged([boxGeo(0.5, 0.2, 0.24).translate(0, 0.65, 0.62), boxGeo(0.28, 0.14, 0.18).translate(0, 0.5, 0.62), new THREE.ConeGeometry(0.1, 0.3, 8).rotateZ(Math.PI / 2).translate(0.38, 0.68, 0.62)]), M.iron);
      add(boxGeo(0.34, 0.035, 0.05).translate(0.02, 0.77, 0.62), M.ember);
      // a small forge with glowing coals and a quench bucket
      add(boxGeo(1.1, 0.8, 0.9).translate(-1.45, 0.4, -0.7), M.stoneDark);
      add(boxGeo(0.8, 0.08, 0.6).translate(-1.45, 0.82, -0.7), M.ember);
      add(cylGeo(0.22, 0.18, 0.4, 10).translate(1.0, 0.2, 0.4), M.wood);
      return new THREE.Vector3(0.02, 0.8, 0.62);
    }
    case 'stump': {
      add(cylGeo(0.38, 0.45, 0.5, 12).translate(0, 0.25, 0.75), M.wood);
      add(cylGeo(0.16, 0.16, 0.45, 8).translate(0, 0.72, 0.75), M.wood);
      for (let i = 0; i < 6; i++) add(cylGeo(0.13, 0.13, 1.1, 8).rotateZ(Math.PI / 2).translate(1.5, 0.13 + Math.floor(i / 3) * 0.24, 0.2 + (i % 3) * 0.28), M.wood);
      return new THREE.Vector3(0, 0.9, 0.75);
    }
    case 'block': {
      add(boxGeo(1.0, 0.7, 0.7).translate(0, 0.35, 0.7), M.stone);
      add(boxGeo(0.7, 0.4, 0.5).translate(1.2, 0.2, 0.3), M.stone);
      return new THREE.Vector3(0, 0.72, 0.42);
    }
    case 'bench': {
      add(boxGeo(1.6, 0.08, 0.6).translate(0, 0.8, 0.65), M.wood);
      for (const x of [-0.7, 0.7]) add(boxGeo(0.08, 0.8, 0.5).translate(x, 0.4, 0.65), M.woodDark);
      add(boxGeo(1.2, 0.1, 0.25).translate(0, 0.89, 0.6), M.wood);
      return new THREE.Vector3(0, 0.95, 0.55);
    }
    case 'ovenmouth': // the oven itself is part of the bakehouse (bakery.js)
      return new THREE.Vector3(0, 1.1, 1.95);
    case 'pond': {
      add(new THREE.CylinderGeometry(2.0, 2.0, 0.05, 24).translate(0, 0.03, 3.0), new THREE.MeshStandardMaterial({ color: '#46707f', roughness: 0.15, metalness: 0.1 }));
      add(new THREE.TorusGeometry(2.0, 0.18, 6, 24).rotateX(Math.PI / 2).translate(0, 0.04, 3.0), M.stone);
      add(cylGeo(0.25, 0.2, 0.3, 10).translate(-0.7, 0.15, 0.2), M.wood);
      return new THREE.Vector3(0, 0.06, 3.4);
    }
    case 'sacks': {
      for (let i = 0; i < 5; i++) add(new THREE.SphereGeometry(0.3, 10, 8).scale(1, 1.2, 0.8).translate(0.9 + (i % 3) * 0.5, 0.3 + Math.floor(i / 3) * 0.45, 0.6), M.hay);
      return new THREE.Vector3(0.9, 0.5, 0.6);
    }
    case 'post': {
      add(boxGeo(0.25, 2.6, 0.25).translate(-1.0, 1.3, -0.3), M.woodDark);
      add(boxGeo(0.7, 0.9, 0.06).translate(-1.0, 2.1, -0.15), M.cloth);
      return new THREE.Vector3(0, 1.0, 0.5);
    }
    case 'tavern': {
      add(cylGeo(0.42, 0.42, 0.95, 12).rotateZ(Math.PI / 2).translate(-1.5, 0.75, -0.3), M.wood); // barrel on its side
      add(boxGeo(0.9, 0.3, 0.7).translate(-1.5, 0.15, -0.3), M.woodDark);
      add(boxGeo(1.4, 0.08, 0.8).translate(0.9, 0.8, 1.0), M.wood); // table with tankards
      for (const x of [-0.6, 0.6]) add(boxGeo(0.08, 0.8, 0.6).translate(0.9 + x, 0.4, 1.0), M.woodDark);
      for (const x of [0.6, 0.9, 1.2]) add(cylGeo(0.07, 0.07, 0.17, 10).translate(x, 0.92, 0.95), M.wood);
      return new THREE.Vector3(0, 1.3, 0.4);
    }
    case 'begging': {
      add(boxGeo(0.7, 0.45, 0.5).translate(0, 0.22, -0.35), M.wood); // crate he leans on
      add(cylGeo(0.2, 0.16, 0.12, 10).translate(0.15, 0.06, 0.6), M.gear); // the hat for coins
      for (let i = 0; i < 3; i++) add(cylGeo(0.035, 0.035, 0.01, 8).translate(0.1 + i * 0.05, 0.12, 0.58), M.gold);
      add(cylGeo(0.1, 0.1, 0.35, 8).rotateZ(1.3).translate(-0.5, 0.1, 0.5), M.clothIvory); // empty bottle
      return new THREE.Vector3(0, 1.2, 0.4);
    }
    case 'slump': { // an upturned hat with a few coins, empty bottles lying about
      add(cylGeo(0.2, 0.16, 0.12, 10).translate(0.55, 0.06, 0.45), M.gear);
      for (let i = 0; i < 3; i++) add(cylGeo(0.035, 0.035, 0.01, 8).translate(0.5 + i * 0.05, 0.12, 0.43), M.gold);
      for (const [x, z, r] of [[-0.6, 0.35, 0.4], [-0.75, 0.6, 2.1], [0.9, 0.9, 1.2]]) add(emptyBottle().rotateY(r).translate(x, 0.065, z), M.greens);
      return new THREE.Vector3(0, 0.9, 0.3);
    }
    case 'asleep': { // the bottle rolled away from the hand, a mug on its side, the hat fallen off
      add(emptyBottle().rotateY(0.5).translate(0.85, 0.065, -0.9), M.greens);
      add(cylGeo(0.095, 0.09, 0.24, 12).rotateZ(Math.PI / 2).translate(-0.7, 0.095, -0.4), M.wood);
      add(new THREE.ConeGeometry(0.2, 0.26, 12).rotateX(1.9).translate(-0.3, 0.14, -1.95), M.gear);
      return new THREE.Vector3(0, 0.3, -1.6);
    }
    case 'fletch': {
      add(boxGeo(1.4, 0.08, 0.6).translate(0, 0.8, 0.6), M.wood);
      for (const x of [-0.6, 0.6]) add(boxGeo(0.08, 0.8, 0.5).translate(x, 0.4, 0.6), M.woodDark);
      // arrows on the bench: iron heads on one end, three feathers on the other
      const shafts = [], heads = [], white = [], red = [];
      const arrow = (m, i) => { // m: matrix placing an arrow that lies along +x, head at +x
        shafts.push(cylGeo(0.012, 0.012, 0.75, 5).rotateZ(Math.PI / 2).applyMatrix4(m));
        heads.push(new THREE.ConeGeometry(0.022, 0.08, 4).rotateZ(-Math.PI / 2).translate(0.41, 0, 0).applyMatrix4(m));
        for (let k = 0; k < 3; k++) (i % 2 ? red : white).push(boxGeo(0.11, 0.035, 0.004).translate(-0.3, 0.022, 0).rotateX((k * 2 * Math.PI) / 3).applyMatrix4(m));
      };
      for (let i = 0; i < 7; i++) arrow(new THREE.Matrix4().makeTranslation(0, 0.865, 0.45 + i * 0.04), i);
      // a few more standing in the quiver, feathers up
      add(cylGeo(0.13, 0.11, 0.6, 10).translate(-0.9, 0.3, 0.2), M.gear);
      for (let i = 0; i < 4; i++) arrow(new THREE.Matrix4().makeRotationZ(-Math.PI / 2 + (i - 1.5) * 0.08).setPosition(-0.9 + (i - 1.5) * 0.035, 0.63, 0.2 + (i % 2) * 0.03), i);
      add(merged(shafts), M.wood); add(merged(heads), M.iron); add(merged(white), M.clothIvory); add(merged(red), M.clothRed);
      // the bow leans against the end of the bench, strung: a curved stave and a straight string
      const bow = new THREE.Matrix4().makeRotationZ(0.4).setPosition(0.75, 0.52, 0.6);
      add(new THREE.TorusGeometry(0.6, 0.02, 5, 20, Math.PI * 0.9).rotateZ(-Math.PI * 0.45).applyMatrix4(bow), M.woodDark); // tips at (0.094, ±0.593)
      add(cylGeo(0.006, 0.006, 1.19, 4).translate(0.094, 0, 0).applyMatrix4(bow), M.clothIvory); // the string
      return new THREE.Vector3(0, 0.9, 0.5);
    }
    case 'notice': {
      add(boxGeo(0.1, 1.9, 0.1).translate(-1.0, 0.95, 0.5), M.woodDark); add(boxGeo(0.1, 1.9, 0.1).translate(-1.0, 0.95, -0.7), M.woodDark);
      add(boxGeo(0.06, 0.9, 1.3).translate(-1.0, 1.45, -0.1), M.wood);
      for (const [y, z] of [[1.6, -0.4], [1.35, 0.1], [1.65, 0.25]]) add(boxGeo(0.02, 0.36, 0.28).translate(-0.96, y, z), M.clothIvory);
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 8).rotateZ(Math.PI / 2).translate(-0.2, 0.95, 0.45), M.clothIvory); // the scroll
      return new THREE.Vector3(0, 1.2, 0.4);
    }
    case 'chopblock': {
      add(cylGeo(0.4, 0.46, 0.55, 12).translate(0, 0.27, 0.75), M.wood);
      add(new THREE.SphereGeometry(0.2, 10, 8).translate(0, 0.72, 0.75), M.greens);
      add(cylGeo(0.42, 0.34, 0.42, 12).translate(1.3, 0.21, 0.2), M.wood); // basket of cabbages
      for (const [x, z] of [[1.2, 0.15], [1.42, 0.27], [1.3, 0.05]]) add(new THREE.SphereGeometry(0.17, 8, 6).translate(x, 0.5, z), M.greens);
      return new THREE.Vector3(0, 0.82, 0.75);
    }
    case 'wheat': { // ripe wheat in rows, the cut part short
      const stalks = [];
      for (let i = -8; i <= 8; i++) for (let k = 0; k < 12; k++) {
        const cut = k < 3 && i > -3, x = i * 0.24 + (k % 2) * 0.12, z = 0.7 + k * 0.22;
        if (cut) { stalks.push(cylGeo(0.035, 0.04, 0.1, 4).translate(x, 0.05, z)); continue; }
        const hgt = 0.75 + 0.15 * Math.sin(i * 3.1 + k * 1.7);
        stalks.push(cylGeo(0.012, 0.016, hgt, 3).translate(x, hgt / 2, z)); // the stalk
        stalks.push(new THREE.SphereGeometry(0.035, 4, 3).scale(1, 2.6, 1).translate(x, hgt + 0.06, z)); // the ear
      }
      add(merged(stalks), M.hay);
      add(boxGeo(4.2, 0.05, 3.2).translate(0, 0.025, 1.9), brown);
      return new THREE.Vector3(0.4, 0.35, 1.2);
    }
    case 'quench': { // the forge behind, a trough of water in front for the hot blade
      add(boxGeo(1.1, 0.8, 0.9).translate(-1.45, 0.4, -0.7), M.stoneDark);
      add(boxGeo(0.8, 0.08, 0.6).translate(-1.45, 0.82, -0.7), M.ember);
      add(cylGeo(0.3, 0.34, 0.55, 10).translate(-1.1, 0.27, 0.5), M.woodDark);
      add(boxGeo(0.5, 0.2, 0.24).translate(-1.1, 0.65, 0.5), M.iron);
      add(boxGeo(0.9, 0.5, 0.55).translate(0.3, 0.25, 0.78), M.wood);
      add(boxGeo(0.8, 0.02, 0.45).translate(0.3, 0.49, 0.78), new THREE.MeshStandardMaterial({ color: '#3f5f6b', roughness: 0.2 }));
      return new THREE.Vector3(0.3, 0.55, 0.75);
    }
    case 'bellows': { // a big leather bellows blowing into the forge; the top board goes up and down
      add(boxGeo(1.1, 0.9, 0.9).translate(0, 0.45, 1.3), M.stoneDark);
      add(boxGeo(0.8, 0.08, 0.6).translate(0, 0.92, 1.3), M.ember);
      add(boxGeo(0.5, 0.05, 0.6).translate(0, 0.62, 0.6), M.wood);
      for (const x of [-0.2, 0.2]) add(boxGeo(0.06, 0.62, 0.06).translate(x, 0.31, 0.45), M.woodDark);
      add(new THREE.ConeGeometry(0.06, 0.3, 6).rotateX(Math.PI / 2).translate(0, 0.66, 1.0), M.iron);
      const lid = new THREE.Group();
      lid.position.set(0, 0.66, 0.92);
      lid.add(Object.assign(new THREE.Mesh(boxGeo(0.5, 0.04, 0.62).translate(0, 0, -0.31), M.wood), { castShadow: true }));
      const skin = new THREE.Mesh(boxGeo(0.46, 1, 0.56).translate(0, 0.5, -0.3), M.gear); // the leather between the boards
      skin.position.set(0, 0.64, 0.92);
      holder.add(lid, skin);
      anim.push((t, c, swing) => {
        lid.rotation.x = THREE.MathUtils.lerp(0.5, 0.16, swing);
        skin.scale.y = Math.max(0.05, 0.6 * Math.sin(lid.rotation.x));
        skin.rotation.x = lid.rotation.x * 0.5;
      });
      return new THREE.Vector3(0, 0.95, 1.3);
    }
    case 'tree': { // a standing tree to fell, with a notch already cut
      add(cylGeo(0.26, 0.32, 3.4, 10).translate(0.25, 1.7, 1.35), M.wood);
      add(new THREE.ConeGeometry(1.3, 3.0, 8).translate(0.25, 4.6, 1.35), M.greens);
      add(new THREE.ConeGeometry(1.0, 2.2, 8).translate(0.25, 5.8, 1.35), M.greens);
      add(boxGeo(0.22, 0.18, 0.1).translate(0.2, 1.15, 1.06), M.hay);
      return new THREE.Vector3(0.25, 1.15, 1.05);
    }
    case 'wall': { // a dry-stone wall going up, a pile of stones beside it
      const s = [];
      for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) s.push(boxGeo(0.48, 0.26, 0.4).translate(-0.75 + i * 0.5 + r * 0.25, 0.13 + r * 0.27, 0.95));
      add(merged(s), M.stone);
      for (let i = 0; i < 5; i++) add(boxGeo(0.45, 0.25, 0.35).translate(-1.3 + (i % 3) * 0.3, 0.13 + Math.floor(i / 3) * 0.26, -0.1 + (i % 2) * 0.2), M.stone);
      return new THREE.Vector3(0, 0.6, 0.9);
    }
    case 'trestle': { // a plank across two trestles, sawn at the end
      for (const x of [-0.7, 0.05]) for (const z of [0.4, 0.8]) add(boxGeo(0.06, 0.66, 0.06).translate(x, 0.33, z), M.woodDark);
      add(boxGeo(1.9, 0.06, 0.4).translate(-0.25, 0.69, 0.6), M.wood);
      add(boxGeo(0.4, 0.06, 0.3).translate(1.1, 0.03, 0.4), M.wood); // a sawn-off end on the ground
      return new THREE.Vector3(0.3, 0.7, 0.6);
    }
    case 'dough': { // a table with a lump of dough that squashes under the hands
      add(boxGeo(1.4, 0.08, 0.7).translate(0, 0.8, 0.62), M.wood);
      for (const x of [-0.6, 0.6]) add(boxGeo(0.08, 0.8, 0.6).translate(x, 0.4, 0.62), M.woodDark);
      add(new THREE.SphereGeometry(0.24, 10, 8).scale(1, 1.25, 0.8).translate(-1.0, 0.28, 0.1), M.hay); // flour sack
      const dough = add(new THREE.SphereGeometry(0.2, 12, 8).scale(1.3, 0.5, 1).translate(0, 0, 0), M.clothIvory);
      dough.position.set(-0.05, 0.88, 0.55);
      anim.push((t, c, swing) => { dough.scale.set(1 + 0.15 * swing, 1 - 0.3 * swing, 1 + 0.1 * swing); });
      return new THREE.Vector3(0, 0.9, 0.55);
    }
    case 'quern': { // a hand mill: the top stone turns round on the bottom one
      add(cylGeo(0.36, 0.42, 0.5, 12).translate(0, 0.25, 0.62), M.wood);
      add(cylGeo(0.33, 0.33, 0.1, 14).translate(0, 0.55, 0.62), M.stone);
      const top = new THREE.Group();
      top.position.set(0, 0.65, 0.62);
      holder.add(top);
      top.add(Object.assign(new THREE.Mesh(cylGeo(0.32, 0.32, 0.1, 14), M.stone), { castShadow: true }));
      top.add(Object.assign(new THREE.Mesh(cylGeo(0.025, 0.025, 0.3).translate(0.24, 0.18, 0), M.woodDark), { castShadow: true }));
      for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.27, 10, 8).scale(1, 1.2, 0.8).translate(0.95 + i * 0.25, 0.3, 0.2 - i * 0.2), M.clothIvory);
      anim.push((t, c) => { top.rotation.y = -c * Math.PI * 2; });
      return new THREE.Vector3(0, 0.72, 0.62);
    }
    case 'butts': { // an archery target on a stand a few metres away (inside the croft), along the line the archer shoots
      const d = new THREE.Vector3(-Math.cos(1.3), 0, Math.sin(1.3));
      const c = new THREE.Vector3(-0.26, 1.35, 0.92).addScaledVector(d, 3.3);
      const face = new THREE.Group();
      face.position.copy(c);
      face.rotation.y = Math.atan2(d.x, d.z);
      holder.add(face);
      const ring = (r, m, z) => face.add(Object.assign(new THREE.Mesh(cylGeo(r, r, 0.02, 20).rotateX(Math.PI / 2).translate(0, 0, z), m), { castShadow: true }));
      face.add(Object.assign(new THREE.Mesh(cylGeo(0.6, 0.6, 0.25, 20).rotateX(Math.PI / 2).translate(0, 0, 0.05), M.hay), { castShadow: true }));
      ring(0.45, M.clothIvory, -0.08); ring(0.3, M.clothRed, -0.09); ring(0.14, M.gold, -0.1);
      for (const x of [-0.45, 0.45]) face.add(new THREE.Mesh(boxGeo(0.07, 1.4, 0.07).translate(x, -0.65, 0.2), M.woodDark));
      return c;
    }
    case 'keg': { // a barrel on a stand with a tap, ale running into the tankard
      add(cylGeo(0.38, 0.38, 0.9, 12).rotateX(Math.PI / 2).translate(0.3, 1.1, 1.0), M.wood);
      for (const z of [0.7, 1.3]) add(boxGeo(0.8, 0.72, 0.08).translate(0.3, 0.36, z), M.woodDark);
      add(cylGeo(0.03, 0.03, 0.18, 6).rotateX(Math.PI / 2).translate(0.3, 0.92, 0.5), M.iron);
      return new THREE.Vector3(0.3, 0.88, 0.45);
    }
    case 'vat': { // a big brewing vat, steaming
      add(cylGeo(0.72, 0.62, 0.95, 16).translate(0, 0.47, 1.05), M.wood);
      add(cylGeo(0.66, 0.66, 0.02, 16).translate(0, 0.9, 1.05), new THREE.MeshStandardMaterial({ color: '#8a5a1f', roughness: 0.3 }));
      for (let i = 0; i < 2; i++) add(new THREE.TorusGeometry(0.7 - i * 0.05, 0.02, 4, 18).rotateX(Math.PI / 2).translate(0, 0.25 + i * 0.5, 1.05), M.iron);
      return new THREE.Vector3(0, 0.92, 1.05);
    }
    case 'none':
      return new THREE.Vector3(0, 1.2, 0.4);
    default: { // a little stall with goods
      add(boxGeo(1.8, 0.9, 0.7).translate(0, 0.45, 1.0), M.wood);
      for (let i = 0; i < 5; i++) add(boxGeo(0.25, 0.2, 0.25).translate(-0.7 + i * 0.35, 1.0, 1.0), [M.roofTile, M.hay, M.greens, M.clothRed, M.clay][i % 5]);
      for (const x of [-0.85, 0.85]) add(boxGeo(0.07, 1.9, 0.07).translate(x, 0.95, 1.3), M.woodDark);
      add(boxGeo(2.0, 0.05, 1.0).translate(0, 1.9, 1.1), M.clothRed);
      return new THREE.Vector3(0, 1.0, 1.0);
    }
  }
}

const FX = {
  dirt: { n: 26, color: '#6b4a2d', size: 0.09, add: false, speed: [1.2, 2.6], up: [1.5, 3.2], life: 0.7 },
  sparks: { n: 50, color: '#ffc061', size: 0.045, add: true, speed: [2.5, 5.5], up: [1.0, 4.0], life: 0.55 },
  chips: { n: 22, color: '#d9b27c', size: 0.08, add: false, speed: [1.5, 3.5], up: [1.5, 3.5], life: 0.8 },
  dust: { n: 24, color: '#bdb7aa', size: 0.08, add: false, speed: [0.6, 1.6], up: [0.6, 1.6], life: 0.9 },
  embers: { n: 18, color: '#ff8a3d', size: 0.05, add: true, speed: [0.2, 0.8], up: [1.0, 2.2], life: 1.2 },
  leaves: { n: 26, color: '#6f9a3c', size: 0.09, add: false, speed: [1.2, 2.8], up: [1.2, 2.8], life: 0.8 },
  splash: { n: 20, color: '#cfe6f2', size: 0.07, add: false, speed: [0.5, 1.4], up: [1.5, 2.6], life: 0.7 },
  seeds: { n: 30, color: '#eadc9a', size: 0.05, add: false, speed: [1.2, 2.6], up: [0.3, 1.2], life: 0.75 },
  hay: { n: 24, color: '#d9c27a', size: 0.08, add: false, speed: [1.0, 2.5], up: [0.8, 2.0], life: 0.8 },
  steam: { n: 22, color: '#e9edf0', size: 0.3, add: false, speed: [0.05, 0.3], up: [0.5, 1.0], life: 1.6, g: -0.2, bias: 0 },
  flour: { n: 22, color: '#f1ede2', size: 0.09, add: false, speed: [0.3, 1.0], up: [0.4, 1.2], life: 1.0, g: 1.5 },
  sawdust: { n: 20, color: '#e2c48e', size: 0.05, add: false, speed: [0.1, 0.5], up: [-0.2, 0.3], life: 0.7 },
  ale: { n: 14, color: '#c98a2b', size: 0.05, add: false, speed: [0, 0.05], up: [-0.6, -0.2], life: 0.35, bias: 0 },
};

/** A white letter Z on a sprite (browser only). */
function zSprite() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = '800 54px Inter, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(40,40,60,0.8)'; g.strokeText('Z', 32, 34);
  g.fillStyle = '#ffffff'; g.fillText('Z', 32, 34);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
}

/** An arrow lying along -x, the head at x = -0.75 (the nock at the origin). */
function arrowGroup(M) {
  const g = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); };
  add(cylGeo(0.012, 0.012, 0.72, 5).rotateZ(Math.PI / 2).translate(-0.36, 0, 0), M.wood);
  add(new THREE.ConeGeometry(0.022, 0.08, 4).rotateZ(Math.PI / 2).translate(-0.75, 0, 0), M.iron);
  add(merged([0, 1, 2].map((k) => boxGeo(0.11, 0.035, 0.004).translate(-0.07, 0.022, 0).rotateX((k * 2 * Math.PI) / 3))), M.clothRed);
  return g;
}

/**
 * Build the work scene for a villager.
 * @param anchor  world point (ground) where the worker stands
 * @param face    yaw the worker faces (radians, world)
 */
export function buildWorkScene({ job, variant = null, anchor, face, M, seed, id, color = null }) {
  const cfg = sceneOf(job, variant);
  const group = new THREE.Group();
  group.position.copy(anchor);
  group.rotation.y = face;
  const P = rig(M, color || JOBS[job]?.color || '#7a6a55', { walk: !!cfg.archer, ground: !!cfg.ground });
  group.add(P.root);
  const propsG = new THREE.Group();
  group.add(propsG);
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; propsG.add(m); return m; };
  const anim = [];
  const impact = buildProps(cfg.props, M, add, anim, propsG);
  const tool = cfg.tool ? toolGeo(cfg.tool, M) : null;
  if (tool) P.r.hand.add(tool);
  if (cfg.pouch) { const pouch = toolGeo('sack', M); pouch.scale.setScalar(0.5); P.l.hand.add(pouch); }
  if (cfg.hood) {
    // the executioner's black hood over the head and shoulders
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.62, 12).translate(0, 1.14, 0), M.people.clone());
    hood.material.color.set('#151214');
    hood.castShadow = true;
    P.body.add(hood);
  }
  // calibrate: find the arm angle where the tool's face reaches the work surface, then slide the
  // props so the anvil/log/soil sits exactly under it
  const tipObj = tool?.userData.tip;
  let down = cfg.down;
  const at = new THREE.Vector3();
  const tipAt = (a) => {
    P.r.g.rotation.set(a, 0, cfg.both ? -0.28 : 0);
    P.body.rotation.x = cfg.bend;
    group.updateMatrixWorld(true);
    return group.worldToLocal(tipObj.getWorldPosition(at.set(0, 0, 0)));
  };
  if (tipObj && !cfg.wave && !cfg.push && !cfg.look && !cfg.smooth && !cfg.sweep && !cfg.stir && !cfg.archer && !cfg.drink) {
    for (let a = cfg.raise + 0.6; a < 0.6; a += 0.01) {
      const tp = tipAt(a);
      if (tp.z > 0.15 && tp.y <= impact.y) { down = a; break; }
    }
    const tp = tipAt(down);
    propsG.position.set(tp.x - impact.x, 0, tp.z - impact.z);
    impact.set(tp.x, impact.y, tp.z);
  }
  const balls = cfg.juggle ? [M.clothRed, M.gold, M.clothBlue].map((m) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), m); b.castShadow = true; group.add(b); return b; }) : [];
  if (cfg.pouch) impact.set(0.45, 1.1, 0.6); // seeds fly from the sower's hand
  let pts = null, fx = null;
  if (cfg.fx) { fx = FX[cfg.fx]; pts = particles(fx.n * 2, fx.color, fx.size, fx.add); group.add(pts); }
  // the archer: a bow in the left hand, the string drawn back to the right hand, an arrow that flies
  let archer = null;
  if (cfg.archer) {
    const stave = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.02, 5, 20, Math.PI * 0.8).rotateZ(Math.PI * 0.6).translate(-0.36, 0.8, 0), M.woodDark);
    stave.castShadow = true;
    P.body.add(stave);
    const tipTop = new THREE.Vector3(-0.36 + 0.6 * Math.cos(Math.PI * 0.6), 0.8 + 0.6 * Math.sin(Math.PI * 0.6), 0);
    const tipLow = tipTop.clone().setY(1.6 - tipTop.y);
    const string = new THREE.Line(new THREE.BufferGeometry().setFromPoints([tipTop, tipTop, tipLow]), new THREE.LineBasicMaterial({ color: '#f1e9d6' }));
    string.frustumCulled = false;
    P.body.add(string);
    const nocked = arrowGroup(M), flying = arrowGroup(M);
    P.body.add(nocked);
    flying.rotation.y = 1.3;
    group.add(flying);
    archer = { string, tipTop, tipLow, nocked, flying };
  }
  // snoring: Z letters float up from the sleeper's head and fade (sprites, so they always face the camera)
  const snores = cfg.sleep ? [0, 1, 2].map(() => zSprite()).filter(Boolean) : [];
  for (const z of snores) group.add(z);
  // the fisherman's net opens over the water and sinks
  let net = null;
  if (cfg.net) {
    net = new THREE.Mesh(new THREE.RingGeometry(0.05, 1, 16, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#efe8d8', wireframe: true, transparent: true }));
    net.position.copy(impact);
    group.add(net);
  }
  const offset = rand01(seed, 'work', id) * cfg.period;
  const lerp = THREE.MathUtils.lerp;
  // sideways swings: wind the body back, sweep through the work at the hit, follow through
  const twist = (u) => (u < cfg.hit - 0.2 ? lerp(-0.1, 0.9, ease(u / (cfg.hit - 0.2)))
    : u < cfg.hit + 0.05 ? lerp(0.9, -0.5, ((u - cfg.hit + 0.2) / 0.25) ** 2)
      : lerp(-0.5, -0.1, ease((u - cfg.hit - 0.05) / (0.95 - cfg.hit))));
  const pose = (t) => {
    const c = (t + offset) / cfg.period, k = Math.floor(c), u = c - k;
    // wind up slowly, strike fast, recover
    let a;
    if (cfg.sweep || cfg.archer) a = cfg.raise;
    else if (cfg.stir) a = cfg.raise + 0.25 * Math.sin(c * Math.PI * 2);
    else if (cfg.wave) a = cfg.raise + 0.35 * Math.sin(t * 7);
    else if (cfg.smooth) a = THREE.MathUtils.lerp(down, cfg.raise, Math.max(0, Math.sin(c * Math.PI * 2)) ** 1.5);
    else if (cfg.dance) a = THREE.MathUtils.lerp(cfg.down, cfg.raise, 0.5 + 0.5 * Math.sin(c * Math.PI * 2));
    else if (cfg.juggle) a = THREE.MathUtils.lerp(cfg.down, cfg.raise, 0.5 + 0.5 * Math.sin(c * Math.PI * 2));
    else if (cfg.push) a = THREE.MathUtils.lerp(down, cfg.raise, 0.5 + 0.5 * Math.sin(c * Math.PI * 2));
    else if (u < cfg.hit - 0.12) a = THREE.MathUtils.lerp(down, cfg.raise, ease(u / (cfg.hit - 0.12)));
    else if (u < cfg.hit) a = THREE.MathUtils.lerp(cfg.raise, down, ((u - cfg.hit + 0.12) / 0.12) ** 2);
    else a = down - 0.12 * Math.sin(Math.min(1, (u - cfg.hit) / 0.15) * Math.PI); // small rebound
    return { a, k, u };
  };
  const strikeTimes = (t0, t1) => {
    if (!cfg.sound || cfg.sound === 'none') return [];
    const out = [];
    for (let k = Math.floor((t0 + offset) / cfg.period) - 1; ; k++) {
      const t = (k + cfg.hit) * cfg.period - offset;
      if (t > t1) break;
      if (t >= t0) out.push(t);
    }
    return out;
  };
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  // the archer's target is a few metres away: frame the archer and the target together
  group.updateMatrixWorld(true);
  const focus = cfg.archer ? group.localToWorld(new THREE.Vector3(0, 1.1, 0).lerp(impact, 0.4)) : anchor.clone().add(new THREE.Vector3(0, cfg.focusH ?? 1.1, 0));
  return {
    group,
    focus,
    labelPos: anchor.clone().add(new THREE.Vector3(0, cfg.labelH ?? 2.45, 0)),
    radius: cfg.radius, // closer than usual for people on the ground
    face,
    sound: cfg.sound,
    strikeTimes,
    rig: P,
    tool,
    update(t) {
      const { a, k: cycleK, u: cycleU } = pose(t);
      const c = (t + offset) / cfg.period;
      P.r.g.position.x = 0.3;
      P.r.g.rotation.set(a, 0, 0);
      if (cfg.both) { P.l.g.rotation.x = a * 0.95; P.l.g.rotation.z = 0.28; P.r.g.rotation.z = -0.28; } // hands meet on the handle
      else if (cfg.left !== undefined) P.l.g.rotation.x = cfg.left + (cfg.look ? 0 : 0.05 * Math.sin(t * 3));
      if (cfg.wave) { P.r.g.rotation.z = 0.35; }
      const swing = (a - cfg.raise) / ((down - cfg.raise) || 1); // 0 raised .. 1 down
      P.body.rotation.x = cfg.bend * THREE.MathUtils.clamp(swing, 0, 1);
      if (cfg.sweep || cfg.stir) P.body.rotation.x = cfg.bend;
      if (cfg.sweep) P.body.rotation.y = twist(cycleU);
      if (cfg.stir) {
        const z = 0.3 * Math.cos(c * Math.PI * 2);
        P.r.g.rotation.z = z - (cfg.both ? 0.28 : 0);
        if (cfg.both) { P.l.g.rotation.x = a; P.l.g.rotation.z = z + 0.28; }
      }
      if (archer) {
        // side on to the target: the bow arm points at it, the string comes back to the cheek
        const u = cycleU;
        const draw = u < 0.15 ? 0 : u < 0.45 ? ease((u - 0.15) / 0.3) : u < 0.55 ? 1 : 0;
        P.body.rotation.set(0, 1.3, 0);
        P.l.g.rotation.set(0, 0, -1.52);
        P.r.g.position.x = lerp(0.3, 0.42, draw);
        P.r.g.rotation.set(0, 0, lerp(-1.5, -1.75, draw));
        P.legs[0].rotation.x = 0.2; P.legs[1].rotation.x = -0.2;
        P.root.updateMatrixWorld(true);
        const nock = P.body.worldToLocal(P.r.hand.getWorldPosition(v));
        if (u >= 0.55 || u < 0.08) nock.set(archer.tipTop.x, 0.8, 0); // loosed: the string is straight again
        const s = archer.string.geometry.attributes.position;
        s.setXYZ(1, nock.x, nock.y, 0);
        s.needsUpdate = true;
        archer.nocked.visible = u >= 0.08 && u < 0.55;
        archer.nocked.position.set(nock.x, nock.y, 0);
        // in flight from the loose to the hit, then stuck in the target until the next one is drawn
        const q = THREE.MathUtils.clamp((u - 0.55) / (cfg.hit - 0.55), 0, 1);
        archer.flying.visible = u >= 0.55;
        const from = group.worldToLocal(P.body.localToWorld(w.set(-0.25, 0.85, 0))).clone();
        const jitter = (rand01(seed, 'arrow', id, cycleK) - 0.5) * 0.3;
        // the nock stops short of the target so that only the head is in the straw
        const end = v.set(-Math.cos(1.3), 0, Math.sin(1.3)).multiplyScalar(-0.62).add(impact).add(w.set(jitter, jitter * 0.7, 0));
        archer.flying.position.copy(from).lerp(end, q);
      }
      if (net) {
        const u = cycleU, age = (u - cfg.hit) * cfg.period;
        net.visible = age >= 0;
        if (tool) tool.visible = !(u > cfg.hit && u < 0.9); // the bundle leaves the hands, then is pulled back in
        if (age >= 0) {
          const open = Math.min(1, age / 0.35);
          net.scale.setScalar(0.25 + 0.95 * ease(open));
          net.position.y = impact.y + lerp(0.6, 0.02, open);
          net.material.opacity = 0.9 * Math.min(1, (1 - u) * 6);
        }
      }
      for (const f of anim) f(t, c, THREE.MathUtils.clamp(swing, 0, 1));
      if (cfg.drink) {
        // most of the time the bottle rests on the lap; every few seconds a long swig, head back
        const u = cycleU, lift = u < 0.14 ? ease(u / 0.14) : u < 0.42 ? 1 : u < 0.55 ? 1 - ease((u - 0.42) / 0.13) : 0;
        P.r.g.rotation.set(lerp(down, cfg.raise, lift), 0, lerp(-0.05, -0.4, lift));
        P.body.rotation.set(cfg.bend - 0.18 * lift + 0.03 * Math.sin(t * 1.1), 0, 0.05 * Math.sin(t * 0.7));
        P.l.g.rotation.set(cfg.left, 0, 0.12);
      }
      if (cfg.sleep) {
        // flat on his back, arms flung out, the chest rising and falling
        P.root.rotation.set(-Math.PI / 2, 0, 0);
        P.root.position.set(0, 0.24, 0.7);
        P.r.g.rotation.set(0.1, 0, -1.25); P.l.g.rotation.set(-0.3, 0, 1.0);
        P.body.scale.set(1, 1, 1 + 0.07 * Math.sin(c * Math.PI * 2));
        P.body.rotation.set(0, 0.08 * Math.sin(t * 0.3), 0);
        snores.forEach((z, i) => {
          const q = (c * 0.5 + i / 3) % 1;
          z.position.set(0.15 + 0.25 * q, 0.55 + 0.9 * q, -1.55 + 0.1 * Math.sin(q * 6 + i));
          z.scale.setScalar(0.16 + 0.22 * q);
          z.material.opacity = Math.sin(Math.PI * q) * 0.95;
        });
      }
      if (cfg.look) P.root.rotation.y = 0.5 * Math.sin(t * 0.8);
      if (cfg.sway) P.root.rotation.z = 0.06 * Math.sin(t * 1.3);
      if (cfg.dance) {
        // flapping, hopping and spinning: the town weirdo
        const c = (t + offset) / cfg.period;
        P.l.g.rotation.set(THREE.MathUtils.lerp(cfg.raise, cfg.down, 0.5 + 0.5 * Math.sin(c * Math.PI * 2)), 0, 0.6 + 0.5 * Math.sin(c * Math.PI * 4));
        P.r.g.rotation.z = -0.6 - 0.5 * Math.sin(c * Math.PI * 4);
        P.root.position.y = 0.18 * Math.abs(Math.sin(c * Math.PI * 2));
        P.root.rotation.y = t * 1.8;
        P.body.rotation.z = 0.2 * Math.sin(c * Math.PI * 2);
      }
      if (cfg.juggle) {
        P.l.g.rotation.x = THREE.MathUtils.lerp(cfg.down, cfg.raise, 0.5 - 0.5 * Math.sin(((t + offset) / cfg.period) * Math.PI * 2));
        P.l.g.rotation.z = 0.25; P.r.g.rotation.z = -0.25;
        balls.forEach((b, i) => {
          const ph = ((t + offset) / (cfg.period * 1.5) + i / 3) % 1; // each ball flies from one hand to the other and back
          const side = ph < 0.5 ? 1 : -1, q = (ph % 0.5) * 2;
          b.position.set(side * (0.25 - 0.5 * q), 1.05 + 4 * q * (1 - q) * 0.75, 0.45);
        });
      }
      if (cfg.push) P.root.position.z = 0.25 * Math.sin(((t + offset) / cfg.period) * Math.PI * 2);
      // a loaf on the peel on the way into the oven, none on the way back
      if (cfg.loaf && tool?.userData.loaf) tool.userData.loaf.visible = Math.cos(c * Math.PI * 2) > 0;
      // particles from the last two impacts
      if (pts) {
        const arr = pts.geometry.attributes.position.array;
        const c = (t + offset) / cfg.period;
        for (let slot = 0; slot < 2; slot++) {
          const k = Math.floor(c - cfg.hit) - slot;
          const age = (c - k - cfg.hit) * cfg.period;
          for (let i = 0; i < fx.n; i++) {
            const j = (slot * fx.n + i) * 3;
            if (age < 0 || age > fx.life) { arr[j] = arr[j + 1] = arr[j + 2] = 1e4; continue; }
            const r = (q) => rand01(seed, 'fx', id, k, i, q);
            const ang = r(0) * Math.PI * 2, sp = THREE.MathUtils.lerp(fx.speed[0], fx.speed[1], r(1)), up = THREE.MathUtils.lerp(fx.up[0], fx.up[1], r(2));
            v.set(Math.cos(ang) * sp, up, Math.sin(ang) * sp * 0.7 + (fx.bias ?? 0.4));
            arr[j] = impact.x + v.x * age;
            arr[j + 1] = Math.max(0.03, impact.y + v.y * age - (fx.g ?? 4.9) * age * age);
            arr[j + 2] = impact.z + v.z * age;
          }
        }
        pts.geometry.attributes.position.needsUpdate = true;
        pts.material.opacity = (fx.add ? 1 : 0.85);
      }
    },
  };
}
