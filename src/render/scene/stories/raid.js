// The night raid (owner 2026-10-30, src/sim/stories.js `raid`): two days that take the whole video, one shot after
// another (timeline.js, RAID_SHOTS). Day 1 at night: a burning arrow hits a roof, the bandits come out of the woods with
// torches while the guards run along the Second Wall, the guard first to the gate, the ram at the gate, the gate gives
// way, a named villager's house burns, then smoke and silence. Day 2: the burnt house repaired, five named guards chase
// the bandits from their camp in the woods and free the missing villager, the town cheers them home through the gate,
// the crier announces it. Bandits have no names (black clothes and bandanas, outfits.js BANDIT). Nobody gets hurt: the
// guards push and stagger back, the bandits run.
// The gate's frame: x along the wall, y up from the gate's ground, z into the town (the doors at z 0, the opening
// |x| < 4.5, the towers from 4.5 to 9.5, the lintel from y 8 to 11, the wall walk at y 9).
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { heightAt, WATER_LEVEL } from '../../../sim/world.js';
import { wallLayout } from '../../../sim/wall.js';
import { FLOOR_H } from '../houseKit.js';
import { BANDIT } from '../outfits.js';
import { toolGeo } from '../work.js';
import { boxGeo, cylGeo } from '../kit.js';
import { person, stride, torch, flicker, flameMaterial, castTag, ease, clamp01 } from './common.js';
import { houseStage, buildFire, buildRebuild } from './house.js';
import { buildProclaim } from './proclaim.js';

const GUARD = JOBS.guard.color;
const FOLK = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#7b6a43'];
export const NIGHT = 1; // the raid's night (the torches, the fires and a moonlight fill keep it readable)
const MORNING = 0.12;
// when the roofs catch fire (video seconds): the arrow's house, then the two next to it (more arrows, off screen)
const IGNITE = [1.7, 0.62, 2.4];
const BURNT = 24.4; // the narrator: "By morning, three houses were gone." (raidScript): the three houses turn black
const WALL_H = 9; // the Second Wall's height (buildings.js buildWall2)
const WOODS = -47; // the edge of the woods out from the gate (no plot within 55 m there: raidGate in src/sim/stories.js)

// a soft round dot for the smoke and the embers (made once, in the browser)
let dot = null;
function softDot() {
  if (dot || typeof document === 'undefined') return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  dot = new THREE.CanvasTexture(c);
  return dot;
}

/** The gate's frame (see the top of the file). */
function gateFrame(w, story, yFn) {
  const g = story.gate;
  const y0 = Math.max(heightAt(w, g.x, g.z), 1.6);
  const up = new THREE.Vector3(0, 1, 0);
  let inward = new THREE.Vector3(-Math.sin(g.rot), 0, Math.cos(g.rot));
  if (inward.x * -g.x + inward.z * -g.z < 0) inward.negate(); // toward the castle
  const along = new THREE.Vector3().crossVectors(up, inward); // x = y cross z keeps the frame right-handed
  const matrix = new THREE.Matrix4().makeBasis(along, up, inward).setPosition(g.x, y0, g.z);
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(matrix);
  const inverse = matrix.clone().invert();
  const toLocal = (x, z) => { const p = new THREE.Vector3(x, y0, z).applyMatrix4(inverse); return [p.x, p.z]; };
  // the ground under a point of the frame, in the frame's y
  const ground = (x, z) => { const p = toWorld(x, 0, z); return yFn(p.x, p.z) - y0; };
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(matrix);
  group.visible = false;
  return { group, toWorld, toLocal, ground, y0 };
}

/** Someone standing at (x, z) of the frame, facing the frame's direction (dx, dz). */
function put(F, P, x, z, dx = 0, dz = 1, dy = 0) {
  P.root.position.set(x, F.ground(x, z) + dy, z);
  P.root.rotation.y = Math.atan2(dx, dz);
}

/** The two leaves of the gate, hinged on the towers, opening into the town. Returns { group, set(open, shake) }. */
function doors(M) {
  const group = new THREE.Group();
  const iron = M.iron;
  const leaves = [1, -1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 4.45, 0, 0);
    group.add(pivot);
    const leaf = new THREE.Group();
    pivot.add(leaf);
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(-side * x, y, z); m.castShadow = true; m.receiveShadow = true; leaf.add(m); };
    add(boxGeo(4.4, 8, 0.36), M.woodDark, 2.2, 4, 0);
    for (const y of [1.3, 4, 6.7]) for (const z of [-0.2, 0.2]) add(boxGeo(4.3, 0.22, 0.05), iron, 2.2, y, z);
    for (let k = 0; k < 5; k++) add(boxGeo(0.06, 7.9, 0.04), M.wood, 0.45 + k * 0.85, 4, -0.19);
    return { pivot, side };
  });
  // the bar across the inside
  const bar = new THREE.Mesh(boxGeo(9.2, 0.35, 0.3), M.wood);
  bar.position.set(0, 3.4, 0.38);
  bar.castShadow = true;
  group.add(bar);
  return {
    group,
    set(open, shake = 0, t = 0) {
      for (const { pivot, side } of leaves) pivot.rotation.y = side * (open * 1.7) + side * shake * 0.035 * Math.sin(t * 60);
      bar.visible = open < 0.02;
      bar.position.z = 0.38 + shake * 0.04 * Math.sin(t * 55);
    },
  };
}

/** A dark tree line across the road, from z0 outward (the edge of the northern woods); no trunk on the lanes kept clear. */
function treeLine(F, M, seed, z0, lanes = []) {
  const g = new THREE.Group();
  const leaves = new THREE.MeshStandardMaterial({ color: '#1f3322', roughness: 0.95 });
  const cone = new THREE.ConeGeometry(2.6, 9, 8).translate(0, 6.5, 0), trunk = cylGeo(0.3, 0.4, 2.4, 6).translate(0, 1.2, 0);
  for (let i = 0; i < 64; i++) {
    const r = (q) => rand01(seed, 'raidwood', i, q);
    const x = (r(0) - 0.5) * 120, z = z0 - r(1) * 28 - (Math.abs(x) < 6 ? 6 : 0);
    if (lanes.some((l) => Math.abs(l - x) < 1.1)) continue;
    const s = 1.3 + r(2) * 0.7; // tall enough to hide a house farther out
    for (const [geo, mat] of [[cone, leaves], [trunk, M.woodDark]]) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, F.ground(x, z) - 0.2, z);
      m.scale.setScalar(s);
      m.castShadow = true;
      g.add(m);
    }
  }
  return g;
}

/** A bandit: black clothes and bandanas, a torch, a club or a sack. */
function bandit(M, i, kind = i % 3 ? 'torch' : 'club') {
  const P = person(M, BANDIT);
  if (kind === 'torch') P.flame = torch(M, P.r.hand);
  else if (kind === 'club') { const c = new THREE.Mesh(cylGeo(0.04, 0.075, 0.8, 6).translate(0, -0.25, 0.08), M.woodDark); c.castShadow = true; P.r.hand.add(c); }
  else if (kind === 'sack') P.l.hand.add(toolGeo('sack', M));
  return P;
}

/** A guard of the kingdom, a spear or (k) a sword. */
function guardRig(M, c, sword = false) {
  const P = person(M, c ? JOBS[c.job]?.color || GUARD : GUARD);
  P.r.hand.add(toolGeo(sword || ['knight', 'cavalier'].includes(c?.job) ? 'sword' : 'spear', M));
  return P;
}

