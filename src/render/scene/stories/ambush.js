// The ambush in the forest (owner 2026-11-13, src/sim/stories.js `ambush`): two days that take the whole video, one shot after
// another (timeline.js, AMBUSH_SHOTS). Day 1 ('ambush'): the kingdom's cart on a path through a deep forest, two named merchants
// on the box, two named guards in front and four behind; the forest goes quiet, bandits leap out of the bushes, the guards
// draw their swords and stand round the cart, the merchants whip the horses and the cart breaks through and races off for
// help, toward the camera; the six guards fight on against the bandits pouring out of the trees, and the day ends there:
// "To be continued...". Day 2 ('rescue'): the guards still standing, worn out, a few bandits out cold round them; more
// bandits come out of the trees and close in, a ring round the guards back to back; a horn, and the cavalry of the town
// (named Cavaliers and Knights first) gallops down the path with the cart behind; the bandits drop their clubs and run into
// the woods; the guards cheer. Then the usual wide shot, goal and call to action. Bandits have no names (outfits.js BANDIT).
// Nobody gets hurt: swords meet clubs, bandits are knocked down out cold or run.
// The forest is a set of its own east of the map (as the Crusade's country): x across the path, z along it (the cart drives
// toward +z), y the world's height. The fight is in a clearing on the path at z = ZF.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { heightAt } from '../../../sim/world.js';
import { boxGeo, cylGeo } from '../kit.js';
import { BANDIT } from '../outfits.js';
import { rig, toolGeo, nod } from '../work.js';
import { person, stride, castTag, ease, clamp01 } from './common.js';
import { horse } from './royal.js';
import { mount, gallop } from './joust.js';

export const AMBUSH_SHOTS = {
  ambush: [['road', 0, 4.5], ['escort', 4.5, 8.5], ['trap', 8.5, 12.5], ['defend', 12.5, 17], ['flee', 17, 21.5], ['clash', 21.5, 30]],
  rescue: [['weary', 0, 4.5], ['ring', 4.5, 9], ['closing', 9, 13.5], ['cavalry', 13.5, 18], ['rout', 18, 21], ['saved', 21, 23.5]],
};
const X0 = 7000; // the set's place in the world (far east of the map, flat land)
const ZF = -21; // the clearing where the cart is stopped and they fight (both days)
const CLEAR = 12; // its radius
const GUARD = JOBS.guard.color, MERCHANT = JOBS.merchant?.color || '#8a5a2b';
const COATS = ['#6b4226', '#2a2522', '#9a9590', '#a0582c', '#4a3020', '#c9c2b5'];
const lerp = THREE.MathUtils.lerp;
const span = (u, a, b) => clamp01((u - a) / (b - a));
/** The path's middle at z (a gentle bend), and its slope. */
const pathX = (z) => 2.6 * Math.sin(z / 28);
const slope = (z) => (2.6 / 28) * Math.cos(z / 28);
const CX = pathX(ZF); // the clearing's middle across
// the bandits' hiding bushes on both sides at the far edge of the clearing (absolute [across the path, z])
const HIDE = [[-3.8, -12], [4.2, -11.5], [-4.4, -9.5], [4.6, -9], [-3.6, -7.5], [-4.8, -5.5]];

