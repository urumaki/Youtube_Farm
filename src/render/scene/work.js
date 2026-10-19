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

/** A person with arms on shoulder pivots so they can swing tools. Faces +z. */
function rig(M, color) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // bends at the hips
  body.position.y = 0.62;
  root.add(body);
  const tunic = M.people.clone();
  tunic.color.set(color);
  const add = (parent, geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  add(root, merged([cylGeo(0.075, 0.085, 0.6, 6).translate(-0.09, 0.3, 0), cylGeo(0.075, 0.085, 0.6, 6).translate(0.09, 0.3, 0),
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
  return { root, body, r: arm(1), l: arm(-1) };
}

function particles(count, color, size, additive) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const mat = new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: additive ? 1 : 0.85 });
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
  baker: { period: 1.6, hit: 0.55, raise: -1.15, down: -1.45, bend: 0.1, fx: 'embers', sound: 'none', tool: 'peel', props: 'oven', both: true, push: true },
  fisherman: { period: 2.6, hit: 0.5, raise: -2.2, down: -1.0, bend: 0.05, fx: 'splash', sound: 'none', tool: 'rod', props: 'pond', both: true },
  miller: { period: 1.5, hit: 0.6, raise: -1.6, down: -1.0, bend: 0.25, fx: 'dust', sound: 'none', tool: 'sack', props: 'sacks', both: true },
  guard: { period: 3.2, hit: 0.5, raise: -0.25, down: -0.25, bend: 0, fx: null, sound: 'none', tool: 'spear', props: 'post', left: -0.6, look: true },
  knight: { period: 3.2, hit: 0.5, raise: -0.25, down: -0.25, bend: 0, fx: null, sound: 'none', tool: 'sword', props: 'post', left: -0.6, look: true },
  // jobs asked for in the comments
  innkeeper: { period: 2.4, raise: -1.75, down: -0.45, bend: 0, sound: 'none', tool: 'tankard', props: 'tavern', smooth: true, left: -0.5 },
  beggar: { period: 3.4, raise: -1.5, down: -0.35, bend: 0.28, sound: 'none', tool: 'tankard', props: 'begging', smooth: true, left: -0.15, sway: true },
  weirdo: { period: 1.1, raise: -2.6, down: -0.4, bend: 0, sound: 'none', tool: null, props: 'none', dance: true },
  jester: { period: 0.9, raise: -1.2, down: -0.8, bend: 0, sound: 'none', tool: null, props: 'none', juggle: true },
  fletcher: { period: 0.6, raise: -1.35, down: -1.05, bend: 0.22, sound: 'none', tool: null, props: 'fletch', smooth: true, left: -1.15 },
};
JOB_SCENES.warrior = JOB_SCENES.knight;
JOB_SCENES.toolsmith = JOB_SCENES.blacksmith;
JOB_SCENES.brewer = JOB_SCENES.innkeeper;
const DEFAULT_SCENE = { period: 2.4, hit: 0.5, raise: -2.6, down: -0.2, bend: 0, fx: null, sound: 'none', tool: null, props: 'market', wave: true };

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

function toolGeo(kind, M) {
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
    add(cylGeo(0.02, 0.02, 1.6, 6).translate(0, -0.6, 0), wood);
    add(boxGeo(0.32, 0.02, 0.38).translate(0, -1.42, 0), M.wood);
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
  } else if (kind === 'sack') {
    add(new THREE.SphereGeometry(0.28, 10, 8).scale(1, 1.2, 0.8).translate(0, -0.1, 0.25), M.hay);
  }
  return g;
}