/** Moonlight over the whole scene (the night stays readable), and a warm light that follows the torches. */
function nightLights(group, power = 1.1) {
  const moon = new THREE.HemisphereLight('#9fb4d8', '#2a2418', power);
  group.add(moon);
  return moon;
}

/** A longbow held upright in the left hand (hand frame, the arm along -y). */
function bowGeo(M) {
  const g = new THREE.Group();
  const stave = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.022, 5, 18, Math.PI * 0.8).rotateZ(Math.PI * 0.6).translate(0.62, 0, 0), M.woodDark);
  stave.castShadow = true;
  g.add(stave);
  g.rotation.y = Math.PI / 2;
  return g;
}

/** An arrow along +z (the head at +z). */
function arrowGeo(M) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(cylGeo(0.04, 0.04, 1.4, 5).rotateX(Math.PI / 2), M.wood));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 5).rotateX(Math.PI / 2).translate(0, 0, 0.8), M.iron));
  g.add(new THREE.Mesh(boxGeo(0.02, 0.14, 0.3).translate(0, 0, -0.6), M.clothIvory)); // the white fletching shows in the dark
  return g;
}

/**
 * What stands outside the gate in the gate's frame (owner 2026-10-30: the bandits never walk through a tree or a house):
 * the trees of the land and the houses ([x, z, radius]).
 */
function obstacles(F, state, nature, half = 60, far = -110) {
  const out = [];
  for (const tr of nature?.trees || []) { const [x, z] = F.toLocal(tr.x, tr.z); if (Math.abs(x) < half && z > far && z < 30) out.push([x, z, 0.9 + 0.4 * (tr.s || 1)]); }
  for (const p of state.plots || []) { const [x, z] = F.toLocal(p.x, p.z); if (Math.abs(x) < half + 90 && z > far - 90 && z < 30) out.push([x, z, Math.max(p.hw || 5, p.hd || 5) + 1.5, true]); }
  return out;
}

/** Lanes across x (step apart, within half of cx) free of every obstacle with z between z0 and z1. */
function clearLanes(obs, z0, z1, half, step = 1.1, clear = 0.8, cx = 0) {
  const lanes = [];
  for (let x = cx - half; x <= cx + half; x += step) if (!obs.some(([ox, oz, r]) => oz > Math.min(z0, z1) - r && oz < Math.max(z0, z1) + r && Math.abs(ox - x) < r + clear)) lanes.push(x);
  return lanes;
}

/** The top of the Second Wall near frame point (x, 0): a point on the wall walk, in the frame ([x, y, z]). */
function wallWalk(F, w, state) {
  const pieces = wallLayout(w, state.wall2.pts).pieces;
  return (x) => {
    const p = F.toWorld(x, 0, 0);
    let best = null, bd = Infinity;
    for (const s of pieces) {
      const c = Math.cos(s.rot), sn = Math.sin(s.rot);
      const k = Math.max(-s.hw, Math.min(s.hw, (p.x - s.x) * c + (p.z - s.z) * sn));
      const qx = s.x + c * k, qz = s.z + sn * k, d = Math.hypot(p.x - qx, p.z - qz);
      if (d < bd) { bd = d; best = { qx, qz, y: Math.max(heightAt(w, s.x, s.z), 1.6) + WALL_H }; }
    }
    if (!best) return [x, WALL_H, 0];
    const [lx, lz] = F.toLocal(best.qx, best.qz);
    return [lx, best.y - F.y0, lz + 0.45];
  };
}