// --- the forest, built once and shared by all the shots (each shot's group takes it while on screen) ---
let FOREST = null;
function forest(w, M, seed) {
  if (FOREST && FOREST.M === M && FOREST.seed === seed) return FOREST;
  const g = new THREE.Group();
  const ground = (x, z) => heightAt(w, X0 + x, z);
  // the floor: dark moss and leaf litter, lighter grass in the clearing
  const geo = new THREE.PlaneGeometry(320, 320, 80, 80).rotateX(-Math.PI / 2);
  const p = geo.attributes.position, col = [], c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, ground(x, z));
    const open = clamp01(1 - (Math.hypot(x - CX, z - ZF) - CLEAR + 4) / 6);
    c.set(rand01(seed, 'afl', i) < 0.35 ? '#4b3f28' : '#34502a').lerp(new THREE.Color('#5f8038'), open).offsetHSL(0, 0, (rand01(seed, 'afl', i, 1) - 0.5) * 0.06);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  land.receiveShadow = true;
  g.add(land);
  // the path: a strip of dirt along the bend
  const rp = [], ri = [];
  for (let k = 0, z = -150; z <= 150; z += 2, k++) {
    const a = Math.atan(slope(z));
    for (const s of [-1.7, 1.7]) { const x = pathX(z) + s * Math.cos(a); rp.push(x, ground(x, z) + 0.04, z - s * Math.sin(a)); }
    if (z < 150) ri.push(k * 2, k * 2 + 2, k * 2 + 1, k * 2 + 1, k * 2 + 2, k * 2 + 3);
  }
  const road = new THREE.BufferGeometry();
  road.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  road.setIndex(ri);
  road.computeVertexNormals();
  const roadMesh = new THREE.Mesh(road, M.dirt);
  roadMesh.receiveShadow = true;
  g.add(roadMesh);
  // the trees: tall firs and broad oaks, thick near the path, never on it nor in the clearing
  const spots = [];
  for (let i = 0; spots.length < 900 && i < 4000; i++) {
    const z = -150 + rand01(seed, 'atree', i) * 300, side = rand01(seed, 'atree', i, 1) < 0.5 ? -1 : 1;
    const off = 3.4 + Math.pow(rand01(seed, 'atree', i, 2), 1.7) * 75;
    const x = pathX(z) + side * off;
    if (Math.hypot(x - CX, z - ZF) < CLEAR + 1.5) continue;
    if (side > 0 && off < 6 && z > -62 && z < 22) continue; // (the cameras stand there)
    spots.push({ x, z, s: 0.75 + rand01(seed, 'atree', i, 3) * 0.6, fir: rand01(seed, 'atree', i, 4) < 0.55, r: rand01(seed, 'atree', i, 5) * 6 });
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const inst = (geo2, mat, list, place) => {
    const mesh = new THREE.InstancedMesh(geo2, mat, list.length);
    list.forEach((t, i) => { place(t); mesh.setMatrixAt(i, m4.compose(v, q, sc)); });
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
  };
  const firs = spots.filter((t) => t.fir), oaks = spots.filter((t) => !t.fir);
  const bark = M.woodDark, needles = new THREE.MeshStandardMaterial({ color: '#24402a', roughness: 0.95 }), leaves = new THREE.MeshStandardMaterial({ color: '#3d5e2a', roughness: 0.95 });
  const at = (t, y = 0) => { v.set(t.x, ground(t.x, t.z) - 0.2 + y, t.z); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.r); sc.setScalar(t.s); };
  inst(cylGeo(0.22, 0.38, 4, 6).translate(0, 2, 0), bark, firs, (t) => at(t));
  inst(new THREE.ConeGeometry(2.6, 5.5, 8).translate(0, 5.2, 0), needles, firs, (t) => at(t));
  inst(new THREE.ConeGeometry(2.0, 4.2, 8).translate(0, 8.2, 0), needles, firs, (t) => at(t));
  inst(new THREE.ConeGeometry(1.3, 3.0, 8).translate(0, 10.6, 0), needles, firs, (t) => at(t));
  inst(cylGeo(0.3, 0.5, 5, 7).translate(0, 2.5, 0), bark, oaks, (t) => at(t));
  inst(new THREE.IcosahedronGeometry(3.2, 1).scale(1, 0.8, 1).translate(0, 6.6, 0), leaves, oaks, (t) => at(t));
  inst(new THREE.IcosahedronGeometry(2.2, 1).translate(1.6, 5.6, 0.8), leaves, oaks, (t) => at(t));
  // bushes along the path and round the clearing (where the bandits hide), ferns and rocks
  const bushes = [];
  for (let i = 0; bushes.length < 420 && i < 3000; i++) {
    const z = -150 + rand01(seed, 'abush', i) * 300, side = rand01(seed, 'abush', i, 1) < 0.5 ? -1 : 1;
    const x = pathX(z) + side * (2.6 + Math.pow(rand01(seed, 'abush', i, 2), 2) * 30);
    const d = Math.hypot(x - CX, z - ZF);
    if (d < CLEAR - 1.5) continue;
    if (side > 0 && x - pathX(z) < 4.8 && z > -62 && z < 22) continue;
    bushes.push({ x, z, s: 0.6 + rand01(seed, 'abush', i, 3) * 0.8, r: rand01(seed, 'abush', i, 4) * 6 });
  }
  // the bandits' hiding bushes on both sides just before the clearing
  for (const [dx, dz] of HIDE) bushes.push({ x: pathX(dz) + dx, z: dz, s: 1.35, r: dz });
  inst(new THREE.IcosahedronGeometry(0.9, 1).scale(1.3, 0.75, 1.1).translate(0, 0.45, 0), new THREE.MeshStandardMaterial({ color: '#3a5a26', roughness: 1 }), bushes, (t) => at(t, 0.2));
  const rocks = Array.from({ length: 60 }, (_, i) => {
    const z = -100 + rand01(seed, 'arock', i) * 200, side = i % 2 ? 1 : -1;
    return { x: pathX(z) + side * (3 + rand01(seed, 'arock', i, 1) * 20), z, s: 0.4 + rand01(seed, 'arock', i, 2) * 0.8, r: i };
  }).filter((t) => Math.hypot(t.x - CX, t.z - ZF) > CLEAR - 2);
  inst(new THREE.DodecahedronGeometry(0.6, 0), M.stone, rocks, (t) => at(t, 0.1));
  // a fallen trunk at the clearing's edge
  const log = new THREE.Mesh(cylGeo(0.35, 0.4, 7, 9).rotateZ(Math.PI / 2), bark);
  log.position.set(CX - CLEAR + 1, ground(CX - CLEAR + 1, ZF + 5) + 0.3, ZF + 5);
  log.rotation.y = 0.5;
  log.castShadow = true;
  g.add(log);
  FOREST = { M, seed, g, ground };
  return FOREST;
}

/** A shot's frame: a group at the set's place that takes the forest while the shot is on screen. */
function frame(args) {
  const { w, M, seed } = args;
  const fo = forest(w, M, seed);
  const group = new THREE.Group();
  group.position.set(X0, 0, 0);
  group.visible = false;
  // (y above the ground there: the land is about 2.7 m up)
  const W = (x, y, z) => new THREE.Vector3(X0 + x, fo.ground(x, z) + y, z);
  const show = (on) => {
    group.visible = on;
    if (on && fo.g.parent !== group) group.add(fo.g);
  };
  return { group, ground: fo.ground, W, show };
}

/** Someone on the path at z, `dx` across it, facing along it (+z, or back toward -z), or facing a point. */
function onPath(F, P, dx, z, back = false) {
  const x = pathX(z) + dx;
  P.root.position.set(x, F.ground(x, z), z);
  P.root.rotation.set(0, Math.atan(slope(z)) + (back ? Math.PI : 0), 0);
}
function at(F, P, x, z, lookX, lookZ) {
  P.root.position.set(x, F.ground(x, z), z);
  P.root.rotation.set(0, Math.atan2(lookX - x, lookZ - z), 0);
}

