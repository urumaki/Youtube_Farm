// Villagers at work: a small animated scene per job (farmer hoeing, blacksmith at the anvil with
// sparks, woodcutter chopping...), placed in the villager's croft behind their house. Used for the
// shots of villagers named by commenters. Everything is a pure function of t, so frames are
// deterministic; strike times are exported for the sound effects.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rand01 } from '../../sim/prng.js';
import { JOBS } from '../../sim/tiers.js';
import { cylGeo, boxGeo, sheep } from './kit.js';

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
  add(body, cylGeo(0.235, 0.24, 0.07, 12).translate(0, 0.46, 0), M.gear); // the belt
  const hat = add(body, merged([cylGeo(0.215, 0.2, 0.09, 12).translate(0, 1.17, 0), new THREE.ConeGeometry(0.2, 0.26, 12).translate(0, 1.34, 0)]), M.gear);
  const head = add(body, merged([new THREE.SphereGeometry(0.17, 12, 10).scale(1, 1.1, 1).translate(0, 1.04, 0), cylGeo(0.07, 0.08, 0.12, 8).translate(0, 0.88, 0)]), M.skin);
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
  const P = { root, body, r: arm(1), l: arm(-1), legs: walkLegs, tunic, hat, head };
  dress(P, color, M);
  return P;
}