/** Flames on a house's roof and in its windows, black smoke out of the windows, a glow, a column of smoke; level 0..1. */
function blaze(houses, id, M, seed, k, roofs = []) {
  const st = houseStage(houses, id);
  if (!st) return null;
  const { group, W, D, wallH, roofH } = st;
  houses.group.updateMatrixWorld(true);
  for (const r of roofs) r.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const roofAt = (x, z) => {
    ray.set(st.toWorld(x, 40, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObjects([houses.group, ...roofs], true)[0];
    return hit ? hit.point.y - st.sh.base - 0.25 : wallH + roofH * (1 - Math.abs(z) / (D / 2));
  };
  // owner 2026-10-30: more flames, the whole roof alight
  const spots = [[-W * 0.36, -D * 0.22, 2.6], [-W * 0.12, -D * 0.08, 3.0], [W * 0.1, -D * 0.18, 2.8], [W * 0.34, -D * 0.06, 2.5], [-W * 0.3, D * 0.14, 2.4],
    [W * 0.02, D * 0.05, 3.2], [W * 0.3, D * 0.22, 2.3], [-W * 0.05, -D * 0.32, 2.2], [W * 0.22, -D * 0.34, 2.0]].map(([x, z, s]) => [x, roofAt(x, z), z, s]);
  // the windows of the front, every storey: flames inside and black smoke pouring out
  const windows = [];
  for (let f = 0; f < st.sh.floors; f++) for (const x of [-W * 0.28, W * 0.28]) windows.push([x, f * FLOOR_H + FLOOR_H * 0.55, -D / 2 - 0.05]);
  for (const [x, y, z] of windows) spots.push([x, y - 0.6, z - 0.1, 1.15]);
  const flames = [];
  spots.forEach(([x, y, z, s], i) => {
    for (const [c, r, h] of [['#ff5a14', 0.55, 1.7], ['#ffb347', 0.38, 1.2], ['#ffe08a', 0.2, 0.8]]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(r * s, h * s, 9).translate(0, (h * s) / 2, 0), flameMaterial(c));
      f.position.set(x, y, z);
      f.userData.k = i * 3 + flames.length % 3;
      group.add(f);
      flames.push(f);
    }
  });
  const roofY = roofAt(0, 0);
  const glow = new THREE.PointLight('#ff7a2a', 0, 38, 2);
  glow.position.set(0, roofY + 1, -D / 2 - 2.5);
  group.add(glow);
  const points = (n, mat) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false;
    group.add(p);
    return geo;
  };
  const N = 200, NW = 30 * windows.length;
  const smoke = points(N, new THREE.PointsMaterial({ color: '#2a2624', size: 3.6, map: softDot(), transparent: true, opacity: 0.55, depthWrite: false }));
  const black = points(NW, new THREE.PointsMaterial({ color: '#0c0a09', size: 2.1, map: softDot(), transparent: true, opacity: 0.8, depthWrite: false }));
  group.visible = false;
  return {
    group, st, roofY,
    update(t, level, tall = 1) {
      group.visible = level > 0.01;
      glow.visible = group.visible;
      if (!group.visible) return;
      for (const f of flames) { flicker(f, t, f.userData.k + k * 7); f.scale.multiplyScalar(Math.max(0.05, level)); }
      glow.intensity = 120 * level * (1 + 0.15 * Math.sin(t * 19 + k));
      const sp = smoke.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const r = (q) => rand01(seed, 'raidsmoke', k, i, q);
        const age = (t * 0.45 + r(0)) % 1;
        sp[i * 3] = (r(1) - 0.5) * W * 0.8 + age * 4;
        sp[i * 3 + 1] = roofY + 0.8 + age * 18 * tall;
        sp[i * 3 + 2] = (r(2) - 0.5) * D * 0.6 + age * 2;
      }
      smoke.attributes.position.needsUpdate = true;
      // black smoke rolling out of each window and up the front
      const bp = black.attributes.position.array;
      for (let i = 0; i < NW; i++) {
        const [x, y, z] = windows[Math.floor(i / 30)];
        const r = (q) => rand01(seed, 'raidwin', k, i, q);
        const age = (t * 0.7 + r(0)) % 1;
        bp[i * 3] = x + (r(1) - 0.5) * 0.9 + age * 0.8;
        bp[i * 3 + 1] = y + age * 4.5;
        bp[i * 3 + 2] = z - 0.2 - age * 1.6 * (0.5 + r(2));
      }
      black.attributes.position.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------------------------------------ day 1
// (every shot of the night empties the streets: `quietTown`, main.js)

/** 0-2 s: a burning arrow out of the dark into a roof, the roof catches, villagers run in the street. */
function arrowShot({ story, M, houses, animated, seed }) {
  // the three houses burn from here to the end of the video (seen from every shot that shows them) and turn black when
  // the narrator says they are gone (24.4 s, raidScript)
  const roofs = story.houses.map((id) => animated?.get(id)?.group).filter(Boolean);
  const fires = story.houses.map((id, k) => blaze(houses, id, M, seed, k, roofs)).filter(Boolean);
  const target = fires[1] || fires[0];
  if (!target) return null;
  const { st } = target;
  // (each fire keeps its own house's frame: the houseStage groups carry the house's matrix, so they go in a plain group)
  const group = new THREE.Group();
  for (const f of fires) group.add(f.group);
  const { W, D, wallH } = st;
  const shotGroup = new THREE.Group();
  shotGroup.matrixAutoUpdate = false;
  shotGroup.matrix.copy(st.group.matrix);
  shotGroup.visible = false;
  const arrow = new THREE.Group();
  const shaft = new THREE.Mesh(cylGeo(0.035, 0.035, 1.1, 5).rotateX(Math.PI / 2), M.woodDark);
  arrow.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.1, 8).rotateX(-Math.PI / 2).translate(0, 0, 0.3), flameMaterial('#ffb347'));
  arrow.add(tip);
  shotGroup.add(arrow);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3));
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ color: '#ffb060', size: 0.7, map: softDot(), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  trail.frustumCulled = false;
  shotGroup.add(trail);
  // out of the dark beyond the house, high on the left of the frame, down into the front of the roof
  const from = new THREE.Vector3(-W / 2 - 18, target.roofY + 15, D / 2 + 34), to = new THREE.Vector3(W * 0.05, target.roofY - 0.1, -D * 0.05);
  const HIT = 0.62;
  const runners = FOLK.slice(0, 4).map((c, i) => {
    const P = person(M, c);
    P.lane = -D / 2 - 2.5 - (i % 2) * 1.4;
    P.lag = rand01(seed, 'raidrun', i) * 3;
    shotGroup.add(P.root);
    return P;
  });
  nightLights(shotGroup, 0.9);
  group.add(shotGroup);
  const p = new THREE.Vector3(), dir = to.clone().sub(from).normalize(), fwd = new THREE.Vector3(0, 0, 1);
  return {
    group,
    labels: [],
    banner: null,
    phase: NIGHT,
    quietTown: true,
    focus: st.toWorld(0, wallH, 0),
    cam(u) {
      return { pos: st.toWorld(W / 2 + 7 - 1.5 * u, wallH + 1.6 + 0.4 * u, -D / 2 - 12 + 1.2 * u), look: st.toWorld(-1, wallH - 0.6, 1) };
    },
    update(t, t0, t1) {
      // the fires: lit in turn, burning low over the smoke at the end; the houses black once they are gone
      fires.forEach((f, k) => {
        const lit = clamp01((t - IGNITE[k]) / 1.4);
        const level = t > 24 ? 0.55 - 0.2 * clamp01((t - 24) / 6) : lit;
        f.update(t, level, t > 24 ? 1.4 : 1);
      });
      const black = ease(clamp01((t - BURNT) / 1.2));
      for (const id of story.houses) animated?.get(id)?.burn?.(black);
      shotGroup.visible = t >= t0 && t <= t1;
      if (!shotGroup.visible) return;
      const u = (t - t0) / (t1 - t0);
      const a = clamp01((t - t0) / HIT);
      p.lerpVectors(from, to, a);
      p.y += Math.sin(Math.PI * a) * 3;
      arrow.position.copy(p);
      arrow.quaternion.setFromUnitVectors(fwd, dir); // along the flight, and stuck in the roof at that tilt
      tip.scale.setScalar(a >= 1 ? 0.6 + 0.2 * Math.sin(t * 30) : 1);
      const tr = trailGeo.attributes.position.array;
      for (let i = 0; i < 40; i++) {
        const b = a - i * 0.012;
        if (b <= 0 || a >= 1) { tr[i * 3] = tr[i * 3 + 1] = tr[i * 3 + 2] = 1e4; continue; }
        const q = new THREE.Vector3().lerpVectors(from, to, b);
        q.y += Math.sin(Math.PI * b) * 3;
        tr[i * 3] = q.x; tr[i * 3 + 1] = q.y; tr[i * 3 + 2] = q.z;
      }
      trailGeo.attributes.position.needsUpdate = true;
      // villagers run down the street, arms up, once the roof catches
      runners.forEach((P, i) => {
        const s = -12 + (t - t0 - 0.3 + P.lag * 0.2) * 6.5;
        P.root.position.set(s, 0, P.lane);
        P.root.rotation.y = Math.PI / 2;
        stride(P, s * 3 + i, 0.9, { arms: false });
        P.r.g.rotation.x = -2.6 + 0.3 * Math.sin(t * 9 + i);
        P.l.g.rotation.x = -2.4 + 0.3 * Math.cos(t * 8 + i);
        P.root.visible = u > 0.25;
      });
    },
  };
}