// --- the people ---
let shieldMat = null;
/** A guard of the kingdom: the guard's outfit, a sword and a kite shield in the kingdom's blue. */
function guard(M, c) {
  const P = person(M, c ? JOBS[c.job]?.color || GUARD : GUARD);
  P.c = c;
  P.r.hand.add(toolGeo('sword', M));
  shieldMat ??= new THREE.MeshStandardMaterial({ color: '#2a4a8a', roughness: 0.6 });
  const sh = new THREE.Mesh(boxGeo(0.07, 0.62, 0.46).translate(-0.06, -0.42, 0.12), shieldMat);
  sh.castShadow = true;
  P.l.g.add(sh);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6).translate(-0.1, -0.42, 0.12), M.gold);
  P.l.g.add(boss);
  return P;
}
/** A bandit: black clothes, bandanas, a club. */
function bandit(M) {
  const P = person(M, BANDIT);
  const club = new THREE.Mesh(cylGeo(0.04, 0.08, 0.8, 6).translate(0, -0.25, 0.08), M.woodDark);
  club.castShadow = true;
  P.r.hand.add(club);
  P.club = club;
  return P;
}
/** Fighting stance: `k` 0..1 how hard; `ph` the swing. The sword (or club) arm swings, the shield arm forward. */
function fight(P, t, i, k = 1, shield = true) {
  const s = Math.sin(t * 8.5 + i * 1.9);
  P.r.g.rotation.set(lerp(-0.4, -2.1 + 1.2 * s, k), 0, -0.2 - 0.25 * s * k);
  P.l.g.rotation.set(shield ? lerp(-0.2, -1.1, k) : -0.6 * k, 0, 0.3);
  P.body.rotation.set(0.12 * k * s, 0, 0);
}
/** Knocked down, out cold (k 0..1): toppled back, arms out. */
function down(P, k) {
  P.body.rotation.set(0, 0, 0);
  P.root.rotation.order = 'YXZ';
  P.root.rotation.x = -1.45 * ease(k);
  P.root.position.y += 0.12 * k;
  if (P.legs) P.legs[0].rotation.x = P.legs[1].rotation.x = -0.2 * k;
  P.r.g.rotation.set(-1.6 * k, 0, -1.2 * k); P.l.g.rotation.set(-1.6 * k, 0, 1.2 * k);
}
/** Tired out: sword low, chest heaving, now and then hands on the knees. */
function weary(P, t, i) {
  const b = Math.sin(t * 5 + i);
  P.body.rotation.set(0.18 + 0.05 * b + (i % 3 === 1 ? 0.35 : 0), 0, 0);
  P.r.g.rotation.set(i % 3 === 1 ? -0.5 : -0.2 + 0.04 * b, 0, -0.15);
  P.l.g.rotation.set(i % 3 === 1 ? -0.5 : -0.3, 0, 0.2);
  nod(P, 0.15 + 0.05 * b);
}

