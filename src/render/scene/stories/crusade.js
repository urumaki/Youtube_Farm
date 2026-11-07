// The Crusade (owner 2026-11-07, src/sim/stories.js `crusade`), its second day: the whole video, one shot after another
// (timeline.js, CRUSADE_SHOTS), then the usual wide shot, goal and call to action. The guards who commented "!join" ride
// out as Crusaders in white and red over their plate (outfits.js paladinArmor), a named Knight at their head: dramatic
// shots from below the waist as they march in formation out of the gate and along the road; an abandoned mausoleum
// (cracked and mossy, a corner of its roof fallen in, a broken column, a dead tree, toppled gravestones, crows), the Knight
// pushes its door open; inside, four bandits guarding the relic, a fight, and the bandits sink to the floor, out cold;
// the Knight lifts the Golden Apple from the tomb, the Crusaders raise their swords; then the town cheers them home through
// the gate (as after the raid, raid.js returnShot). Every Crusader and the Knight wear their name tag. Comic, never cruel:
// the bandits are knocked down, nobody bleeds. The march, the mausoleum and its crypt are in a country of their own (see
// `country`); the return is at the Second Wall's gate (raid.js gateFrame).
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo, gableGeo, unfight } from '../kit.js';
import { BANDIT, paladinArmor } from '../outfits.js';
import { nod } from '../work.js';
import { person, stride, castTag, flameMaterial, flicker, ease, clamp01 } from './common.js';
import { heightAt } from '../../../sim/world.js';
import { gateFrame, put, doors, obstacles } from './raid.js';

export const CRUSADE_SHOTS = [['march', 0, 4.2], ['column', 4.2, 7.6], ['mausoleum', 7.6, 11.6], ['fight', 11.6, 16.2], ['relic', 16.2, 19.2], ['return', 19.2, 23.5]];
const FOOTER = 'Subscribe to join the kingdom';
const FOLK = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#7b6a43'];
const MZ = -40; // the mausoleum's middle along the road; its door faces the way the Crusaders come (+z) at MZ + 3
const CRYPT = -60; // the crypt under it (a set of its own, only seen in its shots)
const span = (u, a, b) => clamp01((u - a) / (b - a));
const lerp = THREE.MathUtils.lerp;
// the formation behind the Knight: two files, three deep (frame offsets, behind = toward the town, +z)
const RANKS = [[-0.95, 1.7], [0.95, 1.7], [-0.95, 3.2], [0.95, 3.2], [-0.95, 4.7], [0.95, 4.7]];

// The country the Crusaders ride through (owner 2026-11-07): a set of its own east of the map, where the land is flat and
// the town's ground ends far behind the fog, so nothing of the town gets in the way: grass on the land's own heights, a
// dirt road along -z, copses of trees either side, low hills far off. Frame: x across the road, z along it (the mausoleum
// at MZ, its door toward +z), y the world's height.
const X0 = 7000;
function country(w, M, seed) {
  const group = new THREE.Group();
  group.position.set(X0, 0, 0);
  group.updateMatrix();
  group.matrixAutoUpdate = false;
  group.updateMatrixWorld(true);
  group.visible = false;
  const ground = (x, z) => heightAt(w, X0 + x, z);
  const toWorld = (x, y, z) => new THREE.Vector3(X0 + x, y, z);
  const geo = new THREE.PlaneGeometry(260, 260, 65, 65).rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = [];
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, ground(x, z));
    c.set('#5d7a38').offsetHSL(0, 0, (rand01(seed, 'cgr', i) - 0.5) * 0.06);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  land.receiveShadow = true;
  group.add(land);
  // the road, a strip of dirt following the land
  const rp = [], ri = [];
  for (let k = 0, z = 40; z >= MZ + 4; z -= 2, k++) {
    for (const x of [-1.7, 1.7]) rp.push(x, ground(x, z) + 0.04, z);
    if (z > MZ + 5) ri.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
  }
  const road = new THREE.BufferGeometry();
  road.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  road.setIndex(ri);
  road.computeVertexNormals();
  const roadMesh = new THREE.Mesh(road, M.dirt);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);
  // copses either side of the road (never on it, never round the mausoleum), low hills far off
  const leaves = new THREE.MeshStandardMaterial({ color: '#33522a', roughness: 0.95 });
  const cone = new THREE.ConeGeometry(2.2, 7, 8).translate(0, 5.5, 0), trunk = cylGeo(0.25, 0.35, 2.2, 6).translate(0, 1.1, 0);
  for (let i = 0; i < 90; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (9 + rand01(seed, 'ctree', i) * 70), z = 40 - rand01(seed, 'ctree', i, 1) * 150;
    if (Math.hypot(x, z - MZ) < 16) continue;
    const s = 0.8 + rand01(seed, 'ctree', i, 2) * 0.7;
    for (const [g, m] of [[cone, leaves], [trunk, M.woodDark]]) {
      const o = new THREE.Mesh(g, m);
      o.position.set(x, ground(x, z) - 0.2, z);
      o.scale.setScalar(s);
      o.castShadow = true;
      group.add(o);
    }
  }
  const hill = new THREE.MeshLambertMaterial({ color: '#4f6b33' });
  for (const [x, z, r] of [[-90, -170, 60], [70, -190, 75], [150, -60, 55], [-160, -40, 60]]) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10).scale(1, 0.3, 1), hill);
    o.position.set(x, ground(x, z) - 4, z);
    group.add(o);
  }
  return { group, ground, toWorld };
}