/** Props around the worker, in the worker's frame (worker at origin facing +z). Returns impact point. */
function buildProps(kind, M, add) {
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
    case 'oven': {
      add(new THREE.SphereGeometry(1.0, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.4, 2.2), M.stone);
      add(boxGeo(2.1, 0.4, 2.1).translate(0, 0.2, 2.2), M.stoneDark);
      add(boxGeo(0.55, 0.42, 0.1).translate(0, 0.62, 1.22), M.ember);
      add(boxGeo(1.2, 0.08, 0.6).translate(-1.6, 0.85, 0.6), M.wood);
      for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.13, 8, 6).scale(1.4, 0.7, 1).translate(-2.0 + i * 0.27, 0.93, 0.6), M.hay);
      return new THREE.Vector3(0, 0.7, 1.3);
    }
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
    case 'fletch': {
      add(boxGeo(1.4, 0.08, 0.6).translate(0, 0.8, 0.6), M.wood);
      for (const x of [-0.6, 0.6]) add(boxGeo(0.08, 0.8, 0.5).translate(x, 0.4, 0.6), M.woodDark);
      for (let i = 0; i < 7; i++) add(cylGeo(0.012, 0.012, 0.75, 5).rotateZ(Math.PI / 2).translate(0, 0.86, 0.45 + i * 0.04), M.wood);
      add(cylGeo(0.13, 0.11, 0.6, 10).translate(-0.9, 0.3, 0.2), M.gear); // quiver
      add(new THREE.TorusGeometry(0.6, 0.02, 5, 20, Math.PI * 0.9).rotateZ(-Math.PI * 0.45).translate(0.95, 0.9, 0.85), M.woodDark); // bow
      return new THREE.Vector3(0, 0.9, 0.5);
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
  splash: { n: 20, color: '#cfe6f2', size: 0.07, add: false, speed: [0.5, 1.4], up: [1.5, 2.6], life: 0.7 },
};

/**
 * Build the work scene for a villager.
 * @param anchor  world point (ground) where the worker stands
 * @param face    yaw the worker faces (radians, world)
 */
export function buildWorkScene({ job, anchor, face, M, seed, id }) {
  const cfg = JOB_SCENES[job] || DEFAULT_SCENE;
  const group = new THREE.Group();
  group.position.copy(anchor);
  group.rotation.y = face;
  const P = rig(M, JOBS[job]?.color || '#7a6a55');
  group.add(P.root);
  const propsG = new THREE.Group();
  group.add(propsG);
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; propsG.add(m); return m; };
  const impact = buildProps(cfg.props, M, add);
  const tool = cfg.tool ? toolGeo(cfg.tool, M) : null;
  if (tool) P.r.hand.add(tool);
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
  if (tipObj && !cfg.wave && !cfg.push && !cfg.look && !cfg.smooth) {
    for (let a = cfg.raise + 0.6; a < 0.6; a += 0.01) {
      const tp = tipAt(a);
      if (tp.z > 0.15 && tp.y <= impact.y) { down = a; break; }
    }
    const tp = tipAt(down);
    propsG.position.set(tp.x - impact.x, 0, tp.z - impact.z);
    impact.set(tp.x, impact.y, tp.z);
  }
  const balls = cfg.juggle ? [M.clothRed, M.gold, M.clothBlue].map((m) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), m); b.castShadow = true; group.add(b); return b; }) : [];
  let pts = null, fx = null;
  if (cfg.fx) { fx = FX[cfg.fx]; pts = particles(fx.n * 2, fx.color, fx.size, fx.add); group.add(pts); }
  const offset = rand01(seed, 'work', id) * cfg.period;
  const pose = (t) => {
    const c = (t + offset) / cfg.period, k = Math.floor(c), u = c - k;
    // wind up slowly, strike fast, recover
    let a;
    if (cfg.wave) a = cfg.raise + 0.35 * Math.sin(t * 7);
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
  const v = new THREE.Vector3();
  return {
    group,
    focus: anchor.clone().add(new THREE.Vector3(0, 1.1, 0)),
    labelPos: anchor.clone().add(new THREE.Vector3(0, 2.45, 0)),
    face,
    sound: cfg.sound,
    strikeTimes,
    update(t) {
      const { a } = pose(t);
      P.r.g.rotation.set(a, 0, 0);
      if (cfg.both) { P.l.g.rotation.x = a * 0.95; P.l.g.rotation.z = 0.28; P.r.g.rotation.z = -0.28; } // hands meet on the handle
      else if (cfg.left !== undefined) P.l.g.rotation.x = cfg.left + (cfg.look ? 0 : 0.05 * Math.sin(t * 3));
      if (cfg.wave) { P.r.g.rotation.z = 0.35; }
      const swing = (a - cfg.raise) / ((down - cfg.raise) || 1); // 0 raised .. 1 down
      P.body.rotation.x = cfg.bend * THREE.MathUtils.clamp(swing, 0, 1);
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
            v.set(Math.cos(ang) * sp, up, Math.sin(ang) * sp * 0.7 + 0.4);
            arr[j] = impact.x + v.x * age;
            arr[j + 1] = Math.max(0.03, impact.y + v.y * age - 4.9 * age * age);
            arr[j + 2] = impact.z + v.z * age;
          }
        }
        pts.geometry.attributes.position.needsUpdate = true;
        pts.material.opacity = (fx.add ? 1 : 0.85);
      }
    },
  };
}