/** The kingdom's cart: a covered wagon in blue and gold, the banner at the back, two merchants on the box, two horses. */
function cart(M, story) {
  const g = new THREE.Group();
  const add = (geo, mat, parent = g) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const blue = new THREE.MeshStandardMaterial({ color: '#23408a', roughness: 0.6 });
  add(boxGeo(1.7, 0.5, 3.4).translate(0, 1.05, 0), blue);
  add(boxGeo(1.78, 0.07, 3.48).translate(0, 1.32, 0), M.gold);
  add(boxGeo(1.8, 0.1, 3.6).translate(0, 0.8, 0), M.woodDark);
  const cover = new THREE.CylinderGeometry(0.95, 0.95, 2.6, 18, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
  const canvas = M.clothIvory.clone();
  add(cover.translate(0, 1.32, -0.35), canvas);
  for (const z of [-1.6, -0.35, 0.9]) add(new THREE.TorusGeometry(0.97, 0.04, 6, 16, Math.PI).translate(0, 1.32, z), M.woodDark);
  add(new THREE.TorusGeometry(0.96, 0.06, 6, 16, Math.PI).translate(0, 1.32, -0.35), M.gold); // the gold band
  // chests at the back, and the banner of the kingdom on a pole
  add(boxGeo(0.6, 0.4, 0.4).translate(-0.4, 1.5, -1.55), M.woodDark);
  add(boxGeo(0.6, 0.4, 0.4).translate(0.35, 1.5, -1.45), M.woodDark);
  add(cylGeo(0.03, 0.03, 2.6, 6).translate(0.75, 2.4, -1.65), M.woodDark);
  const flag = add(new THREE.PlaneGeometry(0.8, 0.55).translate(0.4, 0, 0), M.clothBlue);
  flag.position.set(0.75, 3.4, -1.65);
  add(new THREE.PlaneGeometry(0.8, 0.12).translate(0.4, 0, 0.003), M.gold, flag);
  // the box at the front and the two merchants on it
  add(boxGeo(1.6, 0.4, 0.5).translate(0, 1.5, 1.45), M.woodDark);
  const men = (story.merchants || [null, null]).slice(0, 2).map((c, i) => {
    const P = rig(M, c ? JOBS[c.job]?.color || MERCHANT : MERCHANT, { seated: true });
    P.root.position.set(i ? 0.36 : -0.36, 1.7 - 0.47, 1.4);
    P.c = c || { job: 'merchant' };
    g.add(P.root);
    return P;
  });
  // the whip in the right hand of the merchant on the right
  const whip = new THREE.Group();
  add(cylGeo(0.012, 0.02, 1.0, 5).translate(0, -0.5, 0), M.woodDark, whip);
  whip.position.set(0, 0, 0.05);
  men[1].r.hand.add(whip);
  // the wheels turn with the distance; the shafts and the two horses
  const wheels = [];
  for (const [x, z] of [[-0.95, -1.1], [0.95, -1.1], [-0.95, 1.15], [0.95, 1.15]]) {
    const wg = new THREE.Group();
    wg.position.set(x, 0.62, z);
    add(new THREE.TorusGeometry(0.58, 0.05, 6, 18).rotateY(Math.PI / 2), M.woodDark, wg);
    add(cylGeo(0.12, 0.12, 0.2, 8).rotateZ(Math.PI / 2), M.iron, wg);
    for (let s = 0; s < 4; s++) add(boxGeo(0.05, 1.1, 0.05).rotateX((s * Math.PI) / 4), M.wood, wg);
    g.add(wg);
    wheels.push(wg);
  }
  for (const s of [-1, 1]) add(boxGeo(0.07, 0.07, 2.2).translate(s * 0.5, 1.0, 2.7), M.woodDark);
  const horses = [-0.5, 0.5].map((x, k) => {
    const pivot = new THREE.Group(); // at the hind hooves, so a horse rears up
    pivot.position.set(x, 0, 3.0);
    const h = horse(M, { coat: COATS[k], cloth: '#23408a' });
    h.g.position.z = 0.58;
    pivot.add(h.g);
    g.add(pivot);
    return { pivot, h };
  });
  let dist = 0;
  return {
    g, men, horses, whip,
    /** the cart's move: `d` metres more, `pace` 0 standing .. 1 gallop, `rear` 0..1 the horses up on their hind legs */
    step(d, t, pace, rear = 0) {
      dist += d;
      for (const wg of wheels) wg.rotation.x = dist / 0.58;
      horses.forEach(({ pivot, h }, k) => {
        gallop(h, dist * 2.2 + k * 0.7, pace > 0.02 ? 0.25 + 0.45 * pace : 0);
        pivot.rotation.x = -0.75 * ease(rear) * (0.9 + 0.1 * Math.sin(t * 4 + k));
        if (rear > 0.05) h.legs.forEach((l, j) => { if (j >= 2) l.rotation.x = -0.9 * rear + 0.5 * Math.sin(t * 10 + j); });
      });
      g.position.y += pace * 0.03 * Math.abs(Math.sin(dist * 3));
      flag.rotation.y = 0.25 * Math.sin(t * 3) - 0.6 * pace;
    },
  };
}
function placeCart(F, C, s) {
  const x = pathX(s);
  C.g.position.set(x, F.ground(x, s), s);
  C.g.rotation.set(0, Math.atan(slope(s)), 0);
}

/** The escort round the cart (its middle at s): two guards in front, four behind (frame offsets [across, along]). */
const ESCORT = [[-0.8, 6.6], [0.8, 6.6], [-0.8, -3.4], [0.8, -3.4], [-0.8, -5.0], [0.8, -5.0]];
const escort = (M, story) => (story.guards || []).slice(0, 6).concat(Array(6).fill(null)).slice(0, 6).map((c) => guard(M, c));
/** Where each guard stands round the clearing's middle when they fight (and the bandit before them). */
const RING = (i, n = 6, r = 1.6) => { const a = (i / n) * Math.PI * 2 + 0.3; return [CX + Math.sin(a) * r, ZF + Math.cos(a) * r, a]; };

/** Name tags that follow their people (y over the head). */
function tags(list, sub) {
  return list.filter((P) => P.c?.name).map((P) => ({ P, ...castTag(P.c, sub?.(P)) }));
}
const tmp = new THREE.Vector3();
function placeTags(labels, y = 2.45) {
  for (const l of labels) { l.P.root.updateWorldMatrix(true, false); l.P.root.getWorldPosition(tmp); l.pos.set(tmp.x, tmp.y + y, tmp.z); }
}
/** Sword meeting club: a clang now and then while they fight. */
const clangs = (t0, t1, from, to, every = 0.37) => { const out = []; for (let s = t0 + from; s < Math.min(t1, t0 + to) - 0.05; s += every) out.push([s, 'clang']); return out; };

// ===== Day 1 =====

/** The convoy on the path (road: from above the trees; escort: along it at eye level). */
function convoyShot(args, low) {
  const { story, M } = args;
  const F = frame(args);
  const C = cart(M, story);
  F.group.add(C.g);
  const G = escort(M, story);
  for (const P of G) F.group.add(P.root);
  const labels = low ? [...tags(C.men, () => 'Merchant'), ...tags(G)] : [];
  const s0 = low ? -46 : -72, s1 = low ? -36 : -58;
  let T0 = 0, T1 = 1, last = null;
  const sAt = (t) => lerp(s0, s1, clamp01((t - T0) / (T1 - T0)));
  return {
    group: F.group, labels, banner: low ? null : "The kingdom's cart", phase: 0.2, fog: 0.006, low,
    focus: F.W(pathX(s0), 1.5, s0),
    setWindow(t0, t1) { T0 = t0; T1 = t1; },
    cam(u) {
      const s = lerp(s0, s1, u);
      if (!low) return { pos: F.W(pathX(s) + 9 - 4 * u, 24 - 9 * ease(u), s - 22 + 6 * u), look: F.W(pathX(s + 2), 1, s + 2), fov: 50 };
      return { pos: F.W(pathX(s - 2) + 5.2, 1.5, s - 2 + 1.5 * u), look: F.W(pathX(s + 1), 1.5, s + 1), fov: 60 };
    },
    update(t, t0, t1) {
      const on = t >= t0 && t < t1;
      F.show(on);
      if (!on) { last = null; return; }
      const s = sAt(t);
      placeCart(F, C, s);
      C.step(last === null ? 0 : s - last, t, 0.35);
      last = s;
      G.forEach((P, i) => {
        const [dx, dz] = ESCORT[i];
        onPath(F, P, dx, s + dz);
        stride(P, (s + dz) * 3.4 + (i % 2) * Math.PI, 0.45, { arms: false });
        P.r.g.rotation.set(-0.35 + 0.12 * Math.sin((s + dz) * 3.4 + i), 0, -0.1);
        P.l.g.rotation.set(-0.4, 0, 0.15);
        nod(P, 0);
        P.body.rotation.set(0, 0, 0);
      });
      C.men.forEach((P, i) => { P.r.g.rotation.set(-0.9, 0, -0.1); P.l.g.rotation.set(-0.9, 0, 0.1); nod(P, i ? 0.05 * Math.sin(t * 2) : 0); });
      placeTags(labels);
    },
  };
}


/** The trap: from the bushes ahead, the convoy comes on; the bandits leap out, the horses rear, the guards draw. */
function trapShot(args) {
  const { story, M } = args;
  const F = frame(args);
  const C = cart(M, story);
  F.group.add(C.g);
  const G = escort(M, story);
  for (const P of G) F.group.add(P.root);
  const B = HIDE.map(() => bandit(M));
  for (const P of B) F.group.add(P.root);
  const STOP = ZF; // where the cart halts
  let last = null;
  return {
    group: F.group, labels: [], banner: null, bannerAt: (t, t0, t1) => ((t - t0) / (t1 - t0) > 0.5 ? 'Bandits!' : null), phase: 0.22, fog: 0.006, low: true,
    focus: F.W(pathX(-12), 1.2, -12),
    cam(u) {
      // low behind a bush on the right, looking back down the path at the convoy coming on
      return { pos: F.W(pathX(-4) + 2.8, 1.0, -4 + 0.6 * u), look: F.W(pathX(-20), 1.4, -20), fov: 56 };
    },
    update(t, t0, t1) {
      const on = t >= t0 && t < t1;
      F.show(on);
      if (!on) { last = null; return; }
      const u = (t - t0) / (t1 - t0);
      const halt = ease(span(u, 0.4, 0.62)), k = Math.min(1, u / 0.62);
      const s = lerp(STOP - 11, STOP, 1 - (1 - k) * (1 - k)); // slowing to a stop
      placeCart(F, C, s);
      C.step(last === null ? 0 : s - last, t, 0.35 * (1 - halt), span(u, 0.55, 0.7) * (1 - span(u, 0.85, 1)));
      last = s;
      const draw = ease(span(u, 0.58, 0.75));
      G.forEach((P, i) => {
        const [dx, dz] = ESCORT[i];
        onPath(F, P, dx, s + dz);
        stride(P, (s + dz) * 3.4 + (i % 2) * Math.PI, 0.45 * (1 - halt), { arms: false });
        P.r.g.rotation.set(lerp(-0.35, -1.7, draw), 0, -0.15);
        P.l.g.rotation.set(lerp(-0.4, -1.0, draw), 0, 0.25);
        nod(P, 0);
      });
      // the bandits: crouched behind the bushes, then up and out onto the path, clubs high
      const leap = ease(span(u, 0.48, 0.68));
      B.forEach((P, i) => {
        const [hx, hz] = HIDE[i];
        const tx = hx * 0.35, tz = hz - 3.5;
        const z = lerp(hz, tz, leap), x = pathX(z) + lerp(hx, tx, leap);
        at(F, P, x, z, pathX(s), s);
        P.root.position.y -= 0.55 * (1 - span(u, 0.46, 0.55)); // crouched down out of sight
        P.body.rotation.set(0.6 * (1 - span(u, 0.46, 0.55)), 0, 0);
        stride(P, t * 9 + i, leap > 0 && leap < 1 ? 0.6 : 0.05, { arms: false });
        P.r.g.rotation.set(-2.5 + 0.3 * Math.sin(t * 7 + i), 0, 0.2);
        P.l.g.rotation.set(-1.2 * leap, 0, 0.3);
      });
      C.men.forEach((P, i) => { P.r.g.rotation.set(-0.9 - 1.2 * span(u, 0.55, 0.65), 0, -0.1); P.l.g.rotation.set(-0.9, 0, 0.1); nod(P, -0.1 * i); });
    },
  };
}

/** The guards stand round the cart and fight the bandits off (`flee`: then the cart breaks through toward the camera). */
function defendShot(args, flee) {
  const { story, M, seed } = args;
  const F = frame(args);
  const C = cart(M, story);
  F.group.add(C.g);
  const G = escort(M, story);
  for (const P of G) F.group.add(P.root);
  const n = flee ? 9 : 8;
  const B = Array.from({ length: n }, () => bandit(M));
  for (const P of B) F.group.add(P.root);
  const labels = flee ? tags(C.men, () => 'Merchant') : tags(G);
  const S0 = ZF; // the cart where it halted
  // round the cart: one guard at each corner and one each side; each squares up to a bandit coming out of the trees
  const POST = [[-1.6, 3.2], [1.6, 3.2], [-1.9, 0], [1.9, 0], [-1.6, -3.0], [1.6, -3.0]];
  let last = null;
  return {
    group: F.group, labels, phase: 0.24, fog: 0.005, low: true,
    banner: flee ? 'Ride for help!' : 'Defend the cart!',
    focus: F.W(pathX(S0), 1.4, S0),
    work: { strikeTimes: () => [], sound: null, hits: (t0, t1) => clangs(t0, t1, flee ? 0.2 : 0.6, flee ? 3.2 : 4.4, 0.33) },
    cam(u) {
      if (flee) {
        // low at the side of the path ahead: the cart charges toward the camera and past it, the fight behind
        return { pos: F.W(pathX(-4) + 2.6, 0.9, -4), look: F.W(pathX(-14), 1.5 + 0.6 * ease(span(u, 0.5, 1)), lerp(-16, -10, ease(span(u, 0.55, 0.9)))), fov: 60 };
      }
      const a = 0.9 + 1.1 * u;
      return { pos: F.W(pathX(S0) + Math.sin(a) * 7, 6.5, S0 + Math.cos(a) * 7), look: F.W(pathX(S0), 0.8, S0), fov: 56 };
    },
    update(t, t0, t1) {
      const on = t >= t0 && t < t1;
      F.show(on);
      if (!on) { last = null; return; }
      const u = (t - t0) / (t1 - t0);
      // the cart: still (defend), then off at a gallop down the path (flee)
      const go = flee ? Math.pow(span(u, 0.12, 1), 1.6) : 0;
      const s = S0 + 34 * go;
      placeCart(F, C, s);
      C.step(last === null ? 0 : s - last, t, flee ? Math.min(1, 0.4 + go * 2) : 0, flee ? 0 : 0.25 * (0.5 + 0.5 * Math.sin(t * 2)));
      last = s;
      // the whip cracks
      C.men[1].r.g.rotation.set(flee ? -2.4 + 1.2 * Math.abs(Math.sin(t * 6)) : -1.2, 0, -0.2);
      C.men[0].r.g.rotation.set(-1.0, 0, -0.1); C.men[0].l.g.rotation.set(-1.0, 0, 0.1);
      G.forEach((P, i) => {
        const [dx, dz] = POST[i];
        // when the cart breaks out, the two in front step aside and turn to the bandits behind
        const aside = flee ? ease(span(u, 0.05, 0.25)) : 0;
        const x = pathX(S0 + dz) + dx + (i < 2 ? Math.sign(dx) * 1.4 * aside : 0);
        const z = S0 + dz - (flee ? 1.2 * aside : 0);
        const B0 = B[i % B.length];
        at(F, P, x, z, B0.root.position.x, B0.root.position.z);
        stride(P, t * 3 + i, 0.08, { arms: false });
        fight(P, t, i, flee ? 1 : ease(span(u, 0.1 + i * 0.04, 0.3 + i * 0.04)));
        nod(P, 0);
      });
      B.forEach((P, i) => {
        // out of the trees on both sides toward a guard, then fighting at arm's length
        const g = G[i % G.length].root.position;
        const side = i % 2 ? 1 : -1;
        const come = ease(span(u, 0.02 * i, 0.3 + 0.03 * i));
        const fx = g.x + side * 1.15, fz = g.z - 0.4 + (i >= 6 ? -1.8 : 0);
        const sx = pathX(S0) + side * (10 + (i % 3) * 2), sz = S0 - 6 + i * 1.6;
        const x = lerp(sx, fx, come), z = lerp(sz, fz, come);
        at(F, P, x, z, g.x, g.z);
        stride(P, t * 9 + i, come < 1 ? 0.6 : 0.1, { arms: false });
        fight(P, t + 0.15, i + 3, come, false);
      });
      placeTags(labels);
    },
  };
}

/** The clash: six guards against the bandits pouring out of the trees; the camera rises; "To be continued...". */
function clashShot(args) {
  const { story, M, seed } = args;
  const F = frame(args);
  const G = escort(M, story);
  for (const P of G) F.group.add(P.root);
  const n = Math.min(22, story.bandits || 16);
  const B = Array.from({ length: n }, () => bandit(M));
  for (const P of B) F.group.add(P.root);
  const labels = tags(G);
  const S0 = ZF;
  return {
    group: F.group, labels, phase: 0.25, fog: 0.006, low: true, footer: 'Subscribe to see what happens tomorrow',
    banner: null, bannerAt: (t, t0, t1) => ((t - t0) / (t1 - t0) > 0.62 ? 'To be continued...' : 'Six against the forest'),
    focus: F.W(pathX(S0), 1.4, S0),
    work: { strikeTimes: () => [], sound: null, hits: (t0, t1) => clangs(t0, t1, 0.3, 6.5, 0.29) },
    cam(u) {
      // from among them, low, then up and back over the trees as more bandits come
      const k = ease(span(u, 0.2, 1));
      return { pos: F.W(pathX(S0) + 5 + 3 * k, 2.2 + 12 * k, S0 + 7 + 5 * k), look: F.W(pathX(S0), 1.1 - 0.3 * k, S0 - 1.5 * k), fov: 58 };
    },
    update(t, t0, t1) {
      const on = t >= t0 && t < t1;
      F.show(on);
      if (!on) return;
      const u = (t - t0) / (t1 - t0);
      // the guards in a ring, back to back, facing out
      G.forEach((P, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const x = pathX(S0) + Math.sin(a) * 1.5, z = S0 + Math.cos(a) * 1.5;
        at(F, P, x, z, x + Math.sin(a), z + Math.cos(a));
        stride(P, t * 3 + i, 0.06, { arms: false });
        fight(P, t, i, 1);
        nod(P, 0);
      });
      // the bandits: the first ring at arm's length, the rest still coming out of the trees
      B.forEach((P, i) => {
        const a = (i / n) * Math.PI * 2 + rand01(seed, 'aclash', i) * 0.3;
        const near = i < 6 ? 2.7 : 3.6 + (i % 3) * 0.9;
        const from = 16 + rand01(seed, 'aclash', i, 1) * 8;
        const come = ease(span(u, i < 6 ? 0 : 0.1 + (i - 6) * 0.045, i < 6 ? 0.05 : 0.45 + (i - 6) * 0.04));
        const r = lerp(from, near, come);
        const x = pathX(S0) + Math.sin(a) * r, z = S0 + Math.cos(a) * r;
        at(F, P, x, z, pathX(S0), S0);
        stride(P, t * 8 + i, come < 1 ? 0.55 : 0.12, { arms: false });
        fight(P, t + 0.2, i + 2, i < 6 ? 1 : 0.5 + 0.5 * come, false);
      });
      placeTags(labels);
    },
  };
}

// ===== Day 2 =====

/** The guards in the clearing, back to back; `phase` of the day: weary, the ring of bandits, closing in. */
function ringShot(args, kind) {
  const { story, M, seed } = args;
  const F = frame(args);
  const G = escort(M, story);
  for (const P of G) F.group.add(P.root);
  const downed = Array.from({ length: story.downed || 3 }, () => bandit(M));
  for (const P of downed) F.group.add(P.root);
  const n = kind === 'weary' ? 0 : Math.min(26, story.ring || 24);
  const B = Array.from({ length: n }, () => bandit(M));
  for (const P of B) F.group.add(P.root);
  const labels = kind === 'ring' ? [] : tags(G);
  return {
    group: F.group, labels, phase: 0.42, fog: 0.008, low: kind !== 'ring',
    banner: { weary: 'Still standing', ring: 'Surrounded!', closing: null }[kind],
    focus: F.W(CX, 1.2, ZF),
    work: kind === 'closing' ? { strikeTimes: () => [], sound: null, hits: (t0, t1) => clangs(t0, t1, 3.3, 4.4, 0.4) } : undefined,
    cam(u) {
      // (the frame is narrow: from high above, nearly straight down, so the whole ring fits across it)
      if (kind === 'ring') { const a = 0.4 + 0.8 * u; return { pos: F.W(CX + Math.sin(a) * 4, 29 - 3 * u, ZF + Math.cos(a) * 4), look: F.W(CX, 0, ZF), fov: 54 }; }
      if (kind === 'weary') return { pos: F.W(CX + 4.6 - 0.8 * u, 1.6, ZF + 4.0 - 0.6 * u), look: F.W(CX, 1.0, ZF - 0.3), fov: 55 };
      // between two guards, looking out at the ring closing in
      return { pos: F.W(CX - 0.3, 1.55, ZF + 0.6), look: F.W(CX - 1.2, 1.3, ZF + 6), fov: 66 };
    },
    update(t, t0, t1) {
      const on = t >= t0 && t < t1;
      F.show(on);
      if (!on) return;
      const u = (t - t0) / (t1 - t0);
      G.forEach((P, i) => {
        const [x, z, a] = RING(i, 6, kind === 'weary' ? 2.2 : 1.5);
        at(F, P, x, z, x + Math.sin(a), z + Math.cos(a));
        stride(P, t * 3 + i, 0.05, { arms: false });
        if (kind === 'weary') weary(P, t, i);
        else { fight(P, t * 0.5, i, kind === 'closing' ? 0.55 + 0.45 * span(u, 0.7, 0.8) : 0.45); nod(P, 0); }
      });
      // the bandits knocked out yesterday, out cold round them
      downed.forEach((P, i) => {
        const a = (i / downed.length) * Math.PI * 2 + 1.1;
        const x = CX + Math.sin(a) * 4.2, z = ZF + Math.cos(a) * 4.2;
        at(F, P, x, z, CX, ZF);
        down(P, 1);
        P.club.position.set(0.3, 0.2, 0);
      });
      // more of them out of the trees, closing the ring
      B.forEach((P, i) => {
        const a = (i / n) * Math.PI * 2 + rand01(seed, 'aring', i) * 0.2;
        const r0 = 12.5 + rand01(seed, 'aring', i, 1) * 3;
        const r1 = kind === 'ring' ? 7.5 + (i % 2) * 1.2 : 3.2 + (i % 2) * 1.0;
        const from = kind === 'ring' ? r0 : 7.5 + (i % 2) * 1.2;
        const come = ease(span(u, (i % 5) * 0.03, kind === 'ring' ? 0.6 : 0.75));
        const r = lerp(from, r1, come);
        const x = CX + Math.sin(a) * r, z = ZF + Math.cos(a) * r;
        at(F, P, x, z, CX, ZF);
        stride(P, t * 6 + i, come < 1 ? 0.4 : 0.05, { arms: false });
        // clubs slapped into the palm
        const slap = Math.abs(Math.sin(t * 4 + i));
        P.r.g.rotation.set(-1.3 - 0.6 * slap, 0, 0.25);
        P.l.g.rotation.set(-1.0, 0, 0.35);
        P.body.rotation.set(0.1, 0, 0);
      });
      placeTags(labels);
    },
  };
}

/** A rider of the town: on a horse at the gallop, a sword raised, the leader with the kingdom's banner. */
function rider(M, c, k, banner) {
  const color = c ? JOBS[c.job]?.color || JOBS.cavalier?.color || GUARD : JOBS.cavalier?.color || GUARD;
  const m = mount(M, color, COATS[k % COATS.length]);
  m.lance.visible = false;
  m.c = c;
  if (banner) {
    const pole = new THREE.Group();
    const add = (geo, mat) => { const o = new THREE.Mesh(geo, mat); o.castShadow = true; pole.add(o); return o; };
    add(cylGeo(0.03, 0.03, 3.2, 6).translate(0, 1.2, 0), M.woodDark);
    add(new THREE.PlaneGeometry(0.9, 0.6).translate(0.45, 2.45, 0), M.clothBlue);
    add(new THREE.PlaneGeometry(0.9, 0.13).translate(0.45, 2.5, 0.004), M.gold);
    pole.position.set(0, -0.62, 0.05);
    pole.rotation.x = Math.PI;
    m.R.r.hand.add(pole);
    m.R.r.g.rotation.set(-1.2, 0, -0.1);
  } else {
    m.R.r.hand.add(toolGeo('sword', M));
    m.R.r.g.rotation.set(-2.6, 0, -0.15);
  }
  return m;
}
const tagsRiders = (list) => list.filter((m) => m.c?.name).map((m) => ({ m, ...castTag(m.c) }));
function placeRiderTags(labels) {
  for (const l of labels) { l.m.h.g.updateWorldMatrix(true, false); l.m.h.g.getWorldPosition(tmp); l.pos.set(tmp.x, tmp.y + 3.3, tmp.z); }
}
// the cavalry's column: two files
const FILES = [[0, 0], [-0.9, -3.0], [0.9, -3.0], [-0.9, -6.0], [0.9, -6.0], [0, -9.0]];

/** The cavalry gallops down the path toward the camera, the cart behind them; a horn. */
function cavalryShot(args) {
  const { story, M } = args;
  const F = frame(args);
  const R = (story.riders || []).slice(0, 6).concat(Array(6).fill(null)).slice(0, 6).map((c, k) => rider(M, c, k, k === 0));
  for (const m of R) F.group.add(m.h.g);
  const C = cart(M, story);
  F.group.add(C.g);
  const labels = tagsRiders(R);
  let last = null;
  return {
    group: F.group, labels, banner: 'The cavalry!', phase: 0.45, fog: 0.006, low: true,
    focus: F.W(pathX(ZF + 40), 1.6, ZF + 40),
    work: { strikeTimes: () => [], sound: null, hits: () => [] },
    cam(u) {
      // low at the side of the path: they come from far up the path (+z) and thunder past
      const z = ZF + 28;
      return { pos: F.W(pathX(z) + 2.8, 0.7, z), look: F.W(pathX(z + 12), 2.0, lerp(z + 16, z + 6, ease(span(u, 0.5, 1)))), fov: 58 };
    },
    update(t, t0, t1) {
      const on = t >= t0 && t < t1;
      F.show(on);
      if (!on) { last = null; return; }
      const u = (t - t0) / (t1 - t0);
      // toward -z (back to the clearing, the town's side is +z)
      const head = lerp(ZF + 62, ZF + 12, u);
      R.forEach((m, k) => {
        const [dx, dz] = FILES[k];
        const z = head - dz;
        const x = pathX(z) + dx;
        m.h.g.position.set(x, F.ground(x, z), z);
        m.h.g.rotation.set(0, Math.atan(slope(z)) + Math.PI, 0);
        gallop(m.h, z * 2.4 + k, 0.65);
        if (k) m.R.r.g.rotation.set(-2.6 + 0.2 * Math.sin(t * 7 + k), 0, -0.15);
      });
      const s = head + 16;
      placeCart(F, C, s);
      C.g.rotation.y += Math.PI;
      C.step(last === null ? 0 : last - s, t, 1);
      last = s;
      C.men[1].r.g.rotation.set(-2.4 + 1.2 * Math.abs(Math.sin(t * 6)), 0, -0.2);
      placeRiderTags(labels);
    },
  };
}

/** The cavalry bursts into the clearing, the bandits drop their clubs and run (rout); the guards cheer (saved). */
function routShot(args, saved) {
  const { story, M, seed } = args;
  const F = frame(args);
  const G = escort(M, story);
  for (const P of G) F.group.add(P.root);
  const R = (story.riders || []).slice(0, 6).concat(Array(6).fill(null)).slice(0, 6).map((c, k) => rider(M, c, k, k === 0));
  for (const m of R) F.group.add(m.h.g);
  const n = saved ? 0 : Math.min(20, story.ring || 20);
  const B = Array.from({ length: n }, () => bandit(M));
  for (const P of B) F.group.add(P.root);
  const downed = Array.from({ length: story.downed || 3 }, () => bandit(M));
  for (const P of downed) F.group.add(P.root);
  const C = saved ? cart(M, story) : null;
  if (C) F.group.add(C.g);
  const labels = saved ? [...tags(G), ...tagsRiders(R)] : tagsRiders(R).slice(0, 3);
  let last = null;
  return {
    group: F.group, labels, phase: 0.48, fog: 0.006, low: saved,
    banner: saved ? 'Saved!' : 'Run for it!', footer: saved ? 'Subscribe to join the kingdom' : undefined,
    focus: F.W(CX, 1.4, ZF),
    work: { strikeTimes: () => [], sound: null, hits: () => [] },
    cam(u) {
      if (saved) return { pos: F.W(CX + 5.5 - 1.2 * u, 2.2, ZF - 6 + 1.5 * u), look: F.W(CX, 1.7, ZF + 0.5), fov: 56 };
      const a = 2.4 + 0.5 * u;
      return { pos: F.W(CX + Math.sin(a) * 11, 7, ZF + Math.cos(a) * 11), look: F.W(CX, 0.8, ZF + 1), fov: 56 };
    },
    update(t, t0, t1) {
      const on = t >= t0 && t < t1;
      F.show(on);
      if (!on) { last = null; return; }
      const u = (t - t0) / (t1 - t0);
      G.forEach((P, i) => {
        const [x, z, a] = RING(i, 6, saved ? 1.7 : 1.5);
        at(F, P, x, z, x + Math.sin(a), z + Math.cos(a));
        stride(P, t * 3 + i, 0.05, { arms: false });
        if (saved) {
          // swords up, cheering
          P.r.g.rotation.set(-2.9 + 0.2 * Math.sin(t * 9 + i), 0, -0.1);
          P.l.g.rotation.set(-0.6 - 1.6 * (0.5 + 0.5 * Math.sin(t * 6 + i)), 0, 0.3);
          P.body.rotation.set(0, 0, 0);
          nod(P, -0.15);
        } else { fight(P, t * 0.5, i, 0.4); nod(P, 0); }
      });
      // the riders: in from the path (+z side) and round the ring (rout); circling slowly round them (saved)
      R.forEach((m, k) => {
        const a0 = (k / 6) * Math.PI * 2;
        let x, z, dir;
        if (saved) {
          const a = a0 + 0.25 * (t - t0);
          x = CX + Math.sin(a) * 6.5; z = ZF + Math.cos(a) * 6.5; dir = a + Math.PI / 2;
          gallop(m.h, t * 5 + k, 0.25);
          m.R.r.g.rotation.set(-2.7, 0, -0.1);
        } else {
          const come = ease(span(u, 0, 0.55));
          const a = a0 + 1.2 * span(u, 0.4, 1);
          const ex = CX + Math.sin(a) * 6.5, ez = ZF + Math.cos(a) * 6.5;
          const sx = pathX(ZF + 30) + FILES[k][0], sz = ZF + 30 + FILES[k][1] * -1;
          x = lerp(sx, ex, come); z = lerp(sz, ez, come);
          dir = come < 1 ? Math.atan2(ex - sx, ez - sz) : a + Math.PI / 2;
          gallop(m.h, t * 7 + k, 0.65);
        }
        m.h.g.position.set(x, F.ground(x, z), z);
        m.h.g.rotation.set(0, dir, 0);
      });
      // the bandits: clubs dropped, running off into the trees (away from the middle)
      B.forEach((P, i) => {
        const a = (i / Math.max(1, n)) * Math.PI * 2 + rand01(seed, 'arout', i) * 0.2;
        const go = ease(span(u, 0.15 + (i % 4) * 0.05, 1));
        const r = lerp(4 + (i % 2), 22, go);
        const x = CX + Math.sin(a) * r, z = ZF + Math.cos(a) * r;
        at(F, P, x, z, CX + Math.sin(a) * 40, ZF + Math.cos(a) * 40);
        stride(P, t * 11 + i, go > 0.02 ? 0.7 : 0.05);
        P.club.visible = go <= 0.02;
        if (go > 0.02) { P.r.g.rotation.set(-2.6 + 0.4 * Math.sin(t * 9 + i), 0, -0.4); P.l.g.rotation.set(-2.6 + 0.4 * Math.cos(t * 9 + i), 0, 0.4); }
        else P.r.g.rotation.set(-2.0, 0, 0.2);
      });
      downed.forEach((P, i) => {
        const a = (i / downed.length) * Math.PI * 2 + 1.1;
        const x = CX + Math.sin(a) * 4.2, z = ZF + Math.cos(a) * 4.2;
        at(F, P, x, z, CX, ZF);
        down(P, 1);
      });
      if (C) {
        const s = lerp(ZF + 18, ZF + 8, ease(u));
        placeCart(F, C, s);
        C.g.rotation.y += Math.PI;
        C.step(last === null ? 0 : last - s, t, 0.3 * (1 - u));
        last = s;
        C.men.forEach((P, i) => { P.r.g.rotation.set(-2.7 + 0.2 * Math.sin(t * 8 + i), 0, -0.1); P.l.g.rotation.set(-2.5, 0, 0.1); });
      }
      placeTags(labels.filter((l) => l.P));
      placeRiderTags(labels.filter((l) => l.m));
    },
  };
}

const SHOTS = {
  road: (a) => convoyShot(a, false), escort: (a) => convoyShot(a, true), trap: trapShot,
  defend: (a) => defendShot(a, false), flee: (a) => defendShot(a, true), clash: clashShot,
  weary: (a) => ringShot(a, 'weary'), ring: (a) => ringShot(a, 'ring'), closing: (a) => ringShot(a, 'closing'),
  cavalry: cavalryShot, rout: (a) => routShot(a, false), saved: (a) => routShot(a, true),
};

/** The scene of one shot of the ambush (args.story.shot). */
export function buildAmbush(args) {
  const f = SHOTS[args.story.shot];
  return f ? f(args) : null;
}