let appleMat = null;
/** The Golden Apple: gold, a little glow, a stem and a leaf. */
function goldenApple(M) {
  appleMat ??= new THREE.MeshStandardMaterial({ color: '#ffcf40', metalness: 0.85, roughness: 0.25, emissive: '#8a5a00', emissiveIntensity: 0.7 });
  const g = new THREE.Group();
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); return m; };
  add(new THREE.SphereGeometry(0.12, 16, 12).scale(1, 0.92, 1), appleMat);
  add(cylGeo(0.012, 0.012, 0.07, 5).translate(0, 0.13, 0), M.woodDark);
  add(new THREE.SphereGeometry(0.04, 6, 4).scale(1.6, 0.3, 0.8).translate(0.05, 0.15, 0), M.greens);
  return g;
}

/** The cast: the Knight first, then the Crusaders (named), each a rig in plate with the white and red. */
function company(M, story, { banner = true } = {}) {
  const lead = story.knight || { name: null, job: 'knight' };
  const K = person(M, JOBS.knight?.color || JOBS.guard.color);
  const k = paladinArmor(K, M);
  K.c = lead; K.sub = 'Knight'; K.sword = k.sword;
  const crew = (story.crusaders || []).slice(0, 6);
  while (crew.length < 4) crew.push(null);
  const men = crew.map((c, i) => {
    const P = person(M, JOBS.guard.color);
    const a = paladinArmor(P, M, { shield: !(banner && i === 0) });
    P.c = c; P.sub = 'Crusader'; P.sword = a.sword; P.rank = RANKS[i];
    if (banner && i === 0) {
      // the standard: a white banner with the red cross on a pole, in place of the sword
      a.sword.visible = false;
      const pole = new THREE.Group();
      const white = new THREE.MeshStandardMaterial({ color: '#f1efe8', roughness: 0.8, side: THREE.DoubleSide });
      const red = new THREE.MeshStandardMaterial({ color: '#b3202a', roughness: 0.6, side: THREE.DoubleSide });
      const m = (geo, mat) => { const o = new THREE.Mesh(geo, mat); o.castShadow = true; pole.add(o); return o; };
      m(cylGeo(0.03, 0.03, 3.0, 6).translate(0, 1.0, 0), M.woodDark);
      m(new THREE.PlaneGeometry(0.75, 1.0).translate(0.4, 2.0, 0), white);
      m(new THREE.PlaneGeometry(0.14, 0.8).translate(0.4, 2.05, 0.005), red);
      m(new THREE.PlaneGeometry(0.6, 0.13).translate(0.4, 2.2, 0.005), red);
      pole.position.set(0, -0.62, 0.05);
      pole.rotation.x = Math.PI; // the hand's -y is down the arm: the pole stands up from the fist held forward
      P.r.hand.add(pole);
      P.standard = pole;
    }
    return P;
  });
  return { K, men, all: [K, ...men] };
}
const tagsOf = (all) => all.filter((P) => P.c?.name || P.sub === 'Knight').map((P) => ({ P, ...castTag(P.c, P.sub) }));
function placeTags(labels, group, tmp = new THREE.Vector3()) {
  for (const l of labels) l.pos.copy(tmp.copy(l.P.root.position).setY(l.P.root.position.y + 2.45)).applyMatrix4(group.matrix);
}
/** March: legs swinging, the sword at the shoulder (or the standard held up), the shield arm across. */
function marching(P, ph, amp = 0.5) {
  stride(P, ph, amp, { arms: false });
  P.r.g.rotation.set(P.standard ? -1.2 : -0.55, 0, -0.1);
  P.l.g.rotation.set(-0.5 + 0.15 * Math.sin(ph), 0, 0.15);
  nod(P, 0);
}