/** 2-6 s: the bandits come out of the woods with torches; the guards run along the wall walk to the gate. */
function woodsShot({ story, w, state, M, seed, yFn, nature }) {
  const F = gateFrame(w, story, yFn);
  const { group } = F;
  // lanes clear of the land's trees and the houses from inside the woods to where they run to; the woods keep them clear
  const obs = obstacles(F, state, nature);
  const lanes = clearLanes(obs, WOODS - 9, -14, 24);
  group.add(treeLine(F, M, seed, WOODS, lanes));
  const n = story.bandits || 40;
  const horde = Array.from({ length: n }, (_, i) => {
    const P = bandit(M, i);
    const r = (q) => rand01(seed, 'raidhorde', i, q);
    P.x0 = lanes.length ? lanes[(i * 7) % lanes.length] : 0;
    P.z0 = WOODS - 2 - Math.floor(i / Math.max(1, lanes.length)) * 2.6 - r(2) * 1.5; // out from among the trees, one behind another
    P.lag = r(3) * 0.9;
    P.speed = 5.2;
    group.add(P.root);
    return P;
  });
  // the guards on the wall walk, running to the gate; the named ones first
  const walk = wallWalk(F, w, state);
  const named = [story.guard, ...(story.defenders || [])].filter(Boolean);
  const runners = Array.from({ length: Math.max(7, named.length + 2) }, (_, i) => {
    const c = named[i] || null;
    const P = guardRig(M, c);
    P.c = c;
    P.x0 = 13 + i * 3.4 + rand01(seed, 'raidwall', i) * 1.2;
    group.add(P.root);
    return P;
  });
  const lights = [-1, 1].map(() => { const l = new THREE.PointLight('#ff9a4a', 220, 45, 2); group.add(l); return l; });
  nightLights(group, 1.0);
  const labels = runners.filter((P) => P.c).map((P) => ({ P, ...castTag(P.c) }));
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    banner: null,
    phase: NIGHT,
    quietTown: true,
    focus: F.toWorld(0, 4, -40),
    cam(u) {
      return { pos: F.toWorld(19 - 2 * u, 15.5, 7 + 1.5 * u), look: F.toWorld(1, 3, -40 + 4 * u) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      if (!group.visible) return;
      const T = t - t0;
      const sum = [[0, 0, 0], [0, 0, 0]];
      horde.forEach((P, i) => {
        const run = Math.max(0, T - P.lag);
        const z = P.z0 + run * P.speed;
        put(F, P, P.x0, z, 0, 1); // straight down its lane
        stride(P, z * 3 + i, run > 0 ? 0.85 : 0.1, { arms: false });
        P.r.g.rotation.x = P.flame ? -2.2 : -1.3 - 0.8 * Math.abs(Math.sin(t * 6 + i));
        P.l.g.rotation.x = -0.4 + 0.5 * Math.sin(z * 3);
        if (P.flame) flicker(P.flame, t, i);
        const s = sum[P.x0 < 0 ? 0 : 1];
        s[0] += P.root.position.x; s[1] += P.root.position.z; s[2]++;
      });
      lights.forEach((l, k) => { const s = sum[k]; if (s[2]) l.position.set(s[0] / s[2], 3.5, s[1] / s[2]); });
      runners.forEach((P, i) => {
        const x = Math.max(11 + i * 1.3, P.x0 - T * 6.2);
        const [wx, wy, wz] = walk(x);
        P.root.position.set(wx, wy, wz); // standing on the wall walk
        P.root.rotation.y = -Math.PI / 2;
        stride(P, x * 3 + i, x > 11.1 + i * 1.3 ? 0.9 : 0, { arms: false });
        P.r.g.rotation.x = -0.6;
        P.l.g.rotation.x = 0.4 * Math.sin(x * 3);
      });
      for (const lb of labels) lb.pos.copy(tmp.copy(lb.P.root.position).setY(lb.P.root.position.y + 2.3)).applyMatrix4(group.matrix);
    },
  };
}

/** 6-11 s: the named guard first to the gate, the others in a column behind him; the doors start to shake. */
function guardShot({ story, w, M, seed, yFn }) {
  const F = gateFrame(w, story, yFn);
  const { group } = F;
  const gate = doors(M);
  group.add(gate.group);
  const hero = guardRig(M, story.guard);
  group.add(hero.root);
  const others = Array.from({ length: 4 }, (_, i) => { const P = guardRig(M, null); P.x = [-1.6, 0.5, -0.4, 1.4][i]; P.gap = 2.2 + i * 1.5; group.add(P.root); return P; });
  // torchlight under and over the doors from the bandits outside
  const outside = new THREE.PointLight('#ff8a3a', 160, 22, 2);
  outside.position.set(0, 9.5, -4);
  group.add(outside);
  const lamp = new THREE.PointLight('#ffb070', 60, 18, 2);
  lamp.position.set(-3.5, 4, 5);
  group.add(lamp);
  nightLights(group, 0.9);
  const labels = story.guard ? [{ ...castTag(story.guard, 'First to the gate') }] : [];
  const ARRIVE = 0.55;
  let hx = -0.6, hz = 26;
  return {
    group,
    labels,
    banner: null,
    phase: NIGHT,
    quietTown: true,
    focus: F.toWorld(0, 1.6, 4),
    cam(u) {
      // owner 2026-10-30: from higher and to the side, so the guard and the column behind him are all in the frame; once he
      // has run past, from behind the column, the doors ahead
      const k = ease(clamp01(u / ARRIVE));
      return { pos: F.toWorld(6.4, 4.6 + 1.2 * k, Math.max(hz - 8.5, 12)), look: F.toWorld(-0.3, 1.4, hz + 2.8 * (1 - k) + 1.2 * k) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0);
      const k = clamp01(u / ARRIVE);
      hz = 1.3 + 24.7 * (1 - ease(k));
      const there = k >= 1;
      put(F, hero, hx, hz, 0, -1);
      stride(hero, hz * 3, there ? 0 : 0.95, { arms: false });
      // at the doors: both arms on the bar, braced
      hero.r.g.rotation.x = there ? -1.45 : -0.7;
      hero.l.g.rotation.x = there ? -1.45 : 0.5 * Math.sin(hz * 3);
      hero.body.rotation.x = there ? 0.25 : 0.1;
      others.forEach((P, i) => {
        const z = hz + P.gap;
        put(F, P, P.x, z, 0, -1);
        stride(P, z * 3 + i, there ? 0 : 0.9, { arms: false });
        P.r.g.rotation.x = there ? -1.3 : -0.7;
      });
      const shake = clamp01((u - 0.78) * 5);
      gate.set(0, shake * (0.5 + 0.5 * Math.sin(t * 7)), t);
      outside.intensity = 160 * (1 + 0.2 * Math.sin(t * 13));
      if (labels[0]) labels[0].pos.copy(F.toWorld(hx, F.ground(hx, hz) + 2.35, hz));
    },
  };
}