// Owner 2026-10-23: every jester wears a jester's cap (two-coloured horns with bells) and every chimney sweep has a
// face black with soot, in every scene (at work, in the caravan, the tavern, the church...). The rig only gets the
// tunic colour, which is the job's own (JOBS[job].color, unique to each job), so it tells them by that.
let soot = null;
function dress(P, color, M) {
  if (color === JOBS.jester.color) {
    P.hat.visible = false;
    P.body.add(jesterCap(M));
  } else if (color === JOBS.chimneysweep.color) {
    soot ??= new THREE.MeshStandardMaterial({ color: '#3a312c', roughness: 0.95 });
    P.head.material = soot;
  }
}
function jesterCap(M) {
  const g = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); return m; };
  add(cylGeo(0.215, 0.2, 0.1, 12).translate(0, 1.17, 0), M.gold);
  // three floppy horns (left, right, back), each going up and out and then drooping, a bell at each tip
  const horn = (dir, mat) => {
    const seg = (from, a, h, r0, r1) => {
      const geo = cylGeo(r1, r0, h, 8).translate(0, h / 2, 0);
      if (dir[2]) geo.rotateX(-a * dir[2]); else geo.rotateZ(a * dir[0]);
      add(geo.translate(from.x, from.y, from.z), mat);
      return from.clone().add(new THREE.Vector3(-Math.sin(a) * h * dir[0], Math.cos(a) * h, -Math.sin(a) * h * dir[2]));
    };
    const tip = seg(seg(new THREE.Vector3(0, 1.2, 0), 0.75, 0.26, 0.11, 0.06), 2.1, 0.2, 0.06, 0.025);
    add(new THREE.SphereGeometry(0.045, 8, 6).translate(tip.x, tip.y, tip.z), M.gold);
  };
  horn([1, 0, 0], M.clothRed); horn([-1, 0, 0], M.greens); horn([0, 0, 1], M.clothRed);
  return g;
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
  // owner 2026-10-21: only the woodcutter's axe arm moves; the body and the other arm stay still
  woodcutter: { period: 1.45, hit: 0.72, raise: -2.8, down: -0.9, bend: 0, fx: 'chips', sound: 'chop', tool: 'axe', props: 'stump', left: -0.1, still: true },
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
  // owner 2026-10-23: up on the Crier's Stand (its own bell and notice board), half turned to the square
  'crier:stand': { period: 0.42, raise: -2.75, down: -2.2, bend: 0, sound: 'none', tool: 'handbell', props: 'none', smooth: true, left: -1.3, turn: 0.4, radius: 6.2 },
  // owner 2026-10-23, more scenes away from the croft: the carpenter hauls a handcart of planks along (`haul`); the bard
  // plays the flute in the market square for a couple of listeners (`flute`); the jester juggles three burning torches
  // there (`torches`); the rat catcher chases rats in an alley between two houses; the chimney sweep sweeps a flue from a
  // fireplace inside a house (room.js); the cook ladles stew and holds out a bowl at a market stall, the butcher chops at
  // one under hanging hams; the hunter shoots at a boar or a stag at the edge of a field outside the walls, the arrow
  // lands short and the animal runs off (nobody gets hurt, `once`: one shot per scene); the shepherd leans on the gate of
  // a sheep pen; the engineer checks the plan on a parchment in front of a building going up (`read`)
  'carpenter:cart': { period: 1.0, hit: 0.5, raise: 0.3, down: 0.3, bend: 0.18, sound: 'none', tool: null, props: 'none', haul: true, turn: Math.PI / 2, radius: 7.4 },
  'bard:square': { period: 0.6, hit: 0.5, raise: -1.3, down: -1.3, bend: -0.04, sound: 'none', tool: null, props: 'busk', flute: true, turn: 0.45, radius: 6.6 },
  'jester:square': { period: 0.75, raise: -1.4, down: -0.7, bend: 0, sound: 'none', tool: null, props: 'busk', juggle: true, torches: true, turn: 0.45, radius: 6.6, labelH: 3.4 },
  'ratcatcher:alley': { period: 1.3, hit: 0.65, raise: -2.4, down: -0.6, bend: 0.35, fx: 'dirt', sound: 'hoe', tool: 'sack', props: 'alley', both: true, turn: Math.PI * 0.85, radius: 5.6 },
  'chimneysweep:house': { period: 1.2, hit: 0.5, raise: -2.75, down: -2.35, bend: 0, fx: 'soot', sound: 'none', tool: 'brush', props: 'hearth', push: true, left: -0.35 },
  'cook:stall': { period: 2.4, raise: -1.45, down: -0.55, bend: 0.08, fx: 'steam', sound: 'none', tool: 'bowl', props: 'dishes', smooth: true, left: -0.7, queue: 'customer', radius: 6.4 },
  'butcher:stall': { period: 1.3, hit: 0.72, raise: -2.5, down: -0.95, bend: 0.2, fx: null, sound: 'chop', tool: 'cleaver', props: 'meatstall', left: -0.9, queue: 'customer', radius: 6.4 },
  'hunter:boar': { period: 3.4, hit: 0.62, raise: -1.5, down: -1.5, bend: 0, fx: null, sound: 'none', tool: null, props: 'boar', archer: true, once: true, radius: 6.5 },
  'hunter:stag': { period: 3.4, hit: 0.62, raise: -1.5, down: -1.5, bend: 0, fx: null, sound: 'none', tool: null, props: 'stag', archer: true, once: true, radius: 6.5 },
  'shepherd:pen': { period: 3.2, hit: 0.5, raise: -0.25, down: -0.25, bend: 0, fx: null, sound: 'none', tool: 'crook', props: 'pen', left: -0.6, look: true, turn: 1.9, radius: 8 },
  'engineer:site': { period: 2.0, hit: 0.5, raise: -1.1, down: -1.1, bend: 0.15, sound: 'none', tool: null, props: 'none', read: true, turn: 2.0, radius: 7.4 },
  // owner 2026-10-22: the tailor sews at a table, the physician grinds a remedy, the tax collector counts coins
  tailor: { period: 0.9, raise: -1.55, down: -1.08, bend: 0.15, sound: 'none', tool: null, props: 'sewing', smooth: true, left: -1.05 },
  physician: { period: 1.3, raise: -1.15, down: -1.15, bend: 0.2, fx: 'dust', sound: 'none', tool: null, props: 'remedies', stir: true, left: -0.95 },
  // the University's scholars (owner 2026-10-22): writing in a book at a sloped desk
  scholar: { period: 1.2, raise: -1.3, down: -1.08, bend: 0.18, sound: 'none', tool: null, props: 'desk', smooth: true, left: -1.05 },
  taxcollector: { period: 0.75, raise: -1.3, down: -1.05, bend: 0.12, sound: 'none', tool: null, props: 'ledger', smooth: true, left: -1.1 },
  // goals added 2026-10-22: the potter at the wheel (the pot grows), the cobbler and the cooper hammering,
  // the beekeeper puffing smoke over the hives, the bell founder striking a new bell, the clockmaker at a
  // bench of turning gears
  potter: { period: 1.6, raise: -1.05, down: -0.9, bend: 0.3, sound: 'none', tool: null, props: 'wheel', smooth: true, both: true },
  cobbler: { period: 0.5, hit: 0.75, raise: -1.75, down: -1.0, bend: 0.25, fx: 'dust', sound: 'chisel', tool: 'hammer', props: 'last', left: -1.0 },
  cooper: { period: 0.75, hit: 0.72, raise: -2.3, down: -1.0, bend: 0.15, fx: 'chips', sound: 'chop', tool: 'mallet', props: 'barrel', left: -0.9 },
  beekeeper: { period: 2.0, hit: 0.5, raise: -1.4, down: -1.0, bend: 0.1, fx: 'steam', sound: 'none', tool: 'smoker', props: 'hives', smooth: true, left: -0.5 },
  bellfounder: { period: 1.6, hit: 0.72, raise: -2.2, down: -1.2, bend: 0.1, fx: null, sound: 'anvil', tool: 'mallet', props: 'bell', left: -0.4 },
  clockmaker: { period: 1.1, raise: -1.3, down: -1.08, bend: 0.2, sound: 'none', tool: 'tongs', props: 'gears', smooth: true, left: -1.1 },
  // jobs only asked for in the comments: the rat catcher swings a sack at the rats (and misses), the chimney
  // sweep pushes a brush down a chimney (soot flies), the falconer's falcon flies off the glove and back,
  // the cook stirs a pot over the fire
  ratcatcher: { period: 1.3, hit: 0.65, raise: -2.4, down: -0.6, bend: 0.35, fx: 'dirt', sound: 'hoe', tool: 'sack', props: 'rats', both: true },
  chimneysweep: { period: 1.2, hit: 0.5, raise: -2.75, down: -2.35, bend: 0, fx: 'soot', sound: 'none', tool: 'brush', props: 'chimney', push: true, left: -0.35 },
  falconer: { period: 4.0, raise: -0.15, down: -0.15, bend: 0, sound: 'none', tool: null, props: 'falcon', smooth: true, left: -1.45, still: true },
  cook: { period: 2.0, hit: 0.5, raise: -1.2, down: -1.2, bend: 0.15, fx: 'steam', sound: 'none', tool: 'paddle', props: 'cauldron', stir: true, both: true },
  executioner: { period: 1.6, hit: 0.72, raise: -2.8, down: -0.9, bend: 0.25, fx: 'leaves', sound: 'chop', tool: 'axe', props: 'chopblock', both: true, hood: true },
  // asked for in the comments of 2026-10-22 (owner 2026-10-23): the hunter practises with the bow on a straw
  // deer (no animal is hurt), the butcher chops a ham under a rack of sausages, the engineer hammers at a
  // model trebuchet that now and then throws a turnip, the shepherd leans on the crook watching the sheep
  // graze, the tanner scrapes a hide over the beam beside the soaking tub
  hunter: { period: 2.6, hit: 0.62, raise: -1.5, down: -1.5, bend: 0, fx: null, sound: 'straw', tool: null, props: 'deer', archer: true },
  butcher: { period: 1.3, hit: 0.72, raise: -2.5, down: -0.95, bend: 0.2, fx: null, sound: 'chop', tool: 'cleaver', props: 'butchery', left: -0.9 },
  engineer: { period: 0.7, hit: 0.75, raise: -1.9, down: -1.0, bend: 0.2, fx: 'chips', sound: 'chop', tool: 'mallet', props: 'trebuchet', left: -0.9 },
  shepherd: { period: 3.2, hit: 0.5, raise: -0.25, down: -0.25, bend: 0, fx: null, sound: 'none', tool: 'crook', props: 'flock', left: -0.6, look: true },
  tanner: { period: 1.1, hit: 0.5, raise: -1.25, down: -0.95, bend: 0.35, fx: null, sound: 'none', tool: null, props: 'hide', push: true, both: true },
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
  'woodcutter:fell': { period: 1.5, hit: 0.7, raise: -2.7, down: -1.3, bend: 0, fx: 'chips', sound: 'chop', tool: 'axe', props: 'tree', left: -0.1, still: true },
  'stonemason:stack': { period: 2.4, hit: 0.5, raise: -1.45, down: -0.75, bend: 0.45, fx: 'dust', sound: 'none', tool: 'stone', props: 'wall', smooth: true, both: true },
  'carpenter:saw': { period: 0.7, hit: 0.5, raise: -1.2, down: -0.95, bend: 0.3, fx: 'sawdust', sound: 'none', tool: 'saw', props: 'trestle', push: true, left: -1.0 },
  'baker:knead': { period: 1.0, hit: 0.5, raise: -1.3, down: -1.0, bend: 0.3, fx: 'flour', sound: 'none', tool: null, props: 'dough', push: true, both: true },
  'fisherman:net': { period: 2.8, hit: 0.42, raise: -2.3, down: -0.8, bend: 0.15, fx: 'splash', sound: 'none', tool: 'net', props: 'pond', smooth: true, both: true, net: true },
  'miller:quern': { period: 1.2, hit: 0.5, raise: -1.1, down: -1.1, bend: 0.25, fx: 'flour', sound: 'none', tool: null, props: 'quern', stir: true, left: -0.9 },
  'fletcher:shoot': { period: 2.6, hit: 0.62, raise: -1.5, down: -1.5, bend: 0, fx: null, sound: 'straw', tool: null, props: 'butts', archer: true },
  // the bard plays the lute sitting on a stool by the house (stool and lute: props 'stool', cfg.lute)
  bard: { period: 0.5, raise: -0.8, down: -0.6, bend: -0.05, sound: 'none', tool: null, props: 'stool', lute: true, seated: true, focusH: 0.95, labelH: 2.0, turn: 0.35 },
  // the woodcutter loads logs from a pile onto a handcart (no longer picked, src/sim/scenes.js; old saves)
  'woodcutter:cart': { period: 2.3, hit: 0.5, raise: -1.45, down: -0.7, bend: 0.45, fx: null, sound: 'none', tool: 'logs', props: 'logcart', smooth: true, both: true, carry: true },
  'beggar:collapsed': { period: 3.8, raise: 0, down: 0, bend: 0, sound: 'none', tool: null, props: 'asleep', sleep: true, home: 2.4, homeTurn: Math.PI / 2, focusH: 0.45, labelH: 1.15, radius: 5 },
  'beggar:hat': { period: 3.4, raise: -1.5, down: -0.35, bend: 0.28, sound: 'none', tool: 'tankard', props: 'begging', smooth: true, left: -0.15, sway: true },
  'innkeeper:barrel': { period: 2.6, hit: 0.4, raise: -1.15, down: -0.95, bend: 0.1, fx: 'ale', sound: 'none', tool: 'tankard', props: 'keg', smooth: true, left: -0.7 },
  'brewer:stir': { period: 2.0, hit: 0.5, raise: -1.2, down: -1.2, bend: 0.2, fx: 'steam', sound: 'none', tool: 'paddle', props: 'vat', stir: true, both: true },
  // owner 2026-10-23: at their own place, with people queueing in front of them (queue.js; `queue`): the tax collector at
  // the door of the Counting House with taxpayers holding their purses, the apothecary at the Apothecary's Shop with the
  // sick and the lame, the merchant behind a market stall weighing goods for a haggling customer
  'taxcollector:counting': { period: 0.75, raise: -1.3, down: -1.05, bend: 0.12, sound: 'none', tool: null, props: 'ledger', smooth: true, left: -1.1, queue: 'tax', radius: 8.2 },
  apothecary: { period: 1.3, raise: -1.15, down: -1.15, bend: 0.2, fx: 'dust', sound: 'none', tool: null, props: 'remedies', stir: true, left: -0.95 },
  'apothecary:shop': { period: 1.3, raise: -1.15, down: -1.15, bend: 0.2, fx: 'dust', sound: 'none', tool: null, props: 'remedies', stir: true, left: -0.95, queue: 'sick', radius: 8.2 },
  'merchant:stall': { period: 2.2, raise: -1.35, down: -0.95, bend: 0.08, sound: 'none', tool: null, props: 'scales', smooth: true, left: -0.9, queue: 'customer', radius: 6.4 },
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
  } else if (kind === 'bowl') { // a wooden bowl of stew held out flat
    add(cylGeo(0.13, 0.08, 0.08, 12).translate(0, -0.02, 0.14), M.wood);
    add(cylGeo(0.115, 0.115, 0.01, 12).translate(0, 0.02, 0.14), M.clay);
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
  } else if (kind === 'smoker') { // a small tin can with a spout, smoke comes out of it
    add(cylGeo(0.08, 0.08, 0.2, 10).rotateX(Math.PI / 2).translate(0, -0.05, 0.12), iron);
    add(new THREE.ConeGeometry(0.06, 0.12, 8).rotateX(Math.PI / 2).translate(0, -0.05, 0.28), iron);
  } else if (kind === 'brush') { // the sweep's brush: a long pole on from the raised arms, a round bristle head at the end
    add(cylGeo(0.02, 0.02, 2.2, 6).translate(0, -1.1, 0.02), wood);
    add(new THREE.SphereGeometry(0.2, 10, 8).scale(1, 0.6, 1).translate(0, -2.25, 0.02), M.gear);
  } else if (kind === 'cleaver') { // a short handle and a wide square blade
    striker(g, M, { beta: 0.3, len: 0.32, back: 0.05, head: (put, along, h, p, end) => {
      put(along(boxGeo(0.025, 0.2, 0.26), p).translate(...end.clone().addScaledVector(p, 0.1).toArray()), iron);
      return 0.2;
    } });
  } else if (kind === 'crook') { // the shepherd's staff with its hook at the top
    add(cylGeo(0.025, 0.025, 1.9, 6).translate(0, 0.35, 0.08), wood);
    add(new THREE.TorusGeometry(0.1, 0.022, 5, 10, Math.PI * 1.2).rotateY(Math.PI / 2).translate(0, 1.38, 0.18), wood);
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
    case 'stool': { // a three-legged stool, an open lute case, a hat for coins
      add(cylGeo(0.22, 0.22, 0.06, 12).translate(0, 0.45, -0.05), M.wood);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; add(cylGeo(0.025, 0.03, 0.46, 5).translate(Math.cos(a) * 0.14, 0.22, -0.05 + Math.sin(a) * 0.14), M.woodDark); }
      add(boxGeo(0.4, 0.08, 0.8).translate(-0.7, 0.04, 0.3).rotateY(0.3), M.woodDark);
      add(cylGeo(0.18, 0.14, 0.1, 10).translate(0.6, 0.05, 0.7), M.gear);
      for (let i = 0; i < 3; i++) add(cylGeo(0.03, 0.03, 0.01, 8).translate(0.56 + i * 0.04, 0.1, 0.68), M.gold);
      return new THREE.Vector3(0, 1.0, 0.4);
    }
    case 'logcart': { // a two-wheeled handcart half full of logs in front, the woodpile behind on the left
      const wood = M.wood;
      add(boxGeo(1.1, 0.08, 1.6).translate(0.15, 0.62, 1.45), M.woodDark);
      for (const s of [-1, 1]) add(boxGeo(0.05, 0.3, 1.6).translate(0.15 + s * 0.53, 0.78, 1.45), M.woodDark);
      for (const s of [-1, 1]) {
        add(new THREE.TorusGeometry(0.42, 0.04, 6, 16).rotateY(Math.PI / 2).translate(0.15 + s * 0.65, 0.42, 1.55), M.woodDark);
        add(cylGeo(0.06, 0.06, 0.1, 8).rotateZ(Math.PI / 2).translate(0.15 + s * 0.65, 0.42, 1.55), M.iron);
      }
      for (const s of [-1, 1]) add(cylGeo(0.03, 0.03, 1.1, 6).rotateX(Math.PI / 2 - 0.25).translate(0.15 + s * 0.4, 0.45, 0.4), M.woodDark); // handles
      for (let i = 0; i < 5; i++) add(cylGeo(0.1, 0.1, 1.3, 8).rotateX(Math.PI / 2).translate(-0.17 + (i % 3) * 0.22, 0.76 + Math.floor(i / 3) * 0.19, 1.5), wood);
      for (let i = 0; i < 9; i++) add(cylGeo(0.11, 0.11, 1.2, 8).rotateZ(Math.PI / 2).translate(-1.35, 0.11 + Math.floor(i / 4) * 0.2, -0.5 + (i % 4) * 0.23), wood);
      return new THREE.Vector3(0.15, 0.9, 1.4);
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
    case 'sewing': { // a table with a cloak being sewn, a bolt of cloth, shears and a spool
      add(boxGeo(1.5, 0.08, 0.75).translate(0, 0.8, 0.62), M.wood);
      for (const x of [-0.65, 0.65]) add(boxGeo(0.08, 0.8, 0.65).translate(x, 0.4, 0.62), M.woodDark);
      add(boxGeo(1.1, 0.02, 0.6).translate(0.05, 0.85, 0.6), M.clothRed);
      add(cylGeo(0.16, 0.16, 0.7, 10).rotateX(Math.PI / 2).translate(-0.55, 1.0, 0.6), M.clothBlue);
      add(cylGeo(0.05, 0.05, 0.1, 8).translate(0.55, 0.9, 0.85), M.clothIvory);
      add(boxGeo(0.22, 0.02, 0.05).rotateY(0.4).translate(0.45, 0.86, 0.4), M.iron);
      return new THREE.Vector3(0, 0.9, 0.55);
    }
    case 'remedies': { // a table with a mortar and pestle, jars of remedies and a bundle of herbs
      add(boxGeo(1.4, 0.08, 0.7).translate(0, 0.8, 0.62), M.wood);
      for (const x of [-0.6, 0.6]) add(boxGeo(0.08, 0.8, 0.6).translate(x, 0.4, 0.62), M.woodDark);
      add(cylGeo(0.16, 0.12, 0.16, 12).translate(0, 0.92, 0.55), M.stoneDark); // the mortar
      const pestle = add(cylGeo(0.03, 0.04, 0.32, 8).translate(0, 0.12, 0).rotateX(-0.4), M.wood);
      pestle.position.set(0, 0.92, 0.55);
      anim.push((t, c) => { pestle.rotation.y = c * Math.PI * 2; }); // round and round in the mortar
      for (let i = 0; i < 4; i++) add(cylGeo(0.07, 0.08, 0.2 + (i % 2) * 0.08, 8).translate(-0.5 + i * 0.12, 0.94, 0.8 - (i % 2) * 0.1), M.clay);
      add(new THREE.ConeGeometry(0.1, 0.35, 6).rotateZ(Math.PI / 2).translate(0.45, 0.9, 0.75), M.greens);
      return new THREE.Vector3(0, 0.95, 0.55);
    }
    case 'desk': { // a sloped writing desk with an open book and a quill moving along the line, ink, books, a candle
      add(boxGeo(1.3, 0.08, 0.7).translate(0, 0.8, 0.62), M.wood);
      for (const x of [-0.55, 0.55]) add(boxGeo(0.08, 0.8, 0.6).translate(x, 0.4, 0.62), M.woodDark);
      add(boxGeo(0.8, 0.06, 0.5).rotateX(-0.25).translate(-0.05, 0.92, 0.6), M.woodDark); // the sloped top
      add(boxGeo(0.66, 0.03, 0.42).rotateX(-0.25).translate(-0.05, 0.96, 0.6), M.clothIvory); // the open book
      add(boxGeo(0.02, 0.04, 0.42).rotateX(-0.25).translate(-0.05, 0.97, 0.6), M.woodDark);
      const quill = add(new THREE.ConeGeometry(0.025, 0.3, 5).rotateX(-0.9).translate(0, 0.1, 0.05), M.clothIvory);
      quill.position.set(-0.2, 0.98, 0.55);
      anim.push((t, c) => { quill.position.x = -0.25 + 0.22 * c; quill.rotation.z = Math.sin(c * Math.PI * 8) * 0.12; });
      add(cylGeo(0.05, 0.06, 0.08, 8).translate(0.42, 0.88, 0.45), M.iron); // the inkpot
      for (let i = 0; i < 3; i++) add(boxGeo(0.34 - i * 0.03, 0.08, 0.25).rotateY(i * 0.25).translate(0.45, 0.88 + i * 0.08, 0.8), [M.clothRed, M.clothBlue, M.woodDark][i]);
      add(cylGeo(0.035, 0.035, 0.18, 8).translate(-0.5, 0.93, 0.85), M.clothIvory); // the candle
      add(new THREE.SphereGeometry(0.025, 6, 4).scale(1, 1.6, 1).translate(-0.5, 1.05, 0.85), M.lamp);
      add(cylGeo(0.05, 0.05, 0.4, 8).rotateZ(Math.PI / 2).translate(-0.3, 0.87, 0.95), M.clothIvory); // a scroll
      return new THREE.Vector3(-0.1, 0.98, 0.55);
    }
    case 'ledger': { // a table with the open tax book, a coin chest and stacks of coins
      add(boxGeo(1.4, 0.08, 0.7).translate(0, 0.8, 0.62), M.wood);
      for (const x of [-0.6, 0.6]) add(boxGeo(0.08, 0.8, 0.6).translate(x, 0.4, 0.62), M.woodDark);
      add(boxGeo(0.5, 0.04, 0.36).translate(-0.35, 0.86, 0.6), M.clothIvory); // the open book
      add(boxGeo(0.02, 0.05, 0.36).translate(-0.35, 0.87, 0.6), M.woodDark);
      add(boxGeo(0.45, 0.3, 0.3).translate(0.45, 0.99, 0.75), M.woodDark); // the chest, lid open
      add(boxGeo(0.45, 0.04, 0.3).rotateX(-1.1).translate(0.45, 1.25, 0.95), M.woodDark);
      add(boxGeo(0.4, 0.05, 0.25).translate(0.45, 1.1, 0.75), M.gold);
      for (const [x, n] of [[0.0, 5], [0.12, 3], [0.2, 7]]) add(cylGeo(0.04, 0.04, n * 0.012, 10).translate(x, 0.84 + n * 0.006, 0.45), M.gold);
      return new THREE.Vector3(0.05, 0.9, 0.5);
    }
    case 'scales': { // a balance on the stall's counter (the market stall is the counter), apples, a bolt of cloth, a jug
      add(boxGeo(0.3, 0.04, 0.2).translate(0.25, 1.02, 0.75), M.woodDark);
      add(cylGeo(0.025, 0.03, 0.5, 6).translate(0.25, 1.27, 0.75), M.iron);
      const beam = new THREE.Group();
      beam.position.set(0.25, 1.52, 0.75);
      holder.add(beam);
      const bm = new THREE.Mesh(boxGeo(0.62, 0.025, 0.025), M.iron);
      beam.add(bm);
      const pans = [-1, 1].map((s) => {
        const pan = new THREE.Group();
        pan.position.x = s * 0.3;
        beam.add(pan);
        const cord = new THREE.Mesh(cylGeo(0.006, 0.006, 0.22, 4).translate(0, -0.11, 0), M.iron);
        const dish = new THREE.Mesh(cylGeo(0.11, 0.07, 0.03, 12).translate(0, -0.23, 0), M.gold);
        pan.add(cord, dish);
        return pan;
      });
      const apple = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6).translate(0, -0.18, 0), M.clothRed);
      pans[0].add(apple);
      anim.push((t, c) => {
        beam.rotation.z = 0.16 * Math.sin(c * Math.PI * 2);
        for (const p of pans) p.rotation.z = -beam.rotation.z; // the pans hang straight down
      });
      for (let i = 0; i < 6; i++) add(new THREE.SphereGeometry(0.06, 8, 6).translate(-0.35 + (i % 3) * 0.12, 1.06 + Math.floor(i / 3) * 0.08, 0.7 + (i % 2) * 0.08), M.clothRed);
      add(cylGeo(0.12, 0.12, 0.5, 10).rotateZ(Math.PI / 2).translate(-0.2, 1.12, 1.0), M.clothBlue);
      add(cylGeo(0.06, 0.08, 0.22, 8).translate(0.65, 1.11, 0.95), M.clay);
      return new THREE.Vector3(0.1, 1.1, 0.7);
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
    case 'wheel': { // a potter's wheel turning; the pot on it grows taller through the shot
      add(boxGeo(0.7, 0.62, 0.7).translate(0, 0.31, 0.62), M.woodDark);
      const wheel = add(cylGeo(0.36, 0.36, 0.06, 18).translate(0, 0.65, 0), M.wood);
      wheel.position.z = 0.62;
      const pot = add(new THREE.SphereGeometry(0.17, 14, 10).scale(1, 1.3, 1).translate(0, 0.2, 0), M.clay);
      pot.position.set(0, 0.68, 0.62);
      for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.13, 12, 8).scale(1, 1.4, 1).translate(-1.0 + i * 0.3, 0.18, 1.1), M.clay); // finished pots
      anim.push((t) => {
        wheel.rotation.y = pot.rotation.y = t * 7;
        pot.scale.y = 0.45 + 0.55 * Math.min(1, (t % 6) / 4);
      });
      return new THREE.Vector3(0, 0.92, 0.62);
    }
    case 'last': { // a low bench with a shoe on an iron last
      add(boxGeo(1.2, 0.45, 0.5).translate(0.2, 0.22, 0.65), M.wood);
      add(cylGeo(0.05, 0.06, 0.3, 8).translate(0, 0.6, 0.65), M.iron);
      add(boxGeo(0.14, 0.12, 0.34).translate(0, 0.8, 0.65), M.woodDark); // the shoe
      for (const x of [0.5, 0.72]) add(boxGeo(0.14, 0.12, 0.32).translate(x, 0.51, 0.62), M.woodDark); // a finished pair
      return new THREE.Vector3(0, 0.86, 0.65);
    }
    case 'barrel': { // a barrel standing on end; the hoop is hammered down round its top
      add(cylGeo(0.36, 0.33, 0.9, 16).translate(0, 0.45, 0.75), M.wood);
      for (const y of [0.15, 0.75]) add(new THREE.TorusGeometry(0.36, 0.02, 4, 18).rotateX(Math.PI / 2).translate(0, y, 0.75), M.iron);
      for (let i = 0; i < 3; i++) add(cylGeo(0.36, 0.36, 0.9, 14).rotateZ(Math.PI / 2).translate(1.2, 0.36 + i * 0.0, 0.2 + i * 0.75), M.wood); // finished barrels
      return new THREE.Vector3(0, 0.9, 0.75);
    }
    case 'hives': { // straw skeps on a bench, bees circling them
      add(boxGeo(2.0, 0.5, 0.6).translate(0, 0.25, 0.9), M.woodDark);
      const bees = [];
      for (const x of [-0.65, 0, 0.65]) {
        add(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.3, 1).translate(x, 0.5, 0.9), M.hay);
        for (let k = 0; k < 4; k++) bees.push({ m: add(new THREE.SphereGeometry(0.03, 6, 4), M.iron), x, k });
      }
      anim.push((t) => {
        for (const b of bees) {
          const a = t * (2.5 + b.k * 0.4) + b.k * 1.6 + b.x * 3;
          b.m.position.set(b.x + Math.cos(a) * (0.35 + 0.1 * b.k), 0.75 + 0.15 * Math.sin(a * 1.7), 0.9 + Math.sin(a) * (0.35 + 0.1 * b.k));
        }
      });
      return new THREE.Vector3(0, 0.95, 0.8);
    }
    case 'bell': { // a new bronze bell hanging from a timber frame; it swings a little when struck
      for (const x of [-0.9, 0.9]) add(boxGeo(0.16, 2.3, 0.16).translate(x, 1.15, 0.9), M.woodDark);
      add(boxGeo(2.0, 0.16, 0.18).translate(0, 2.3, 0.9), M.woodDark);
      const bell = new THREE.Group();
      bell.position.set(0, 2.22, 0.9);
      holder.add(bell);
      for (const [geo, m] of [[cylGeo(0.28, 0.55, 0.85, 18, 1).translate(0, -0.55, 0), M.gold], [cylGeo(0.06, 0.06, 0.12, 8).translate(0, -0.06, 0), M.iron]]) {
        const o = new THREE.Mesh(geo, m); o.castShadow = true; bell.add(o);
      }
      anim.push((t, c, swing) => { bell.rotation.x = 0.08 * swing * Math.sin(t * 9); });
      return new THREE.Vector3(0, 1.45, 0.4);
    }
    case 'gears': { // a bench with brass gears turning and a clock face waiting for its hands
      add(boxGeo(1.4, 0.08, 0.7).translate(0, 0.8, 0.62), M.wood);
      for (const x of [-0.6, 0.6]) add(boxGeo(0.08, 0.8, 0.6).translate(x, 0.4, 0.62), M.woodDark);
      const gears = [[-0.35, 0.16, 1], [-0.1, 0.1, -1.6], [0.32, 0.13, 1.2]].map(([x, r, k]) => {
        const g = add(cylGeo(r, r, 0.03, 12), M.gold);
        g.position.set(x, 0.86, 0.6);
        return { g, k };
      });
      add(cylGeo(0.22, 0.22, 0.03, 20).rotateX(Math.PI / 2).translate(0.35, 1.08, 0.9), M.clothIvory);
      anim.push((t) => { for (const { g, k } of gears) g.rotation.y = t * k; });
      return new THREE.Vector3(0, 0.9, 0.55);
    }
    case 'rats': { // rats running round in front of the rat catcher, never caught
      const rats = [0, 1, 2].map(() => {
        const r = new THREE.Group();
        r.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.8, 1.8), M.stoneDark), { castShadow: true }));
        r.add(new THREE.Mesh(cylGeo(0.008, 0.004, 0.2, 4).rotateX(Math.PI / 2).translate(0, 0, -0.2), M.stoneDark));
        holder.add(r);
        return r;
      });
      anim.push((t) => rats.forEach((r, i) => {
        const a = t * 2.2 + i * 2.1;
        r.position.set(Math.cos(a) * 0.7, 0.06, 1.0 + Math.sin(a) * 0.5);
        r.rotation.y = -a; // running round the circle
      }));
      add(cylGeo(0.3, 0.35, 0.5, 10).translate(1.2, 0.25, 0.4), M.wood); // a barrel they live under
      return new THREE.Vector3(0, 0.1, 1.0);
    }
    case 'chimney': { // a tall chimney stack at the croft's corner, the brush pushed into its top
      // under the brush head halfway through the push (the right arm at -2.55, the pole 2.25 m on from the hand)
      add(boxGeo(0.8, 3.4, 0.8).translate(0.3, 1.7, 1.65), M.stone);
      add(boxGeo(0.95, 0.15, 0.95).translate(0.3, 3.45, 1.65), M.stoneDark);
      return new THREE.Vector3(0.3, 3.6, 1.65);
    }
    case 'falcon': { // a perch; the falcon flies off the glove, circles high and comes back
      add(boxGeo(0.1, 1.5, 0.1).translate(1.0, 0.75, 0.4), M.woodDark);
      add(boxGeo(0.5, 0.06, 0.06).translate(1.0, 1.5, 0.4), M.woodDark);
      const bird = new THREE.Group();
      holder.add(bird);
      bird.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6).scale(0.8, 0.9, 1.6), M.wood), { castShadow: true }));
      const wings = [-1, 1].map((s) => {
        const wg = new THREE.Group();
        wg.add(new THREE.Mesh(boxGeo(0.4, 0.02, 0.18).translate(s * 0.2, 0, 0), M.woodDark));
        bird.add(wg);
        return { wg, s };
      });
      const glove = new THREE.Vector3(-0.3, 1.43, 0.66), C0 = new THREE.Vector3(0, 3.4, 3.0);
      const loop = (a) => new THREE.Vector3(C0.x + Math.sin(a) * 2.6, C0.y + 0.4 * Math.sin(a * 2), C0.z - Math.cos(a) * 2.6);
      anim.push((t, c) => {
        const u = c - Math.floor(c);
        let flap = 0;
        if (u < 0.2) bird.position.copy(glove);
        else if (u < 0.3) { bird.position.copy(glove).lerp(loop(0), (u - 0.2) / 0.1); flap = 1; }
        else if (u < 0.85) { bird.position.copy(loop(((u - 0.3) / 0.55) * Math.PI * 2)); flap = 1; }
        else { bird.position.copy(loop(Math.PI * 2)).lerp(glove, (u - 0.85) / 0.15); flap = 1; }
        bird.rotation.y = u < 0.2 ? 0 : -((u - 0.3) / 0.55) * Math.PI * 2;
        for (const { wg, s } of wings) wg.rotation.z = s * (flap ? 0.6 * Math.sin(t * 18) : -0.9); // folded on the glove
      });
      return new THREE.Vector3(-0.3, 1.5, 0.66);
    }
    case 'cauldron': { // a pot on a tripod over a fire, the stew steaming
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        add(cylGeo(0.025, 0.025, 1.1, 5).translate(0, 0.55, 0).rotateZ(Math.cos(a) * 0.3).rotateX(Math.sin(a) * 0.3).translate(Math.cos(a) * 0.45, 0, 1.05 + Math.sin(a) * 0.45), M.iron);
      }
      add(cylGeo(0.5, 0.38, 0.5, 16).translate(0, 0.62, 1.05), M.iron);
      add(cylGeo(0.47, 0.47, 0.02, 16).translate(0, 0.85, 1.05), M.clay);
      for (let i = 0; i < 4; i++) add(cylGeo(0.05, 0.06, 0.6, 6).rotateZ(Math.PI / 2).rotateY(i * 0.8).translate(0, 0.08, 1.05), M.woodDark);
      add(new THREE.ConeGeometry(0.25, 0.35, 8).translate(0, 0.25, 1.05), new THREE.MeshBasicMaterial({ color: '#ff9a3c' }));
      return new THREE.Vector3(0, 0.88, 1.05);
    }
    case 'deer': { // a straw deer for practice, side on a few metres away, a red mark on its flank
      const d = new THREE.Vector3(-Math.cos(1.3), 0, Math.sin(1.3));
      const c = new THREE.Vector3(-0.26, 1.0, 0.92).addScaledVector(d, 2.1);
      const deer = new THREE.Group();
      deer.position.copy(c);
      deer.rotation.y = Math.atan2(d.x, d.z);
      holder.add(deer);
      const part = (geo, m) => deer.add(Object.assign(new THREE.Mesh(geo, m), { castShadow: true }));
      part(cylGeo(0.24, 0.24, 1.0, 12).rotateZ(Math.PI / 2), M.hay);
      part(cylGeo(0.09, 0.11, 0.55, 8).rotateZ(0.6).translate(-0.55, 0.32, 0), M.hay); // the head toward the archer's side
      part(new THREE.SphereGeometry(0.13, 10, 8).scale(1.5, 0.9, 0.9).translate(-0.78, 0.58, 0), M.hay);
      for (const s of [-1, 1]) {
        part(cylGeo(0.015, 0.02, 0.35, 5).rotateX(s * 0.35).translate(-0.72, 0.82, s * 0.06), M.woodDark); // antlers
        part(cylGeo(0.012, 0.012, 0.16, 5).rotateZ(-0.8).rotateX(s * 0.35).translate(-0.66, 0.92, s * 0.1), M.woodDark);
      }
      for (const [x, z] of [[-0.38, -0.12], [-0.38, 0.12], [0.38, -0.12], [0.38, 0.12]]) part(boxGeo(0.06, 0.8, 0.06).translate(x, -0.6, z), M.woodDark);
      part(cylGeo(0.12, 0.12, 0.02, 14).rotateX(Math.PI / 2).translate(0, 0, -0.245), M.clothRed);
      return c;
    }
    case 'butchery': { // a chopping block with a ham on it, a rack of sausages and a ham hanging behind
      add(cylGeo(0.4, 0.46, 0.55, 12).translate(0, 0.27, 0.75), M.wood);
      add(new THREE.SphereGeometry(0.2, 10, 8).scale(1.4, 0.8, 1).translate(0.05, 0.68, 0.75), M.clay);
      for (const x of [-0.9, 0.9]) add(boxGeo(0.08, 2.0, 0.08).translate(x, 1.0, 1.6), M.woodDark);
      add(boxGeo(1.9, 0.07, 0.07).translate(0, 1.95, 1.6), M.woodDark);
      for (let k = 0; k < 5; k++) for (let i = 0; i < 3; i++) add(cylGeo(0.05, 0.05, 0.2, 8).translate(-0.6 + k * 0.3, 1.78 - i * 0.22, 1.6), M.clay);
      add(new THREE.SphereGeometry(0.2, 10, 8).scale(0.9, 1.5, 0.9).translate(0.75, 1.45, 1.6), M.clay); // a ham on a hook
      add(boxGeo(0.9, 0.75, 0.5).translate(-1.3, 0.37, 0.4), M.wood); // the meat box
      return new THREE.Vector3(0, 0.82, 0.75);
    }
    case 'trebuchet': { // a model trebuchet on a trestle; the arm throws a turnip now and then
      add(boxGeo(1.6, 0.08, 0.6).translate(0, 0.55, 0.8), M.wood);
      for (const x of [-0.7, 0.7]) add(boxGeo(0.08, 0.55, 0.5).translate(x, 0.27, 0.8), M.woodDark);
      for (const z of [-0.2, 0.2]) for (const s of [-1, 1]) add(boxGeo(0.05, 0.75, 0.05).rotateZ(s * 0.3).translate(s * 0.12, 0.92, 0.8 + z), M.woodDark); // the A-frames
      const arm = new THREE.Group();
      arm.position.set(0, 1.25, 0.8);
      holder.add(arm);
      arm.add(Object.assign(new THREE.Mesh(boxGeo(1.1, 0.04, 0.04).translate(0.25, 0, 0), M.woodDark), { castShadow: true }));
      arm.add(Object.assign(new THREE.Mesh(boxGeo(0.14, 0.14, 0.14).translate(-0.3, -0.08, 0), M.stoneDark), { castShadow: true }));
      const turnip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.clothIvory);
      holder.add(turnip);
      anim.push((t) => {
        const u = (t % 4.5) / 4.5;
        arm.rotation.z = u < 0.08 ? -0.7 + (u / 0.08) * 2.2 : 1.5 - Math.min(1, (u - 0.08) / 0.5) * 2.2; // a fast throw, then wound back
        turnip.visible = u < 0.45;
        if (u < 0.08) turnip.position.set(0.25 + Math.cos(arm.rotation.z) * 0.8, 1.25 + Math.sin(arm.rotation.z) * 0.8, 0.8);
        else { const k = (u - 0.08) / 0.37; turnip.position.set(-0.2 - k * 3.0, 2.0 + 2.2 * k - 4.5 * k * k, 0.8 + k * 2.0); }
      });
      return new THREE.Vector3(0, 0.6, 0.6);
    }
    case 'flock': { // sheep grazing in front of the shepherd
      const flock = [[0.6, 1.8, 0.4], [-0.7, 2.3, -0.6], [0.1, 3.0, 2.4], [1.3, 2.7, 1.2]].map(([x, z, yaw], i) => {
        const s = sheep(M);
        s.g.position.set(x, 0, z);
        s.g.rotation.y = yaw;
        holder.add(s.g);
        return { ...s, ph: i * 1.7 };
      });
      anim.push((t) => flock.forEach((s) => { s.head.rotation.x = 0.55 + 0.25 * Math.sin(t * 1.3 + s.ph); }));
      return new THREE.Vector3(0, 1.2, 0.8);
    }
    case 'hide': { // the tanner's beam: a hide over a sloping log, a soaking tub and a hide drying on a frame
      // the beam slopes down away from the tanner; the hide lies over its upper half
      add(cylGeo(0.14, 0.16, 1.5, 10).rotateX(-1.0).translate(0, 0.45, 1.0), M.wood);
      add(cylGeo(0.17, 0.19, 0.8, 10).translate(0, 0.35, 0).rotateX(-1.0).translate(0, 0.45, 1.0), M.soil);
      add(boxGeo(0.5, 0.35, 0.08).translate(0, 0.17, 1.65), M.woodDark);
      add(cylGeo(0.45, 0.4, 0.6, 14).translate(1.3, 0.3, 0.6), M.wood);
      add(cylGeo(0.42, 0.42, 0.02, 14).translate(1.3, 0.56, 0.6), M.stoneDark);
      for (const x of [1.2, 2.2]) add(boxGeo(0.07, 1.8, 0.07).translate(x, 0.9, 1.9), M.woodDark); // the drying frame, behind
      for (const y of [0.35, 1.7]) add(boxGeo(1.1, 0.06, 0.06).translate(1.7, y, 1.9), M.woodDark);
      add(boxGeo(0.85, 1.2, 0.02).translate(1.7, 1.02, 1.9), M.soil);
      // owner 2026-10-23: a long rack of hides drying behind the tanner, stretched on frames, a few hung over a pole
      const hides = [M.soil, M.gear, M.clay];
      for (let i = 0; i < 4; i++) {
        const x = -1.9 + i * 1.15, z = -1.5 - (i % 2) * 0.25;
        for (const dx of [-0.5, 0.5]) add(boxGeo(0.07, 2.0, 0.07).translate(x + dx, 1.0, z), M.woodDark);
        for (const y of [0.4, 1.9]) add(boxGeo(1.1, 0.06, 0.06).translate(x, y, z), M.woodDark);
        add(boxGeo(0.82, 1.3 - (i % 3) * 0.12, 0.02).translate(x, 1.15, z), hides[i % 3]);
        for (let k = 0; k < 4; k++) add(cylGeo(0.006, 0.006, 0.16, 3).rotateZ(Math.PI / 2).translate(x + (k < 2 ? -0.47 : 0.47), 0.75 + (k % 2) * 0.75, z), M.clothIvory); // the lacing
      }
      add(boxGeo(4.4, 0.07, 0.07).translate(-0.2, 1.7, -2.6), M.woodDark);
      for (const x of [-2.4, 2.0]) add(boxGeo(0.08, 1.7, 0.08).translate(x, 0.85, -2.6), M.woodDark);
      for (let i = 0; i < 3; i++) add(boxGeo(0.7, 0.02, 0.9).rotateX(Math.PI / 2).translate(-1.3 + i * 1.3, 1.25, -2.6), hides[(i + 1) % 3]);
      return new THREE.Vector3(0, 0.82, 0.5);
    }
    case 'busk': { // a hat for coins in front, two listeners a few steps off, one clapping
      add(cylGeo(0.18, 0.14, 0.1, 10).translate(0.5, 0.05, 1.1), M.gear);
      for (let i = 0; i < 4; i++) add(cylGeo(0.03, 0.03, 0.01, 8).translate(0.45 + i * 0.04, 0.1, 1.08), M.gold);
      const fans = [[1.8, 1.7, '#3f5a7a'], [2.5, 0.5, '#8a6a3a']].map(([x, z, color], i) => {
        const P = rig(M, color);
        P.root.position.set(x, 0, z);
        P.root.rotation.y = Math.atan2(-x, -z);
        holder.add(P.root);
        return { P, i };
      });
      anim.push((t) => fans.forEach(({ P, i }) => {
        if (i === 0) { const k = Math.abs(Math.sin(t * 6)); P.r.g.rotation.set(-1.2, 0, -0.35 + 0.25 * k); P.l.g.rotation.set(-1.2, 0, 0.35 - 0.25 * k); } // clapping
        else { P.r.g.rotation.set(-0.15, 0, 0); P.l.g.rotation.set(-0.15, 0, 0); }
        P.body.rotation.z = 0.05 * Math.sin(t * 2.2 + i * 2);
      }));
      return new THREE.Vector3(0, 1.2, 0.4);
    }
    case 'alley': { // rats round the rat catcher's feet in a narrow alley, a barrel and a broken crate against the wall
      const rats = [0, 1, 2].map(() => {
        const r = new THREE.Group();
        r.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6).scale(1, 0.8, 1.8), M.stoneDark), { castShadow: true }));
        r.add(new THREE.Mesh(cylGeo(0.008, 0.004, 0.2, 4).rotateX(Math.PI / 2).translate(0, 0, -0.2), M.stoneDark));
        holder.add(r);
        return r;
      });
      anim.push((t) => rats.forEach((r, i) => {
        const a = t * 2.6 + i * 2.1;
        r.position.set(Math.cos(a) * 0.45, 0.06, 0.9 + Math.sin(a) * 0.5);
        r.rotation.y = -a;
      }));
      add(cylGeo(0.3, 0.35, 0.6, 10).translate(-0.55, 0.3, 1.9), M.wood);
      add(boxGeo(0.5, 0.35, 0.45).rotateY(0.4).rotateZ(0.25).translate(0.45, 0.2, 2.4), M.woodDark);
      return new THREE.Vector3(0, 0.1, 0.9);
    }
    case 'hearth': // the fireplace is part of the room (room.js): soot falls from the flue above the sweep
      return new THREE.Vector3(0, 2.2, 0.15);
    case 'dishes': { // a pot of stew steaming on a brazier on the stall's counter, a stack of bowls, a loaf, a ladle
      add(cylGeo(0.22, 0.25, 0.12, 10).translate(-0.45, 1.06, 0.7), M.iron);
      add(boxGeo(0.3, 0.05, 0.3).translate(-0.45, 1.12, 0.7), M.ember);
      add(cylGeo(0.24, 0.2, 0.3, 14).translate(-0.45, 1.3, 0.7), M.iron);
      add(cylGeo(0.22, 0.22, 0.02, 14).translate(-0.45, 1.44, 0.7), M.clay);
      add(cylGeo(0.012, 0.012, 0.45, 5).rotateZ(0.5).translate(-0.35, 1.6, 0.7), M.woodDark);
      for (let i = 0; i < 4; i++) add(cylGeo(0.11, 0.07, 0.06, 10).translate(0.35, 1.03 + i * 0.05, 0.75), M.wood);
      for (const x of [0.05, 0.62]) {
        add(cylGeo(0.11, 0.07, 0.06, 10).translate(x, 1.03, 0.95), M.wood);
        add(cylGeo(0.09, 0.09, 0.01, 10).translate(x, 1.06, 0.95), M.clay);
      }
      add(new THREE.SphereGeometry(0.12, 10, 8).scale(1.5, 0.7, 1).translate(0.7, 1.06, 0.6), M.hay);
      return new THREE.Vector3(-0.45, 1.5, 0.7);
    }
    case 'meatstall': { // a block on the stall's counter with a joint on it, hams and strings of sausages hanging from the awning
      add(cylGeo(0.22, 0.24, 0.16, 12).translate(0, 1.08, 0.75), M.wood);
      add(new THREE.SphereGeometry(0.13, 10, 8).scale(1.5, 0.7, 1).translate(0.05, 1.22, 0.75), M.clay);
      add(boxGeo(2.6, 0.06, 0.06).translate(0, 2.05, 1.15), M.woodDark);
      for (const x of [-1.0, -0.55, 0.55, 1.0]) {
        add(cylGeo(0.006, 0.006, 0.18, 3).translate(x, 1.95, 1.15), M.iron);
        add(new THREE.SphereGeometry(0.15, 10, 8).scale(0.85, 1.6, 0.85).translate(x, 1.62, 1.15), M.clay); // a ham
        add(cylGeo(0.04, 0.05, 0.12, 6).translate(x, 1.86, 1.15), M.clothIvory); // its bone
      }
      for (const x of [-0.25, 0.25]) for (let i = 0; i < 4; i++) add(cylGeo(0.04, 0.04, 0.16, 6).translate(x, 1.93 - i * 0.17, 1.15), M.clay);
      for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.12, 8, 6).scale(1.6, 0.8, 1).translate(-0.6 + i * 0.32, 1.04, 0.95), M.clay);
      return new THREE.Vector3(0, 1.17, 0.75);
    }
    case 'boar':
    case 'stag': { // an animal at the edge of the trees: it grazes, the arrow lands short, it bolts (nobody gets hurt)
      const d = new THREE.Vector3(-Math.cos(1.3), 0, Math.sin(1.3));
      const c = new THREE.Vector3(-0.26, 0, 0.92).addScaledVector(d, 5.4);
      const beast = new THREE.Group();
      beast.position.copy(c);
      beast.rotation.y = Math.atan2(d.x, d.z);
      holder.add(beast);
      const hide = new THREE.MeshStandardMaterial({ color: kind === 'boar' ? '#3b2c22' : '#8a5a34', roughness: 0.9 });
      const part = (geo, m, parent = beast) => parent.add(Object.assign(new THREE.Mesh(geo, m), { castShadow: true }));
      const boar = kind === 'boar', bodyH = boar ? 0.55 : 0.95;
      part(new THREE.SphereGeometry(boar ? 0.36 : 0.32, 12, 9).scale(boar ? 1.7 : 1.9, boar ? 1.05 : 0.95, 1).translate(0, bodyH, 0), hide);
      const head = new THREE.Group();
      head.position.set(boar ? -0.62 : -0.6, bodyH + (boar ? 0.02 : 0.25), 0);
      beast.add(head);
      if (boar) {
        part(cylGeo(0.13, 0.22, 0.42, 10).rotateZ(Math.PI / 2).translate(-0.12, -0.02, 0), hide, head);
        part(cylGeo(0.07, 0.07, 0.04, 10).rotateZ(Math.PI / 2).translate(-0.34, -0.03, 0), M.clay, head); // the snout
        for (const s of [-1, 1]) {
          part(new THREE.ConeGeometry(0.02, 0.13, 5).rotateZ(-0.6).translate(-0.28, 0.03, s * 0.08), M.clothIvory, head); // tusks
          part(new THREE.ConeGeometry(0.05, 0.11, 4).translate(0.02, 0.17, s * 0.09), hide, head); // ears
        }
        part(boxGeo(0.95, 0.07, 0.05).translate(0.05, bodyH + 0.36, 0), M.stoneDark); // the bristly ridge
      } else {
        part(cylGeo(0.09, 0.13, 0.55, 8).rotateZ(-0.7).translate(0.15, -0.12, 0), hide, head); // the neck
        part(new THREE.SphereGeometry(0.12, 10, 8).scale(1.6, 0.9, 0.9).translate(-0.12, 0.12, 0), hide, head);
        for (const s of [-1, 1]) {
          part(cylGeo(0.015, 0.022, 0.42, 5).rotateX(s * 0.45).translate(0, 0.38, s * 0.1), M.woodDark, head); // antlers
          for (const k of [0, 1]) part(cylGeo(0.01, 0.014, 0.17, 5).rotateZ(-0.9 + k * 0.4).rotateX(s * 0.45).translate(-0.06, 0.4 + k * 0.12, s * (0.13 + k * 0.05)), M.woodDark, head);
        }
        part(new THREE.SphereGeometry(0.06, 8, 6).translate(0.6, bodyH + 0.12, 0), M.clothIvory); // white tail
      }
      const legs = [[-0.36, -0.13], [-0.36, 0.13], [0.36, -0.13], [0.36, 0.13]].map(([x, z]) => {
        const leg = new THREE.Group();
        leg.position.set(x, bodyH - 0.12, z);
        beast.add(leg);
        part(boxGeo(0.07, bodyH - 0.08, 0.07).translate(0, -(bodyH - 0.08) / 2, 0), boar ? M.stoneDark : hide, leg);
        return leg;
      });
      // the arrow lands in the grass a little short of the animal; then it turns and bolts toward the trees
      const hit = 0.62;
      anim.push((t, cyc) => {
        const u = cyc - Math.floor(cyc), run = u > hit + 0.03 ? (u - hit - 0.03) / (1 - hit) : 0;
        beast.position.copy(c).addScaledVector(d, run * run * 9 + run * 2);
        beast.rotation.y = Math.atan2(d.x, d.z) + Math.min(1, run * 5) * (Math.PI / 2); // head away from the hunter
        beast.position.y = run > 0 ? 0.12 * Math.abs(Math.sin(t * 14)) : 0;
        head.rotation.z = run > 0 ? -0.2 : 0.45 + 0.2 * Math.sin(t * 1.6); // grazing, head down
        legs.forEach((leg, i) => { leg.rotation.z = run > 0 ? 0.7 * Math.sin(t * 16 + (i % 2) * Math.PI + (i > 1 ? 1 : 0)) : 0; });
      });
      return c.clone().addScaledVector(d, -0.75).setY(0.05);
    }
    case 'pen': { // a pen of split rails with sheep in it, the shepherd at the gate
      const P0 = [-2.3, 0.6], P1 = [2.3, 4.6];
      const rails = [];
      for (const [ax, az, bx, bz] of [[P0[0], P0[1], P1[0], P0[1]], [P1[0], P0[1], P1[0], P1[1]], [P1[0], P1[1], P0[0], P1[1]], [P0[0], P1[1], P0[0], P0[1]]]) {
        const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 1.5);
        for (let i = 0; i <= n; i++) rails.push(boxGeo(0.1, 1.05, 0.1).translate(ax + ((bx - ax) * i) / n, 0.52, az + ((bz - az) * i) / n));
        for (const y of [0.45, 0.85]) {
          if (az === P0[1] && bz === P0[1] && y) { // the front side has the open gate in the middle
            for (const [x0, x1] of [[ax, -0.6], [0.6, bx]]) rails.push(boxGeo(Math.abs(x1 - x0), 0.07, 0.05).translate((x0 + x1) / 2, y, az));
            continue;
          }
          rails.push(boxGeo(len, 0.07, 0.05).rotateY(-Math.atan2(bz - az, bx - ax)).translate((ax + bx) / 2, y, (az + bz) / 2));
        }
      }
      add(merged(rails), M.woodDark);
      const gate = new THREE.Group();
      gate.position.set(0.6, 0, P0[1]);
      gate.rotation.y = -1.2; // swung open
      holder.add(gate);
      for (const y of [0.45, 0.85]) gate.add(Object.assign(new THREE.Mesh(boxGeo(1.2, 0.07, 0.05).translate(-0.6, y, 0), M.wood), { castShadow: true }));
      add(boxGeo(0.9, 0.08, 0.4).translate(1.6, 0.35, 3.9), M.wood); // a trough
      const flock = Array.from({ length: 7 }, (_, i) => {
        const s = sheep(M);
        s.g.position.set(-1.5 + (i % 4) * 1.0 + (i > 3 ? 0.5 : 0), 0, 1.7 + Math.floor(i / 4) * 1.5 + (i % 2) * 0.3);
        s.g.rotation.y = i * 1.9;
        holder.add(s.g);
        return { ...s, ph: i * 1.3 };
      });
      anim.push((t) => flock.forEach((s) => { s.head.rotation.x = 0.55 + 0.25 * Math.sin(t * 1.2 + s.ph); }));
      return new THREE.Vector3(0, 1.2, 2.4);
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
  soot: { n: 26, color: '#2a2a2c', size: 0.12, add: false, speed: [0.3, 1.0], up: [0.8, 1.8], life: 1.1 },
  ale: { n: 14, color: '#c98a2b', size: 0.05, add: false, speed: [0, 0.05], up: [-0.6, -0.2], life: 0.35, bias: 0 },
};