// --- outside the gate: the march, from below, and along the column ---
function marchShot(args, side) {
  const { story, w, M, seed } = args;
  const F = country(w, M, seed);
  const { group } = F;
  const cx = 0;
  const co = company(M, story);
  for (const P of co.all) group.add(P.root);
  const labels = tagsOf(co.all);
  const z0 = side ? 14 : 30, z1 = side ? 6 : 22;
  let T0 = 0, T1 = 1;
  const headAt = (t) => lerp(z0, z1, clamp01((t - T0) / (T1 - T0)));
  return {
    group, labels, banner: side ? null : 'The Crusaders ride out', footer: FOOTER, phase: side ? 0.22 : 0.15, low: true,
    focus: F.toWorld(cx, 1.6, (z0 + z1) / 2),
    setWindow(t0, t1) { T0 = t0; T1 = t1; },
    cam(u) {
      const h = lerp(z0, z1, u);
      // from below the waist: in front of the Knight looking up at the formation, or beside the column as it passes
      return side
        ? { pos: F.toWorld(cx + 4.6, F.ground(cx + 4.6, h + 1) + 0.65, h + 1.0 - 1.2 * u), look: F.toWorld(cx, F.ground(cx, h) + 2.0, h + 2.4), fov: 50 }
        : { pos: F.toWorld(cx + 1.2, F.ground(cx + 1.2, h - 4.6) + 0.6, h - 4.6), look: F.toWorld(cx - 0.1, F.ground(cx, h) + 2.2, h + 1.6), fov: 54 };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t < t1;
      if (!group.visible) return;
      const h = headAt(t);
      co.all.forEach((P, i) => {
        const [dx, dz] = P.rank || [0, 0];
        put(F, P, cx + dx, h + dz, 0, -1);
        marching(P, (h + dz) * 3.2 + (i % 2) * Math.PI, 0.5);
      });
      placeTags(labels, group);
    },
  };
}