/** 11-15 s: outside the gate: the ram against the doors; the named guards on the gatehouse shoot arrows at the ground in front of the bandits. */
function fightShot({ story, w, state, M, seed, yFn, nature }) {
  const F = gateFrame(w, story, yFn);
  const { group } = F;
  const gate = doors(M);
  group.add(gate.group);
  const PERIOD = 1.0, FIRST = 0.42;
  // the ram: a trunk carried by six bandits, three each side
  const ram = new THREE.Group();
  const log = new THREE.Mesh(cylGeo(0.36, 0.4, 6.5, 10).rotateX(Math.PI / 2), M.woodDark);
  log.castShadow = true;
  ram.add(log);
  const cap = new THREE.Mesh(cylGeo(0.42, 0.42, 0.4, 10).rotateX(Math.PI / 2).translate(0, 0, 3.3), M.iron);
  ram.add(cap);
  group.add(ram);
  const carriers = Array.from({ length: 6 }, (_, i) => { const P = bandit(M, i, 'none'); P.side = i % 2 ? 1 : -1; P.along = -2 + Math.floor(i / 2) * 2; group.add(P.root); return P; });
  // the others wait behind, on ground clear of trees and houses
  const lanes = clearLanes(obstacles(F, state, nature), -20, -8, 10, 1.3);
  const mob = Array.from({ length: Math.min(12, lanes.length * 2) }, (_, i) => {
    const P = bandit(M, i, i % 4 === 3 ? 'club' : 'torch');
    P.x = lanes[(i * 5) % lanes.length];
    P.z = -10 - (i % 2) * 3.2 - rand01(seed, 'raidmob', i, 1) * 2;
    group.add(P.root);
    return P;
  });
  // owner 2026-10-30: the guards on the gatehouse (the lintel's top, y 11) are named and shoot arrows down
  const named = [story.guard, ...(story.defenders || [])].filter(Boolean);
  const nTop = Math.max(4, named.length);
  const top = Array.from({ length: nTop }, (_, i) => {
    const c = named[i] || null;
    const P = person(M, c ? JOBS[c.job]?.color || GUARD : GUARD);
    P.l.hand.add(bowGeo(M));
    P.c = c;
    P.x = (i - (nTop - 1) / 2) * 1.9;
    P.root.position.set(P.x, 11, -0.9);
    P.root.rotation.y = Math.PI;
    P.shots = Array.from({ length: 4 }, (_, j) => {
      const a = arrowGeo(M);
      a.visible = false;
      group.add(a);
      // each arrow: when it is loosed (seconds into the shot) and where it lands, in front of the bandits
      return { a, at: 0.35 + i * 0.27 + j * 1.05, to: new THREE.Vector3(P.x * 0.8 + (rand01(seed, 'raidarrow', i, j) - 0.5) * 3, 0, -6.2 - rand01(seed, 'raidarrow', i, j, 1) * 1.6) };
    });
    group.add(P.root);
    return P;
  });
  const FLY = 0.42;
  const light = new THREE.PointLight('#ff9a4a', 260, 40, 2);
  light.position.set(0, 4, -10);
  group.add(light);
  nightLights(group, 1.0);
  const labels = top.filter((P) => P.c).map((P) => ({ P, ...castTag(P.c, P.c === story.guard ? 'First to the gate' : undefined) }));
  const hitAt = (t0, t1) => { const out = []; for (let s = t0 + FIRST; s < t1 - 0.1; s += PERIOD) out.push(s); return out; };
  const landAt = (t0, t1) => top.flatMap((P) => P.shots.map((s) => t0 + s.at + FLY)).filter((s) => s < t1).map((s) => [s, 'chop']);
  const tmp = new THREE.Vector3(), from = new THREE.Vector3(), fwd = new THREE.Vector3(0, 0, 1);
  return {
    group,
    labels,
    banner: null,
    footer: 'Subscribe to join the defense',
    phase: NIGHT,
    quietTown: true,
    focus: F.toWorld(0, 6, -3),
    work: { strikeTimes: () => [], sound: null, hits: (t0, t1) => [...hitAt(t0, t1).map((s) => [s, 'ram']), ...landAt(t0, t1)] },
    cam(u) {
      // far enough out and looking up enough that the archers and their names are well inside the frame
      return { pos: F.toWorld(-9 + 2 * u, 3.4, -25 + 1.5 * u), look: F.toWorld(0, 7.2, -2) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      if (!group.visible) return;
      const T = t - t0;
      // the ram swings back and slams forward once a PERIOD (the hit at FIRST + k PERIOD)
      const c = (((T - FIRST) % PERIOD) + PERIOD) % PERIOD / PERIOD; // 0 at the hit
      const swing = c < 0.15 ? c / 0.15 : c < 0.7 ? 1 : 1 - (c - 0.7) / 0.3; // back, hold, forward to the doors
      const z = -3.55 - 2.2 * ease(swing);
      ram.position.set(0, F.ground(0, z) + 1.3, z);
      carriers.forEach((P, i) => {
        put(F, P, P.side * 0.75, z + P.along, 0, 1);
        P.root.rotation.y = P.side > 0 ? -Math.PI / 2 + 0.3 : Math.PI / 2 - 0.3;
        stride(P, z * 4 + i, 0.4, { arms: false });
        P.r.g.rotation.x = P.l.g.rotation.x = -1.1;
      });
      const hit = c < 0.12 ? 1 - c / 0.12 : 0;
      gate.set(0, hit, t);
      mob.forEach((P, i) => {
        put(F, P, P.x, P.z + 0.3 * Math.sin(t * 2 + i), 0, 1);
        P.r.g.rotation.x = P.flame ? -2.4 + 0.4 * Math.sin(t * 5 + i) : -1.4 - 0.9 * Math.abs(Math.sin(t * 6 + i));
        P.l.g.rotation.x = -1.8 + 0.6 * Math.sin(t * 4 + i * 2);
        stride(P, t * 4 + i, 0.15, { arms: false });
        if (P.flame) flicker(P.flame, t, i);
      });
      top.forEach((P) => {
        // draw, loose, nock the next: the bow arm out and down toward the ground in front of the gate
        const next = P.shots.find((s) => s.at > T - 0.15);
        const draw = next ? clamp01(1 - (next.at - T) / 0.8) : 0;
        P.body.rotation.x = 0.35;
        P.l.g.rotation.set(-1.35, 0, 0.1);
        P.r.g.rotation.set(-1.35 + 0.15 * draw, 0, -0.25 - 0.35 * draw);
        for (const s of P.shots) {
          const k = (T - s.at) / FLY;
          s.a.visible = k >= 0;
          if (k < 0) continue;
          from.set(P.x, 12.4, -1.4);
          const kk = Math.min(1, k);
          s.a.position.lerpVectors(from, s.to.clone().setY(F.ground(s.to.x, s.to.z) + 0.3), kk);
          s.a.quaternion.setFromUnitVectors(fwd, s.to.clone().setY(F.ground(s.to.x, s.to.z)).sub(from).normalize()); // stuck in the ground at the angle it fell
        }
      });
      light.intensity = 260 * (1 + 0.15 * Math.sin(t * 17));
      for (const lb of labels) lb.pos.copy(tmp.copy(lb.P.root.position).setY(13.4)).applyMatrix4(group.matrix);
    },
  };
}

/**
 * 15-18 s: inside, the doors burst open; each guard holds off one bandit (sword against club, nobody hurt) while the
 * others run in through the middle of the gate, past the guards, never through them.
 */
function breachShot({ story, w, M, seed, yFn }) {
  const F = gateFrame(w, story, yFn);
  const { group } = F;
  const gate = doors(M);
  group.add(gate.group);
  const BURST = 0.14;
  const SPOTS = [-3.3, -1.7, 1.7, 3.3]; // where the guards stand, the middle of the gate open
  const guards = SPOTS.map((x, i) => { const P = guardRig(M, null, i % 2 === 0); P.x = x; group.add(P.root); return P; });
  const foes = SPOTS.map((x, i) => { const P = bandit(M, i, 'club'); P.x = x; P.lag = 0.1 + i * 0.12; group.add(P.root); return P; });
  const wave = Array.from({ length: 12 }, (_, i) => {
    const P = bandit(M, i, i % 3 === 2 ? 'club' : 'torch');
    const r = (q) => rand01(seed, 'raidwave', i, q);
    P.x = i % 2 ? 0.45 : -0.45; P.spread = (i % 2 ? 1 : -1) * (0.5 + r(1) * 0.9); P.lag = 0.35 + i * 0.22 + r(2) * 0.1;
    group.add(P.root);
    return P;
  });
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(80 * 3), 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#8a7f73', size: 0.9, map: softDot(), transparent: true, opacity: 0.55, depthWrite: false }));
  dust.frustumCulled = false;
  group.add(dust);
  const light = new THREE.PointLight('#ff9a4a', 240, 30, 2);
  group.add(light);
  nightLights(group, 0.9);
  const DUEL = 0.9; // seconds after the burst when the fights begin
  const clashes = (t0, t1) => { const b = t0 + BURST * (t1 - t0) + DUEL, out = []; for (let s = b; s < t1 - 0.1; s += 0.45) out.push([s, 'clang']); return out; };
  return {
    group,
    labels: [],
    banner: null,
    phase: NIGHT,
    quietTown: true,
    focus: F.toWorld(0, 3, 0),
    work: { strikeTimes: () => [], sound: null, hits: (t0, t1) => [[t0 + BURST * (t1 - t0), 'ram'], [t0 + BURST * (t1 - t0) + 0.05, 'crash'], ...clashes(t0, t1)] },
    cam(u) {
      return { pos: F.toWorld(5.5 - 1.2 * u, 3.4, 17 + 1.5 * u), look: F.toWorld(0, 2.6, 2) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      if (!group.visible) return;
      const after = Math.max(0, t - t0 - BURST * (t1 - t0));
      const open = after > 0 ? Math.min(1, 1 - (1 - Math.min(1, after / 0.35)) ** 3) : 0;
      gate.set(open * 0.92, after > 0 ? 0 : 1, t);
      const fight = after > DUEL;
      guards.forEach((P, i) => {
        // braced on the doors, thrown back a few steps when they burst, then each meets one bandit
        const back = 2.6 * ease(Math.min(1, after / 0.7));
        const gz = 1.3 + back;
        put(F, P, P.x, gz, 0, -1);
        P.body.rotation.x = after > 0 && after < 0.7 ? -0.25 : 0.1;
        const swing = fight ? Math.sin((after - DUEL) * 14 + i * 1.3) : 0;
        P.r.g.rotation.x = fight ? -1.6 - 0.7 * swing : after > 0 ? -1.9 : -1.4;
        P.l.g.rotation.x = fight ? -0.9 : after > 0 ? -1.6 : -1.4;
        stride(P, back * 4 + i, after > 0 && after < 0.7 ? 0.5 : 0, { arms: false });
        P.gz = gz;
      });
      foes.forEach((P, i) => {
        // in through the gate to their guard, then they trade blows a step apart
        const run = Math.max(0, after - P.lag);
        const stop = guards[i].gz - 1.25;
        const z = Math.min(stop, -6 + run * 7.5);
        put(F, P, P.x, z, 0, 1);
        P.root.visible = run > 0;
        const arrived = z >= stop;
        stride(P, z * 3 + i, arrived ? 0 : 0.9, { arms: false });
        const swing = fight && arrived ? Math.sin((after - DUEL) * 14 + i * 1.3 + Math.PI) : 0;
        P.r.g.rotation.x = arrived ? -1.7 - 0.8 * swing : -1.4;
        P.l.g.rotation.x = arrived ? -0.6 : -0.4;
      });
      let cx = 0, cz = 0;
      wave.forEach((P, i) => {
        // single file through the middle of the gate, fanning out only once past the guards
        const run = Math.max(0, after - P.lag);
        const z = -6 + run * 7.5;
        const x = P.x + P.spread * Math.max(0, z - 5.5) * 0.45;
        put(F, P, x, z, P.spread * Math.max(0, Math.min(1, z - 5.5)) * 0.4, 1);
        P.root.visible = run > 0;
        stride(P, z * 3 + i, 0.9, { arms: false });
        P.r.g.rotation.x = P.flame ? -2.3 : -1.4 - 0.8 * Math.abs(Math.sin(t * 6 + i));
        if (P.flame) flicker(P.flame, t, i);
        cx += P.root.position.x; cz += P.root.position.z;
      });
      light.position.set(cx / wave.length, 3, Math.max(-2, cz / wave.length));
      const d = dustGeo.attributes.position.array;
      for (let i = 0; i < 80; i++) {
        const r = (q) => rand01(seed, 'raiddust', i, q);
        if (after <= 0 || after > 1.6) { d[i * 3] = d[i * 3 + 1] = d[i * 3 + 2] = 1e4; continue; }
        d[i * 3] = (r(0) - 0.5) * 9 * (1 + after);
        d[i * 3 + 1] = 0.3 + r(1) * 4 + after * 1.2;
        d[i * 3 + 2] = 0.5 + r(2) * 3 * after;
      }
      dustGeo.attributes.position.needsUpdate = true;
    },
  };
}

/** 18-24 s: the named villager's house burns, their name on the door; the neighbours throw buckets onto it. */
function houseShot({ story, M, houses, animated, seed }) {
  const roofs = [animated?.get(story.houses[0])?.group].filter(Boolean);
  const st = buildFire({ story: { house: story.houses[0], raging: true, door: story.owner, cast: [], chain: story.chain || [] }, M, houses, seed, roofs });
  const h = st && houseStage(houses, story.houses[0]);
  if (!h) return st;
  const { W, D, wallH } = h;
  // (the street is narrow: from high over it, along the front, the roof and the door with its name both in the frame)
  return { ...st, quietTown: true, cam: (u) => ({ pos: h.toWorld(W / 2 + 9 - 1.5 * u, wallH + 8 - 1.2 * u, -D / 2 - 6), look: h.toWorld(-0.5, wallH * 0.55, -D / 2 - 0.5) }) };
}

/** 24-30 s: smoke and silence over the burnt roofs, then back to the first shot's view (the video loops). */
function smokeShot({ story, M, houses, seed }) {
  const a = houseStage(houses, story.houses[1] ?? story.houses[0]);
  if (!a) return null;
  const group = new THREE.Group();
  group.visible = false;
  // embers drifting up
  const N = 120;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const embers = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffb35a', size: 0.35, map: softDot(), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
  embers.frustumCulled = false;
  group.add(embers);
  nightLights(group, 0.6);
  const { W, D, wallH } = a;
  const centre = a.toWorld(0, wallH, 0);
  const start = { look: a.toWorld(-2, wallH, 4) };
  const end = { pos: a.toWorld(W / 2 + 7, wallH + 1.6, -D / 2 - 12), look: a.toWorld(-1, wallH - 0.6, 1) }; // the arrow shot's first frame
  return {
    group,
    labels: [],
    banner: null,
    phase: NIGHT,
    quietTown: true,
    focus: centre,
    cam(u) {
      const k = ease(clamp01((u - 0.62) / 0.38));
      const drift = a.toWorld(W / 2 + 26 - 6 * u, wallH + 22 - 3 * u, -D / 2 - 30 + 5 * u);
      return { pos: drift.lerp(end.pos, k), look: start.look.clone().lerp(end.look, k) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      if (!group.visible) return;
      const p = geo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        const r = (q) => rand01(seed, 'raidember', i, q);
        const age = (t * 0.3 + r(0)) % 1;
        p[i * 3] = centre.x + (r(1) - 0.5) * 30 + Math.sin(t + i) * 0.6;
        p[i * 3 + 1] = centre.y + age * 22;
        p[i * 3 + 2] = centre.z + (r(2) - 0.5) * 30;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ------------------------------------------------------------------------------------------------ day 2

/** 0-5 s: the morning after: the named carpenters and masons at work on the burnt house. */
function repairShot({ story, M, houses, seed }) {
  const st = buildRebuild({ story: { house: story.houses[0], cast: story.crew || [] }, M, houses, seed });
  if (!st) return null;
  return { ...st, banner: 'The morning after', phase: MORNING };
}

/**
 * Where the bandits camp (owner 2026-10-30: far from any house, deep in the woods or in a clearing): in the gate's frame,
 * out beyond the woods, at least 80 m from every plot, on dry ground, no tree of the land within 13 m, the way the
 * guards come in (from +z) and the ways the bandits run off (to -z) clear. The nearest such spot to the road out; else
 * the edge of the woods as before.
 */
function campSite(F, w, obs) {
  const dry = (x, z) => { const p = F.toWorld(x, 0, z); return heightAt(w, p.x, p.z) > WATER_LEVEL + 0.6; };
  let best = null;
  for (let z = -100; z >= -230; z -= 8) for (let x = -90; x <= 90; x += 10) {
    if (obs.some(([ox, oz, , plot]) => plot && Math.hypot(ox - x, oz - z) < 80)) continue;
    if (obs.some(([ox, oz, or, plot]) => !plot && Math.hypot(ox - x, oz - z) < 13 + or)) continue;
    if (![[0, 0], [0, 20], [0, 36], [8, 0], [-8, 0], [0, -20]].every(([dx, dz]) => dry(x + dx, z + dz))) continue;
    if (obs.some(([ox, oz, or]) => oz > z + 2 - or && oz < z + 38 + or && Math.abs(ox - x) < 7 + or)) continue; // the guards' way in
    const lanes = clearLanes(obs, z - 40, z - 1, 9, 1.1, 0.8, x);
    if (lanes.length < 6) continue;
    const score = -z + 0.6 * Math.abs(x);
    if (!best || score < best.score) best = { x, z, lanes, score };
  }
  return best;
}

/** A clearing in the woods round C: trees from 15 to 55 m out, none on the guards' way in nor on the bandits' ways out. */
function clearing(F, M, seed, C, lanes) {
  const g = new THREE.Group();
  const leaves = new THREE.MeshStandardMaterial({ color: '#1f3322', roughness: 0.95 });
  const cone = new THREE.ConeGeometry(2.6, 9, 8).translate(0, 6.5, 0), trunk = cylGeo(0.3, 0.4, 2.4, 6).translate(0, 1.2, 0);
  for (let i = 0; i < 200; i++) {
    const r = (q) => rand01(seed, 'raidclearing', i, q);
    const a = r(0) * Math.PI * 2, d = 15 + r(1) * 40;
    const x = C.x + Math.cos(a) * d, z = C.z + Math.sin(a) * d;
    if (z > C.z + 6 && Math.abs(x - C.x) < 11) continue;
    if (z < C.z && lanes.some((l) => Math.abs(l - x) < 1.2)) continue;
    const s = 1.1 + r(2) * 0.8;
    for (const [geo, mat] of [[cone, leaves], [trunk, M.woodDark]]) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, F.ground(x, z) - 0.2, z);
      m.scale.setScalar(s);
      m.castShadow = true;
      g.add(m);
    }
  }
  return g;
}

/**
 * 5-12 s: the bandits' camp in a clearing deep in the woods; five named guards charge, two of them shoot arrows at the
 * ground behind the bandits as they run off (nobody hurt), the missing villager is untied.
 */
function chaseShot({ story, w, state, M, seed, yFn, nature }) {
  const F = gateFrame(w, story, yFn);
  const { group } = F;
  const obs = obstacles(F, state, nature, 120, -260);
  const site = campSite(F, w, obs);
  const C = new THREE.Vector3(site?.x ?? 0, 0, site?.z ?? WOODS + 2);
  const lanes = site?.lanes ?? clearLanes(obs, C.z - 40, C.z - 1, 9, 1.1, 0.8, C.x);
  group.add(site ? clearing(F, M, seed, C, lanes) : treeLine(F, M, seed, WOODS - 4, lanes));
  const add = (geo, mat, x, z, dy = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, F.ground(x, z) + dy, z); m.castShadow = true; group.add(m); return m; };
  const canvas = new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.95 });
  add(new THREE.ConeGeometry(2.2, 2.6, 4).translate(0, 1.3, 0), canvas, C.x - 6, C.z - 3);
  add(new THREE.ConeGeometry(2.0, 2.4, 4).translate(0, 1.2, 0), canvas, C.x + 6.5, C.z - 4);
  add(cylGeo(0.7, 0.8, 0.15, 10), M.stoneDark, C.x + 2.5, C.z + 2, 0.07);
  const fire = add(new THREE.ConeGeometry(0.45, 1.0, 8).translate(0, 0.5, 0), flameMaterial('#ff8a2a'), C.x + 2.5, C.z + 2, 0.1);
  add(cylGeo(0.12, 0.14, 2.2, 6).translate(0, 1.1, 0), M.woodDark, C.x, C.z); // the post the captive is tied to
  const captive = person(M, story.missing ? JOBS[story.missing.job]?.color || '#8a6d4f' : '#8a6d4f');
  put(F, captive, C.x, C.z + 0.45, 0, 1);
  group.add(captive.root);
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 6, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b59a62', roughness: 0.9 }));
  rope.position.set(C.x, F.ground(C.x, C.z) + 1.0, C.z + 0.2);
  group.add(rope);
  // the bandits: each runs straight off down a lane clear of the trees
  const crew = Array.from({ length: 10 }, (_, i) => {
    const P = bandit(M, i, i % 3 === 0 ? 'sack' : 'club');
    const r = (q) => rand01(seed, 'raidcamp', i, q);
    P.x = lanes.length ? lanes[(i * 3) % lanes.length] : C.x + (r(0) - 0.5) * 18;
    P.z = C.z - 1.5 - r(1) * 5; P.lag = r(2) * 0.08;
    group.add(P.root);
    return P;
  });
  const flee = (P, u) => { const k = clamp01((u - 0.22 - P.lag) / 0.5); return { k, z: P.z - 34 * k }; };
  // the five named guards: the first runs to the captive, two charge with spears, two stop and shoot
  const ARCHERS = new Set([3, 4]);
  const guards = Array.from({ length: 5 }, (_, i) => {
    const c = story.guards?.[i] || null;
    const P = ARCHERS.has(i) ? person(M, c ? JOBS[c.job]?.color || GUARD : GUARD) : guardRig(M, c, i === 0);
    if (ARCHERS.has(i)) P.l.hand.add(bowGeo(M));
    P.c = c;
    P.x = C.x + [0.6, -2.2, 2.6, -4.4, 4.8][i];
    group.add(P.root);
    return P;
  });
  // the arrows: loosed at set times (fractions of the shot) at the ground just behind a running bandit
  const FLY = 0.5, shots = [];
  for (const i of ARCHERS) for (let j = 0; j < 3; j++) {
    const a = arrowGeo(M);
    a.visible = false;
    group.add(a);
    shots.push({ a, guard: guards[i], at: 0.34 + j * 0.1 + (i === 4 ? 0.05 : 0), target: crew[(i * 3 + j * 4) % crew.length] });
  }
  nightLights(group, 0.5);
  const labels = [...guards.filter((P) => P.c).map((P) => ({ P, ...castTag(P.c) })), ...(story.missing ? [{ P: captive, ...castTag(story.missing, 'Free!') }] : [])];
  const tmp = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3(), fwd = new THREE.Vector3(0, 0, 1);
  const FREE = 0.6;
  return {
    group,
    labels,
    banner: 'The rescue',
    phase: MORNING + 0.05,
    focus: F.toWorld(C.x, 1.5, C.z),
    work: { strikeTimes: () => [], sound: null, hits: (t0, t1) => shots.map((s) => [t0 + s.at * (t1 - t0) + FLY, 'chop']) },
    cam(u) {
      return { pos: F.toWorld(C.x + 7.5 - 2 * u, 3.4, C.z + 28 - 12 * ease(u)), look: F.toWorld(C.x, 1.3, C.z + 2) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0);
      flicker(fire, t, 0);
      guards.forEach((P, i) => {
        const archer = ARCHERS.has(i);
        const k = clamp01(u / (archer ? 0.3 : 0.5));
        const z = archer ? C.z + 34 - 18 * ease(k) : C.z + 34 - 34 * ease(k) + (i === 0 ? 0 : 1.2 + (i % 2) * 0.8);
        const x = i === 0 ? C.x + 0.9 * k : P.x;
        put(F, P, x, z, 0, -1);
        stride(P, z * 3 + i, k < 1 ? 0.9 : 0, { arms: false });
        const cheer = u > FREE + 0.08 && !(archer && u < 0.72);
        if (archer && !cheer && k >= 1) {
          // bow arm out toward the woods, the string drawn back before each arrow
          const next = shots.find((s) => s.guard === P && s.at > u - 0.02);
          const draw = next ? clamp01(1 - (next.at - u) * 12) : 0;
          P.l.g.rotation.set(-1.5, 0, 0.05);
          P.r.g.rotation.set(-1.5 + 0.2 * draw, 0, -0.3 - 0.4 * draw);
          return;
        }
        P.r.g.rotation.x = cheer ? -2.8 + 0.2 * Math.sin(t * 9 + i) : k < 1 ? -1.4 : -0.9;
        P.l.g.rotation.x = cheer ? -2.5 : 0.4 * Math.sin(z * 3);
      });
      crew.forEach((P, i) => {
        // they jump up when the guards come and run off into the trees
        const { k, z } = flee(P, u);
        put(F, P, P.x, z, 0, k > 0 ? -1 : 1);
        stride(P, z * 3 + i, k > 0 ? 0.95 : 0, { arms: false });
        P.r.g.rotation.x = k > 0 ? -2.7 : -0.5;
        P.l.g.rotation.x = k > 0 ? -2.5 : -0.3;
        P.root.visible = k < 0.98;
      });
      for (const s of shots) {
        const k = ((u - s.at) * (t1 - t0)) / FLY;
        s.a.visible = k >= 0;
        if (!s.a.visible) continue;
        const g = s.guard.root.position;
        from.set(g.x, g.y + 1.5, g.z - 0.5);
        // where it lands: the ground 1.5 m behind where its bandit is when it comes down
        const { z } = flee(s.target, s.at + FLY / (t1 - t0));
        to.set(s.target.x, 0, z + 1.5);
        to.y = F.ground(to.x, to.z) + 0.35;
        const kk = Math.min(1, k);
        s.a.position.lerpVectors(from, to, kk);
        s.a.position.y += Math.sin(Math.PI * kk) * 2.5;
        s.a.quaternion.setFromUnitVectors(fwd, tmp.copy(to).sub(from).normalize());
      }
      const free = u > FREE;
      rope.visible = !free;
      captive.r.g.rotation.x = free ? -2.8 + 0.2 * Math.sin(t * 8) : 0.3;
      captive.l.g.rotation.x = free ? -2.6 : 0.3;
      captive.r.g.rotation.z = free ? 0 : 0.4;
      captive.l.g.rotation.z = free ? 0 : -0.4;
      captive.root.position.y = F.ground(C.x, C.z + 0.45) + (free ? 0.05 * Math.abs(Math.sin(t * 7)) : 0);
      for (const lb of labels) lb.pos.copy(tmp.copy(lb.P.root.position).setY(lb.P.root.position.y + 2.3)).applyMatrix4(group.matrix);
    },
  };
}

/** 12-19 s: through the gate the guards bring the freed villager home; named villagers line the street and cheer. */
function returnShot({ story, w, M, seed, yFn }) {
  const F = gateFrame(w, story, yFn);
  const { group } = F;
  const gate = doors(M);
  gate.set(1, 0, 0);
  group.add(gate.group);
  const walkers = [...(story.guards || []).slice(0, 5)];
  const party = Array.from({ length: Math.max(5, walkers.length) + 1 }, (_, i) => {
    const freed = i === 0;
    const c = freed ? story.missing : walkers[i - 1] || null;
    const P = freed ? person(M, c ? JOBS[c.job]?.color || '#8a6d4f' : '#8a6d4f') : guardRig(M, c);
    P.c = c; P.freed = freed;
    P.x = freed ? 0 : [-1.6, 1.6, -2.4, 2.4, 0][(i - 1) % 5];
    P.dz = freed ? 0 : [-0.8, -0.8, -2.4, -2.4, -3.4][(i - 1) % 5];
    group.add(P.root);
    return P;
  });
  const crowd = Array.from({ length: Math.max(12, (story.crowd || []).length + 4) }, (_, i) => {
    const c = story.crowd?.[i] || null;
    const P = person(M, c ? JOBS[c.job]?.color || FOLK[i % 6] : FOLK[i % 6]);
    P.c = c;
    const side = i % 2 ? 1 : -1;
    P.x = side * (4.6 + (Math.floor(i / 2) % 2) * 0.9);
    P.z = 7 + Math.floor(i / 2) * 1.6;
    put(F, P, P.x, P.z, -side, 0);
    P.ph = rand01(seed, 'raidclap', i) * 6;
    group.add(P.root);
    return P;
  });
  nightLights(group, 0.4);
  const labels = [...party.filter((P) => P.c).map((P) => ({ P, ...castTag(P.c, P.freed ? 'Home again' : undefined) })), ...crowd.filter((P) => P.c).map((P) => ({ P, ...castTag(P.c) }))];
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    banner: 'Welcome home!',
    phase: MORNING,
    focus: F.toWorld(0, 1.6, 6),
    cam(u) {
      return { pos: F.toWorld(1.2 - 0.6 * u, 2.9, 27 - 2 * u), look: F.toWorld(0, 1.5, 6) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0);
      const head = -10 + 22 * ease(Math.min(1, u / 0.85));
      party.forEach((P, i) => {
        const z = head + P.dz;
        put(F, P, P.x, z, 0, 1);
        stride(P, z * 3 + i, u < 0.85 ? 0.6 : 0, { arms: !P.freed });
        if (P.freed) { P.r.g.rotation.x = -2.7 + 0.25 * Math.sin(t * 7); P.l.g.rotation.x = -2.5 + 0.25 * Math.cos(t * 7); }
      });
      crowd.forEach((P) => {
        // clapping, and now and then an arm up
        const c = Math.sin(t * 11 + P.ph);
        P.r.g.rotation.set(-1.3, 0, -0.35 - 0.25 * c);
        P.l.g.rotation.set(-1.3, 0, 0.35 + 0.25 * c);
        if (Math.sin(t * 1.7 + P.ph) > 0.8) P.r.g.rotation.set(-2.9, 0, 0);
      });
      for (const lb of labels) lb.pos.copy(tmp.copy(lb.P.root.position).setY(lb.P.root.position.y + 2.3)).applyMatrix4(group.matrix);
    },
  };
}