/** A lute held across the chest (child of the body): pear-shaped body low right, the neck up to the left. */
export function lute(M) {
  const g = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); return m; };
  add(new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2).scale(1, 1.3, 0.8), M.wood);
  add(cylGeo(0.155, 0.155, 0.01, 16).rotateX(Math.PI / 2).scale(1, 1.3, 1).translate(0, 0, 0.005), M.hay); // the soundboard
  add(cylGeo(0.035, 0.035, 0.01, 10).rotateX(Math.PI / 2).translate(0, 0.04, 0.012), M.gear); // the rose
  add(boxGeo(0.06, 0.42, 0.03).translate(0, 0.38, 0.01), M.woodDark); // the neck
  add(boxGeo(0.07, 0.14, 0.03).rotateX(-0.9).translate(0, 0.62, -0.04), M.woodDark); // the bent-back head
  g.position.set(0.08, 0.5, 0.29);
  g.rotation.set(0, 0, 0.95);
  g.scale.setScalar(1.35);
  return g;
}

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
// bare: no props of its own (a scene that builds the place itself, like the wheat fields in ambient.js)
export function buildWorkScene({ job, variant = null, anchor, face, M, seed, id, color = null, bare = false, t0 = 0 }) {
  const cfg = sceneOf(job, variant);
  const group = new THREE.Group();
  group.position.copy(anchor);
  group.rotation.y = face;
  const P = rig(M, color || JOBS[job]?.color || '#7a6a55', { walk: !!cfg.archer || !!cfg.haul, ground: !!cfg.ground, seated: !!cfg.seated });
  if (cfg.lute) P.body.add(lute(M));
  group.add(P.root);
  const propsG = new THREE.Group();
  group.add(propsG);
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; propsG.add(m); return m; };
  const anim = [];
  const impact = buildProps(cfg.props, M, add, anim, propsG);
  propsG.visible = !bare;
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
  // juggled balls, or burning torches: a wooden stick with a flame at one end, turning over in the air
  const torch = () => {
    const g = new THREE.Group();
    g.add(Object.assign(new THREE.Mesh(cylGeo(0.026, 0.032, 0.6, 6), M.woodDark), { castShadow: true }));
    g.add(new THREE.Mesh(cylGeo(0.05, 0.04, 0.1, 8).translate(0, 0.31, 0), M.gear));
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 7).translate(0, 0.5, 0), M.flame);
    g.add(flame);
    g.userData.flame = flame;
    return g;
  };
  const balls = cfg.juggle ? (cfg.torches ? [0, 1, 2].map(torch) : [M.clothRed, M.gold, M.clothBlue].map((m) => new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), m)))
    .map((b) => { b.castShadow = true; group.add(b); return b; }) : [];
  // the bard's flute, held across to the right of the mouth
  if (cfg.flute) { // a pipe from the lips down to the hands, a flared end
    P.body.add(Object.assign(new THREE.Mesh(cylGeo(0.017, 0.02, 0.52, 8).rotateX(2.14).translate(0, 0.84, 0.39), M.woodDark), { castShadow: true }));
    P.body.add(new THREE.Mesh(cylGeo(0.035, 0.022, 0.07, 8).rotateX(2.14).translate(0, 0.62, 0.6), M.woodDark));
  }
  // the engineer's plan: a parchment with blue lines, held open in both hands
  if (cfg.read) {
    const plan = new THREE.Group();
    plan.position.set(0, 0.78, 0.42);
    plan.rotation.x = -0.95;
    plan.add(new THREE.Mesh(boxGeo(0.56, 0.38, 0.008), M.clothIvory));
    for (const [w, h, x, y] of [[0.4, 0.012, 0, 0.1], [0.4, 0.012, 0, -0.1], [0.012, 0.2, -0.2, 0], [0.012, 0.2, 0.2, 0], [0.012, 0.2, 0, 0], [0.2, 0.012, -0.1, 0.02]]) plan.add(new THREE.Mesh(boxGeo(w, h, 0.004).translate(x, y, 0.006), M.clothBlue));
    for (const x of [-0.29, 0.29]) plan.add(new THREE.Mesh(cylGeo(0.022, 0.022, 0.4, 8).translate(x, 0, 0), M.clothIvory)); // the rolled ends
    P.body.add(plan);
  }
  // the carpenter's handcart of planks, pulled along by its shafts
  let cart = null;
  if (cfg.haul) {
    cart = new THREE.Group();
    group.add(cart);
    const part = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; cart.add(o); return o; };
    part(boxGeo(1.05, 0.08, 1.5).translate(0, 0.62, -1.95), M.woodDark);
    for (const s of [-1, 1]) part(boxGeo(0.05, 0.28, 1.5).translate(s * 0.5, 0.8, -1.95), M.woodDark);
    for (const s of [-1, 1]) part(cylGeo(0.03, 0.03, 1.15, 6).rotateX(Math.PI / 2 - 0.12).translate(s * 0.3, 0.71, -0.75), M.woodDark); // the shafts
    for (let i = 0; i < 6; i++) part(boxGeo(0.22, 0.05, 2.1).translate(-0.3 + (i % 3) * 0.3, 0.69 + Math.floor(i / 3) * 0.06, -2.0), M.wood); // planks
    for (let i = 0; i < 3; i++) part(cylGeo(0.09, 0.09, 1.6, 8).rotateX(Math.PI / 2).translate(-0.25 + i * 0.25, 0.86, -2.0), M.wood); // and logs
    cart.userData.wheels = [-1, 1].map((s) => {
      const wh = new THREE.Group();
      wh.position.set(s * 0.6, 0.42, -2.05);
      cart.add(wh);
      wh.add(Object.assign(new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 6, 18).rotateY(Math.PI / 2), M.woodDark), { castShadow: true }));
      for (let k = 0; k < 3; k++) wh.add(new THREE.Mesh(boxGeo(0.03, 0.78, 0.04).rotateX((k * Math.PI) / 3), M.woodDark));
      return wh;
    });
  }
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
  // a scene that happens once (the hunter's one shot) starts its cycle as the shot starts
  const offset = cfg.once ? cfg.period * 0.05 - t0 : rand01(seed, 'work', id) * cfg.period;
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
      // facing the work again (a visitor turns the worker round, visit.js)
      P.root.rotation.y = 0;
      P.r.g.position.x = 0.3;
      P.r.g.rotation.set(a, 0, 0);
      if (cfg.both) { P.l.g.rotation.x = a * 0.95; P.l.g.rotation.z = 0.28; P.r.g.rotation.z = -0.28; } // hands meet on the handle
      else if (cfg.left !== undefined) P.l.g.rotation.x = cfg.left + (cfg.look || cfg.still ? 0 : 0.05 * Math.sin(t * 3));
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
      if (cfg.carry) {
        // pick a log up from the pile on the left, turn and lay it on the cart in front
        const u = cycleU, turn = u < 0.4 ? 1 - ease(u / 0.4) : u < 0.6 ? 0 : ease((u - 0.6) / 0.4);
        P.root.rotation.y = 1.25 * turn;
        const low = Math.abs(Math.cos(Math.PI * u)); // bent down at the pile and at the cart
        P.body.rotation.x = cfg.bend * low;
        if (tool) tool.visible = u > 0.05 && u < 0.5;
      }
      if (cfg.lute) {
        // strumming hand on the strings, the other hand moving along the neck, head nodding to the tune
        P.r.g.rotation.set(-0.75 + 0.12 * Math.sin(t * 13), 0, -0.45 + 0.1 * Math.sin(t * 13));
        P.l.g.rotation.set(-1.35 + 0.08 * Math.sin(t * 2.1), 0, -0.25);
        P.body.rotation.set(-0.05, 0.12 * Math.sin(t * 1.3), 0.05 * Math.sin(t * 2.6));
      }
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
          b.position.set(side * (0.25 - 0.5 * q), 1.05 + 4 * q * (1 - q) * (cfg.torches ? 1.25 : 0.75), 0.45);
          if (cfg.torches) {
            b.rotation.set(0, 0, side * (0.4 + q * Math.PI * 2)); // a full turn in the air
            b.userData.flame.scale.set(1, 0.85 + 0.25 * Math.sin(t * 23 + i * 2), 1);
          }
        });
      }
      if (cfg.flute) {
        // both hands up at the flute, fingers busy, swaying to the tune
        P.r.g.rotation.set(-1.25, 0, -0.5 + 0.04 * Math.sin(t * 17));
        P.l.g.rotation.set(-1.45, 0, 0.5 + 0.04 * Math.sin(t * 13));
        P.body.rotation.set(-0.04 + 0.04 * Math.sin(t * 2.4), 0.12 * Math.sin(t * 1.2), 0.06 * Math.sin(t * 2.4));
      }
      if (cfg.read) {
        // reads the plan, then looks up at the building going up, then back down at the plan
        const up = ease(THREE.MathUtils.clamp(0.5 + 0.9 * Math.sin((t + offset) * 0.9), 0, 1));
        P.r.g.rotation.set(-1.05, 0, -0.32); P.l.g.rotation.set(-1.05, 0, 0.32);
        P.body.rotation.set(lerp(0.2, -0.08, up), lerp(0, 0.35, up) * Math.sin((t + offset) * 0.45), 0);
      }
      if (cart) {
        // walking along, the cart rolling behind; the camera waits halfway along the way
        const d = THREE.MathUtils.clamp(0.85 * (t - t0 - 1.6), -2.2, 2.2);
        P.root.position.z = d;
        cart.position.z = d;
        for (const wh of cart.userData.wheels) wh.rotation.x = d / 0.42;
        P.legs[0].rotation.x = 0.45 * Math.sin(d * 3.6); P.legs[1].rotation.x = -0.45 * Math.sin(d * 3.6);
        P.r.g.rotation.set(0.32, 0, -0.08); P.l.g.rotation.set(0.32, 0, 0.08); // arms back on the shafts
        P.body.rotation.set(cfg.bend, 0, 0);
        P.root.position.y = 0.04 * Math.abs(Math.cos(d * 3.6));
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