// --- the abandoned mausoleum: they arrive, the Knight pushes the door open ---
function mausoleum(M, seed) {
  const g = new THREE.Group();
  const moss = new THREE.MeshStandardMaterial({ color: '#4d5e2e', roughness: 1 });
  const grime = new THREE.MeshStandardMaterial({ color: '#6c665c', roughness: 1 });
  let n = 0; // (no two faces in one plane: kit.js unfight)
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(unfight(geo, n++), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  // the steps and the platform, the walls with the doorway (1.8 wide, 2.8 tall) in the front (+z, at 3)
  add(boxGeo(9, 0.5, 8.5), grime, 0, 0.25, 0.4);
  add(boxGeo(7.4, 0.25, 1.0), grime, 0, 0.12, 5.1);
  add(boxGeo(6, 4.6, 0.5), M.stone, 0, 2.8, -2.75);
  for (const s of [-1, 1]) add(boxGeo(0.5, 4.6, 6), M.stone, s * 2.75, 2.8, 0);
  for (const s of [-1, 1]) add(boxGeo(2.1, 4.6, 0.5), M.stone, s * 1.95, 2.8, 2.75);
  add(boxGeo(1.8, 1.8, 0.5), M.stone, 0, 4.2, 2.75);
  add(boxGeo(1.8, 2.8, 0.1), new THREE.MeshBasicMaterial({ color: '#050505' }), 0, 1.9, 2.3); // the dark inside
  // the roof: a stone gable, one corner fallen in (a gap, the rubble below it)
  add(gableGeo(6.8, 4.4, 2.2), M.stoneDark, 0, 5.1, -0.6);
  add(gableGeo(6.8, 1.8, 0.9), M.stoneDark, 0, 5.1, 2.4);
  add(boxGeo(2.2, 0.3, 1.6), M.stoneDark, 2.0, 5.3, -0.9, 0.5, 0.2, 0.6); // a slab slid off the roof
  for (let i = 0; i < 9; i++) add(new THREE.DodecahedronGeometry(0.2 + rand01(seed, 'rub', i) * 0.25, 0), grime, 3.4 + rand01(seed, 'rub', i, 1) * 1.6, 0.6, -1.5 + rand01(seed, 'rub', i, 2) * 3);
  // the portico: four columns, one broken off, one lying in the grass
  add(cylGeo(0.28, 0.32, 4.6, 12), M.stone, -2.3, 2.8, 4.0);
  add(cylGeo(0.28, 0.32, 4.6, 12), M.stone, -0.9, 2.8, 4.3);
  add(cylGeo(0.28, 0.32, 2.0, 12), M.stone, 0.9, 1.5, 4.3);
  add(cylGeo(0.28, 0.32, 3.4, 12), M.stone, -3.4, 0.55, 6.6, 0, 0.4, Math.PI / 2);
  add(boxGeo(6.0, 0.5, 0.8), M.stoneDark, -0.6, 5.3, 4.2, 0, 0, 0.06);
  // cracks, moss and ivy
  for (const [x, y, z, h, a] of [[-1.6, 2.6, 3.01, 1.6, 0.3], [1.4, 3.6, 3.01, 1.2, -0.4], [2.2, 1.7, 3.01, 1.0, 0.6], [-3.01, 3, 1, 1.8, 0.2]]) add(boxGeo(0.05, h, 0.02), new THREE.MeshBasicMaterial({ color: '#2b2722' }), x, y, z, 0, x < -2.9 ? Math.PI / 2 : 0, a);
  for (let i = 0; i < 14; i++) add(boxGeo(0.5 + rand01(seed, 'moss', i) * 0.8, 0.35 + rand01(seed, 'moss', i, 1) * 0.6, 0.06), moss, -2.6 + rand01(seed, 'moss', i, 2) * 5.2, 0.8 + rand01(seed, 'moss', i, 3) * 3.6, 3.03);
  for (let i = 0; i < 6; i++) add(boxGeo(0.12, 1.4 + rand01(seed, 'ivy', i), 0.06), moss, -2.95 + i * 0.12, 3.2, 3.04, 0, 0, (rand01(seed, 'ivy', i, 1) - 0.5) * 0.4);
  // the doors: two old leaves, one hanging off a hinge
  const leaves = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.9, 0, 3.05);
    const leaf = new THREE.Mesh(boxGeo(0.88, 2.7, 0.1).translate(-s * 0.44, 1.35, 0), M.woodDark);
    leaf.castShadow = true;
    pivot.add(leaf);
    g.add(pivot);
    return { pivot, s };
  });
  leaves[1].pivot.children[0].rotation.z = 0.05;
  // a dead tree, toppled gravestones, a rusted fence, crows on the roof
  add(cylGeo(0.18, 0.3, 4.2, 7), M.woodDark, -5.2, 2.1, 3.6, 0, 0, 0.08);
  for (const [len, ry, rz, y] of [[1.8, 0.4, 0.9, 3.4], [1.5, 2.6, -0.8, 3.0], [1.2, 4.2, 1.1, 3.9], [1.0, 1.5, -1.0, 4.0]]) add(cylGeo(0.04, 0.09, len, 5).translate(0, len / 2, 0), M.woodDark, -5.2, y, 3.6, 0, ry, rz);
  for (let i = 0; i < 5; i++) add(boxGeo(0.6, 0.9, 0.15), grime, -4.6 - (i % 2) * 1.3, 0.35, 5.5 + i * 1.3, (rand01(seed, 'grave', i) - 0.5) * 0.7, 0, (rand01(seed, 'grave', i, 1) - 0.5) * 0.6);
  for (let i = 0; i < 7; i++) add(boxGeo(0.05, 1.1, 0.05), M.iron, -6.4 + i * 0.32, 0.7, 3.2, 0, 0, i === 3 ? 0.7 : (rand01(seed, 'fence', i) - 0.5) * 0.3);
  const crow = new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.6 });
  for (const [x, z] of [[-1.5, 2.2], [0.6, 3.4], [2.6, 1.6]]) { add(new THREE.SphereGeometry(0.14, 8, 6).scale(1, 0.8, 1.6), crow, x, 6.3, z); add(new THREE.ConeGeometry(0.05, 0.12, 5).rotateX(Math.PI / 2), crow, x, 6.35, z + 0.25); }
  return { g, leaves };
}
function mausoleumShot(args) {
  const { story, w, M, seed } = args;
  const F = country(w, M, seed);
  const { group } = F;
  const cx = 0;
  const ma = mausoleum(M, seed);
  ma.g.position.set(cx, F.ground(cx, MZ) + 0.05, MZ);
  group.add(ma.g);
  const co = company(M, story);
  for (const P of co.all) group.add(P.root);
  const labels = tagsOf(co.all);
  const STOP = MZ + 6.2;
  return {
    group, labels, banner: 'The forgotten mausoleum', footer: FOOTER, phase: 0.42, fog: 0.012, low: true,
    focus: F.toWorld(cx, 2.5, MZ + 3),
    cam(u) {
      // low and to the side of the column, the mausoleum looming over them, closing in as the door opens
      const k = ease(u);
      const x = cx + 7.5 - 1.5 * k, z = STOP + 10 - 3 * k;
      return { pos: F.toWorld(x, F.ground(x, z) + 0.75, z), look: F.toWorld(cx - 0.4, F.ground(cx, MZ) + 2.6, MZ + 2.5), fov: 58 };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t < t1;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0);
      const h = lerp(STOP + 6, STOP, ease(span(u, 0, 0.45)));
      const open = ease(span(u, 0.58, 0.9));
      for (const { pivot, s } of ma.leaves) pivot.rotation.y = -s * 1.5 * open;
      co.all.forEach((P, i) => {
        const [dx, dz] = P.rank || [0, 0];
        put(F, P, cx + dx, h + dz, 0, -1);
        if (u < 0.45) marching(P, (h + dz) * 3.2 + (i % 2) * Math.PI, 0.5);
        else {
          stride(P, 0, 0); P.r.g.rotation.set(P.standard ? -1.2 : -0.9, 0, -0.1); P.l.g.rotation.set(-0.9, 0, 0.2);
          nod(P, -0.2); // looking up at it
        }
      });
      // the Knight steps up and pushes the doors with both hands
      const K = co.K;
      if (u > 0.48) {
        put(F, K, cx, lerp(STOP, MZ + 3.6, ease(span(u, 0.48, 0.62))), 0, -1);
        K.r.g.rotation.set(-1.5, 0, -0.1); K.l.g.rotation.set(-1.5, 0, 0.1);
        K.body.rotation.x = 0.2 * span(u, 0.55, 0.7);
      }
      placeTags(labels, group);
    },
  };
}