/** 19-23.5 s: the crier announces that the bandits have fled; named villagers cheer. */
function crierShot({ story, M, buildings, seed }) {
  const st = buildProclaim({ story: { crier: story.crier, cast: [...(story.crier ? [story.crier] : []), ...(story.crowd || []).slice(0, 5)] }, M, buildings, seed });
  if (!st) return null;
  return { ...st, banner: 'The bandits are gone!', phase: MORNING };
}

export const RAID_SHOTS = {
  attack: [['arrow', 0, 2, arrowShot], ['woods', 2, 6, woodsShot], ['guard', 6, 11, guardShot], ['fight', 11, 15, fightShot], ['breach', 15, 18, breachShot],
    ['house', 18, 24, houseShot], ['smoke', 24, 30, smokeShot]],
  rescue: [['repair', 0, 5, repairShot], ['chase', 5, 12, chaseShot], ['return', 12, 19, returnShot], ['crier', 19, 23.5, crierShot]],
};

/** The scene of one shot of the raid (args.story.shot). */
export function buildRaid(args) {
  const { step, shot } = args.story;
  const f = RAID_SHOTS[step]?.find((s) => s[0] === shot)?.[3];
  if (!f) return null;
  const st = f(args);
  if (st && st.phase === undefined) st.phase = step === 'attack' ? NIGHT : MORNING;
  return st;
}