// --- the crypt: four bandits round the relic; the fight; the Golden Apple ---
function crypt(F, M, cx, seed) {
  const g = new THREE.Group();
  g.position.set(cx, CRYPT, MZ);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(boxGeo(10, 0.3, 12), M.stoneDark, 0, -0.15, 0);
  add(boxGeo(10, 0.4, 12), M.stoneDark, 0, 4.4, 0);
  for (const s of [-1, 1]) add(boxGeo(0.4, 4.6, 12), M.stone, s * 5, 2.2, 0);
  add(boxGeo(10, 4.6, 0.4), M.stone, 0, 2.2, -6);
  add(boxGeo(10, 4.6, 0.4), M.stone, 0, 2.2, 6.2);
  for (const s of [-1, 1]) for (const z of [-3, 1]) add(cylGeo(0.3, 0.36, 4.3, 12), M.stone, s * 3, 2.15, z);
  // the tomb at the back with the relic on its lid, on a red cushion
  add(boxGeo(2.4, 1.0, 1.2), M.stone, 0, 0.5, -4.4);
  add(boxGeo(2.6, 0.18, 1.4), M.stoneDark, 0, 1.09, -4.4);
  add(boxGeo(0.5, 0.12, 0.5), M.clothRed, 0, 1.24, -4.2);
  // the bandits' camp: crates, a sack, a dead fire
  for (const [x, z] of [[-2.2, -2], [2.4, -1.6], [-1.6, 0.6]]) add(boxGeo(0.7, 0.6, 0.7), M.wood, x, 0.3, z);
  // torches on the walls
  const flames = [], lights = [];
  for (const [x, z] of [[-4.75, -3.5], [4.75, -3.5], [-4.75, 2.5], [4.75, 2.5]]) {
    add(cylGeo(0.04, 0.05, 0.5, 6), M.woodDark, x, 2.3, z);
    const f = add(new THREE.ConeGeometry(0.11, 0.32, 8).translate(0, 0.16, 0), flameMaterial('#ffb347'), x, 2.55, z);
    f.castShadow = false;
    flames.push(f);
    const l = new THREE.PointLight('#ffa552', 9, 12, 1.5);
    l.position.set(x * 0.85, 2.8, z);
    g.add(l);
    lights.push(l);
  }
  const glow = new THREE.PointLight('#ffd060', 0, 6, 1.4);
  glow.position.set(0, 1.9, -4.0);
  g.add(glow);
  F.group.add(g);
  return { g, flames, lights, glow, at: (x, y, z) => F.toWorld(cx + x, CRYPT + y, MZ + z) };
}
// where each bandit stands by the relic, and who fights whom
const BANDITS = [[-1.9, -2.7], [-2.1, -1.1], [-1.7, 0.5], [-2.3, 2.0]];
const FALL = [0.42, 0.52, 0.62, 0.72]; // the share of the fight shot at which each goes down
function bandits(M) {
  return BANDITS.map(([x, z], i) => {
    const P = person(M, BANDIT);
    const club = new THREE.Mesh(cylGeo(0.04, 0.075, 0.8, 6).translate(0, -0.25, 0.08), M.woodDark);
    club.castShadow = true;
    P.r.hand.add(club);
    P.x = x; P.z = z;
    return P;
  });
}
/** A bandit knocked down (k 0..1): toppling back (away from the Crusaders, -x) onto the floor, arms out, out cold. */
function down(P, k, x, z, side) {
  P.root.position.set(x - 0.6 * k, 0.05 + 0.12 * k, z);
  P.root.rotation.set(-1.45 * ease(k), Math.PI / 2 + side * 0.3, 0, 'YXZ');
  P.legs[0].rotation.x = P.legs[1].rotation.x = -0.2 * k;
  P.r.g.rotation.set(-1.6 * k, 0, -1.2 * k); P.l.g.rotation.set(-1.6 * k, 0, 1.2 * k);
}
function cryptShot(args, relic) {
  const { story, w, M, seed } = args;
  const F = country(w, M, seed);
  const { group } = F;
  const cx = 0;
  const cr = crypt(F, M, cx, seed);
  const co = company(M, story, { banner: false });
  for (const P of co.all) cr.g.add(P.root);
  const bs = bandits(M);
  for (const P of bs) cr.g.add(P.root);
  const apple = goldenApple(M);
  apple.position.set(0, 1.42, -4.2);
  cr.g.add(apple);
  const labels = tagsOf(co.all);
  const tmp = new THREE.Vector3();
  // the Crusaders' places in the fight: one before each bandit, the others behind
  const spots = [[1.6, -3.4], ...BANDITS.map(([x, z]) => [x + 1.4, z]), [1.9, 3.2], [0.8, 3.6]];
  return {
    group, labels, interior: true, phase: 0.6, footer: FOOTER, low: true,
    banner: relic ? 'The Golden Apple!' : 'Bandits!',
    focus: cr.at(0, 1.4, -2),
    cam(u) {
      if (relic) {
        // from behind the tomb, the Knight facing the camera as he lifts the apple
        return { pos: cr.at(2.6 - 0.4 * u, 1.55, -5.5), look: cr.at(-0.2, 2.0, -2.6), fov: 60 };
      }
      // low from the side, the Crusaders on the right and the bandits on the left of the frame, drifting along
      const k = ease(u);
      // (over the shoulders, down the gap between the two lines, so neither hides the other)
      return { pos: cr.at(-1.2 + 0.3 * k, 2.0, 5.6 - 1.0 * k), look: cr.at(-1.3, 1.0, -0.6), fov: 62 };
    },
    update(t, t0, t1) {
      const on = t >= t0 && t < t1;
      group.visible = on;
      for (const l of cr.lights) l.visible = on;
      if (!on) return;
      const u = (t - t0) / (t1 - t0);
      cr.flames.forEach((f, k) => flicker(f, t, k));
      co.all.forEach((P, i) => {
        const [sx, sz] = spots[i] || [0, 2.4];
        P.root.rotation.set(0, relic ? Math.PI : -Math.PI / 2, 0); // facing the tomb (-z), or the bandits (-x)
        P.body.rotation.set(0, 0, 0);
        nod(P, 0);
        if (relic) {
          // the fight over: the Knight at the tomb, the apple raised; the Crusaders round him, swords up
          if (i === 0) {
            const walk = ease(span(u, 0, 0.3)), lift = ease(span(u, 0.35, 0.6));
            P.root.position.set(0, 0, lerp(-1.6, -3.4, walk));
            stride(P, u * 30, walk < 1 ? 0.45 : 0);
            // the sword put away, the apple lifted in the right hand (the shield stays on the left arm, clear of his face)
            P.sword.visible = lift <= 0;
            P.r.g.rotation.set(-1.0 - 1.9 * lift, 0, -0.15);
            P.l.g.rotation.set(-0.3, 0, 0.1);
          } else {
            P.root.position.set(1.0 + (i % 2) * 1.2, 0, -1.6 + i * 0.7);
            stride(P, 0, 0);
            const cheer = span(u, 0.6, 0.7);
            P.r.g.rotation.set(-0.8 - 2.0 * cheer + 0.15 * cheer * Math.sin(t * 8 + i), 0, -0.2);
            P.l.g.rotation.set(-0.7, 0, 0.2);
          }
        } else {
          // in through the door, then each squares up to a bandit and swings
          const inn = ease(span(u, 0, 0.22));
          P.root.position.set(lerp(0.8 + (i % 2) * 0.8, sx, inn), 0, lerp(5.2 + i * 0.4, sz, inn));
          if (inn < 1) P.root.rotation.y = Math.PI; // coming in from the door
          stride(P, u * 34 + i, inn < 1 ? 0.55 : 0.12, { arms: false });
          const fighting = inn >= 1 && i > 0 && i <= 4 && u < FALL[i - 1] + 0.02;
          const swing = fighting ? Math.sin(t * 9 + i * 1.3) : 0;
          P.r.g.rotation.set(fighting ? -2.0 + 1.1 * swing : -0.9, 0, -0.2 - 0.3 * swing);
          P.l.g.rotation.set(-1.2, 0, 0.35);
          P.body.rotation.x = fighting ? 0.1 * swing : 0;
        }
      });
      // the apple: on the tomb, then in the Knight's raised hand, glowing
      if (relic) {
        const lift = span(u, 0.35, 0.6);
        if (lift > 0) { co.K.r.hand.updateWorldMatrix(true, false); co.K.r.hand.getWorldPosition(tmp); cr.g.worldToLocal(tmp); apple.position.copy(tmp).add(new THREE.Vector3(0, lift > 0.95 ? 0.15 : 0.05, 0)); }
        cr.glow.intensity = 3 + 20 * ease(span(u, 0.45, 0.7)) * (1 + 0.1 * Math.sin(t * 6));
        cr.glow.position.copy(apple.position).add(new THREE.Vector3(0, 0.4, 0.4));
      } else cr.glow.intensity = 3;
      apple.rotation.y = t * 1.2;
      // the bandits: up from their crates, clubs swinging, then down one by one, out cold
      bs.forEach((P, i) => {
        const k = relic ? 1 : ease(span(u, FALL[i], FALL[i] + 0.08));
        if (k > 0) { down(P, k, P.x, P.z, i % 2 ? 1 : -1); return; }
        P.root.position.set(P.x, 0, P.z);
        P.root.rotation.set(0, Math.PI / 2, 0); // facing the Crusaders (+x)
        const sw = Math.sin(t * 8 + i * 2);
        stride(P, t * 6 + i, u > 0.2 ? 0.25 : 0, { arms: false });
        P.r.g.rotation.set(u > 0.18 ? -2.2 + 1.0 * sw : -0.5, 0, 0.2);
        P.l.g.rotation.set(-0.6, 0, 0.3);
      });
      for (const l of labels) l.pos.copy(cr.g.localToWorld(tmp.copy(l.P.root.position).setY(2.45)));
    },
  };
}

// --- home through the gate, the town cheering (as after the raid) ---
function returnShot(args) {
  const { story, w, M, seed, yFn } = args;
  const F = gateFrame(w, story, yFn);
  const { group } = F;
  const gate = doors(M);
  gate.set(1, 0, 0);
  group.add(gate.group);
  const co = company(M, story);
  for (const P of co.all) group.add(P.root);
  const apple = goldenApple(M);
  apple.position.set(0, -0.78, 0.05);
  co.K.l.hand.add(apple);
  const crowd = Array.from({ length: Math.max(12, (story.crowd || []).length + 4) }, (_, i) => {
    const c = story.crowd?.[i] || null;
    const P = person(M, c ? JOBS[c.job]?.color || FOLK[i % 6] : FOLK[i % 6]);
    P.c = c;
    const side = i % 2 ? 1 : -1;
    P.x = side * (4.6 + (Math.floor(i / 2) % 2) * 0.9);
    P.z = 7 + Math.floor(i / 2) * 1.6;
    put(F, P, P.x, P.z, -side, 0);
    P.ph = rand01(seed, 'crusadeclap', i) * 6;
    group.add(P.root);
    return P;
  });
  const labels = [...tagsOf(co.all), ...crowd.filter((P) => P.c).map((P) => ({ P, ...castTag(P.c) }))];
  // (owner 2026-11-07: a tree filled the frame) the first camera place from which the line to the gate is clear
  const obs = obstacles(F, args.state, args.nature, 30, -5).filter(([, oz]) => oz > 7);
  const blocked = ([x, z]) => obs.some(([ox, oz, r]) => {
    const t = Math.max(0, Math.min(1, ((ox - x) * -x + (oz - z) * (6 - z)) / (x * x + (6 - z) ** 2)));
    return Math.hypot(ox - (x - x * t), oz - (z + (6 - z) * t)) < r + 0.8;
  });
  const eye = [[1.2, 27], [1.2, 21], [-3, 24], [4, 24], [1.2, 17], [-5, 19], [5, 19], [1.2, 14]].find((p) => !blocked(p)) || [1.2, 15];
  return {
    group, labels, banner: 'Welcome home, Crusaders!', footer: FOOTER, phase: 0.3,
    focus: F.toWorld(0, 1.6, 6),
    cam(u) { return { pos: F.toWorld(eye[0] - 0.6 * u, 2.9, eye[1] - 2 * u), look: F.toWorld(0, 1.6, 6) }; },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0);
      const head = -10 + 22 * ease(Math.min(1, u / 0.85));
      co.all.forEach((P, i) => {
        const [dx, dz] = P.rank || [0, 0];
        put(F, P, dx, head - dz, 0, 1);
        marching(P, (head - dz) * 3 + i, u < 0.85 ? 0.55 : 0);
      });
      co.K.l.g.rotation.set(-2.9 + 0.1 * Math.sin(t * 5), 0, 0.15); // the apple held high
      crowd.forEach((P) => {
        const c = Math.sin(t * 11 + P.ph);
        P.r.g.rotation.set(-1.3, 0, -0.35 - 0.25 * c);
        P.l.g.rotation.set(-1.3, 0, 0.35 + 0.25 * c);
        if (Math.sin(t * 1.7 + P.ph) > 0.8) P.r.g.rotation.set(-2.9, 0, 0);
      });
      placeTags(labels, group);
    },
  };
}

const SHOTS = {
  march: (a) => marchShot(a, false), column: (a) => marchShot(a, true), mausoleum: mausoleumShot,
  fight: (a) => cryptShot(a, false), relic: (a) => cryptShot(a, true), return: returnShot,
};

/** The scene of one shot of the Crusade's second day (args.story.shot). */
export function buildCrusade(args) {
  const f = SHOTS[args.story.shot];
  return f && args.story.gate ? f(args) : null;
}
