// Villager houses: instanced, chunked with a simplified far LOD, seeded variation,
// abandoned / ruin states, and individually animated houses for today's construction.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from '../../sim/world.js';
import { houseStyle } from '../../sim/simulate.js';
import { hash, rand01 } from '../../sim/prng.js';
import { gableGeo, boxGeo, cylGeo } from './kit.js';

const ROOF_COLORS = ['#a24b31', '#7d3b2a', '#5b6474', '#8a5a3a', '#6c4a3e', '#c9a86a'].map((c) => new THREE.Color(c));
const WALL_COLORS = ['#efe6d2', '#e6cf9f', '#e9d4c8', '#f4f1e8', '#d9d4c6'].map((c) => new THREE.Color(c));
const FLOOR_H = 3.2;

function unitBox(floors) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * floors);
  g.translate(0, 0.5, 0);
  return g;
}

/** Geometric description of a house, shared by instanced and animated builds. */
export function houseShape(seed, house, plot, w) {
  const st = houseStyle(seed, plot.id);
  const floors = house.capacity >= 8 ? 3 : house.capacity >= 4 ? 2 : 1;
  const tall = house.capacity === 2;
  const width = Math.min(2 * plot.hw - 2.2, house.capacity >= 4 ? 10 : 8.2) * st.scale;
  const depth = Math.min(2 * plot.hd - 5, house.capacity >= 4 ? 8 : 6.8) * st.scale;
  const side = plot.facing || 1;
  const lz = -side * (plot.hd - depth / 2 - 1.2); // front of the house on the street
  const c = Math.cos(plot.rot), s = Math.sin(plot.rot);
  const nx = -s, nz = c;
  const hx = plot.x + nx * lz, hz = plot.z + nz * lz;
  let hmin = Infinity, hmax = -Infinity;
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
    const px = hx + c * u * width / 2 + nx * v * depth / 2, pz = hz + s * u * width / 2 + nz * v * depth / 2;
    const h = heightAt(w, px, pz);
    hmin = Math.min(hmin, h); hmax = Math.max(hmax, h);
  }
  const base = hmax + 0.3;
  const bodyH = floors * FLOOR_H + (tall ? 0.6 : 0.3);
  const roofH = depth * (tall ? 0.78 : 0.55);
  const flip = (hash(seed, 'flip', plot.id) & 3) === 0 && house.capacity < 4; // gable facing the street
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(hx, base, hz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -plot.rot, 0)), new THREE.Vector3(1, 1, 1));
  return { st, floors, tall, width, depth, side, base, hmin, bodyH, roofH, flip, matrix, x: hx, z: hz, rot: plot.rot, plot };
}

class Batch {
  constructor() { this.items = new Map(); }
  push(key, m, color) {
    if (!this.items.has(key)) this.items.set(key, { mats: [], colors: [] });
    const it = this.items.get(key);
    it.mats.push(m.clone());
    it.colors.push(color ? color.clone() : null);
  }
  build(defs, group) {
    for (const [key, { mats, colors }] of this.items) {
      const { geo, mat, shadow = true } = defs[key];
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      if (colors[0]) colors.forEach((c, i) => im.setColorAt(i, c));
      im.castShadow = shadow; im.receiveShadow = true;
      im.computeBoundingSphere();
      im.name = key;
      group.add(im);
    }
  }
}

const tmp = new THREE.Matrix4();
const part = (shape, x, y, z, sx, sy, sz, ry = 0) =>
  shape.matrix.clone().multiply(tmp.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz)));

export function buildHouses(state, w, M, { animatedIds = new Set(), chunk = 260 } = {}) {
  const seed = state.seed;
  const plots = new Map(state.plots.map((p) => [p.id, p]));
  const defs = {
    plinth: { geo: boxGeo(1, 1, 1, 0.5).translate(0, -0.5, 0), mat: M.stoneDark },
    body1t: { geo: unitBox(1), mat: M.timber }, body2t: { geo: unitBox(2), mat: M.timber }, body3t: { geo: unitBox(3), mat: M.timber },
    body1p: { geo: unitBox(1), mat: M.plaster }, body2p: { geo: unitBox(2), mat: M.plaster }, body3p: { geo: unitBox(3), mat: M.plaster },
    roof: { geo: gableGeo(1, 1, 1, 0.12), mat: M.roofTile },
    thatch: { geo: gableGeo(1, 1, 1, 0.2), mat: M.thatch },
    broken: { geo: brokenRoofGeo(), mat: M.woodDark },
    chimney: { geo: boxGeo(1, 1, 1, 1).translate(0, 0.5, 0), mat: M.stone },
    door: { geo: boxGeo(1, 1, 1, 1).translate(0, 0.5, 0), mat: M.woodDark },
    win: { geo: new THREE.BoxGeometry(1, 1, 1), mat: M.window, shadow: false },
    winDark: { geo: new THREE.BoxGeometry(1, 1, 1), mat: M.iron, shadow: false },
    fence: { geo: fenceGeo(), mat: M.wood },
    bush: { geo: new THREE.IcosahedronGeometry(1, 1), mat: M.foliage },
    ruin: { geo: ruinGeo(), mat: M.rubble },
    rubble: { geo: new THREE.DodecahedronGeometry(1, 0), mat: M.rubble },
    far: { geo: farGeo(), mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }) },
  };
  const chunks = new Map();
  const getChunk = (x, z) => {
    const key = `${Math.floor(x / chunk)},${Math.floor(z / chunk)}`;
    if (!chunks.has(key)) chunks.set(key, { near: new Batch(), far: new Batch(), cx: (Math.floor(x / chunk) + 0.5) * chunk, cz: (Math.floor(z / chunk) + 0.5) * chunk });
    return chunks.get(key);
  };
  const chimneys = [];
  const shapes = new Map();

  for (const h of state.houses) {
    const plot = plots.get(h.plot);
    const sh = houseShape(seed, h, plot, w);
    shapes.set(h.id, sh);
    if (animatedIds.has(h.id)) continue;
    const ch = getChunk(sh.x, sh.z);
    addHouseParts(ch.near, sh, h, seed, chimneys);
    // far LOD: one tinted box+roof
    const wall = WALL_COLORS[sh.st.wall].clone();
    if (h.status !== 'occupied') wall.multiplyScalar(h.status === 'ruin' ? 0.45 : 0.6);
    const far = part(sh, 0, -0.2, 0, sh.width, h.status === 'ruin' ? 1.5 : sh.bodyH + sh.roofH * 0.6, sh.depth);
    ch.far.push('far', far, h.status === 'ruin' ? new THREE.Color('#77736a') : ROOF_COLORS[sh.st.roof].clone().lerp(wall, 0.35));
  }

  const group = new THREE.Group();
  const chunkList = [];
  for (const ch of chunks.values()) {
    const near = new THREE.Group(), far = new THREE.Group();
    ch.near.build(defs, near);
    ch.far.build(defs, far);
    far.traverse((o) => { o.castShadow = false; });
    group.add(near, far);
    chunkList.push({ near, far, cx: ch.cx, cz: ch.cz });
  }
  return {
    group, chimneys, shapes, defs,
    updateLod(camera, nearDist = 520) {
      for (const c of chunkList) {
        const d = Math.hypot(camera.position.x - c.cx, camera.position.z - c.cz);
        c.near.visible = d < nearDist;
        c.far.visible = !c.near.visible;
      }
    },
  };
}

function addHouseParts(batch, sh, h, seed, chimneys) {
  const { width: W, depth: D, bodyH, roofH, floors, st, side } = sh;
  const front = -side * D / 2; // local z of the street-facing wall
  const status = h.status;
  const dim = status === 'abandoned' ? 0.55 : 1;
  batch.push('plinth', part(sh, 0, 0, 0, W + 0.5, sh.base - sh.hmin + 0.6, D + 0.5));
  if (status === 'ruin') {
    batch.push('ruin', part(sh, 0, 0, 0, W, 1, D), new THREE.Color('#a7a294'));
    for (let i = 0; i < 5; i++) {
      const r = (k) => rand01(seed, 'rubble', h.plot, i, k);
      batch.push('rubble', part(sh, (r(0) - 0.5) * W * 1.2, 0.2, (r(1) - 0.5) * D * 1.2, 0.5 + r(2) * 0.6, 0.35 + r(3) * 0.4, 0.5 + r(4) * 0.6, r(5) * 6), null);
    }
    return;
  }
  const wall = WALL_COLORS[st.wall].clone().multiplyScalar(dim);
  batch.push(`body${floors}${st.timber ? 't' : 'p'}`, part(sh, 0, 0, 0, W, bodyH, D), wall);
  const ry = sh.flip ? Math.PI / 2 : 0;
  const rw = (sh.flip ? D : W) + 0.9, rd = (sh.flip ? W : D) + 1.0;
  if (status === 'abandoned') {
    batch.push('broken', part(sh, 0, bodyH, 0, rw, roofH, rd, ry), null);
  } else if (st.roof === 5) {
    batch.push('thatch', part(sh, 0, bodyH, 0, rw, roofH * 1.15, rd, ry), new THREE.Color('#ffffff'));
  } else {
    batch.push('roof', part(sh, 0, bodyH, 0, rw, roofH, rd, ry), ROOF_COLORS[st.roof]);
  }
  if (st.chimney) {
    const cx = W * 0.28 * (hash(seed, 'ch', h.plot) & 1 ? 1 : -1), cz = D * 0.12;
    const ch = roofH + 1.4;
    batch.push('chimney', part(sh, cx, bodyH - 0.5, cz, 0.9, ch, 0.9), new THREE.Color(dim, dim, dim));
    if (status === 'occupied') chimneys.push(new THREE.Vector3(cx, bodyH - 0.5 + ch + 0.2, cz).applyMatrix4(sh.matrix));
  }
  // door + windows on the street side
  batch.push('door', part(sh, W * 0.18, 0, front - side * 0.06, 1.2, 2.3, 0.25), null);
  const winKey = status === 'abandoned' ? 'winDark' : 'win';
  for (let f = 0; f < floors; f++) {
    const y = 1.6 + f * FLOOR_H;
    for (const u of f === 0 ? [-0.25] : [-0.28, 0.12, 0.33]) {
      batch.push(rand01(seed, 'lit', h.plot, f, u) < 0.25 ? 'winDark' : winKey, part(sh, u * W, y - 0.55, front - side * 0.06, 1.0, 1.2, 0.15), null);
    }
    batch.push(winKey, part(sh, 0, y - 0.55, -front + side * 0.06, 1.0, 1.2, 0.15), null);
    batch.push(winKey, part(sh, -W / 2 - 0.06, y - 0.55, 0, 0.15, 1.2, 1.0), null);
  }
  if (sh.tall) batch.push(winKey, part(sh, 0, bodyH + roofH * 0.25, front * 0.55 - side * 0.4, 1.0, 1.0, 0.15), null);
  // back garden: fence on three sides and a few bushes
  const gardenDepth = 2 * sh.plot.hd - D - 2.4;
  if ((st.fence || st.garden) && gardenDepth > 2.2 && status === 'occupied') {
    const gz0 = -front, gz1 = -front + side * gardenDepth;
    const gzc = (gz0 + gz1) / 2;
    const gw = Math.min(W + 2, 2 * sh.plot.hw - 0.6);
    batch.push('fence', part(sh, 0, 0, gz1, gw, 1, 1), null);
    batch.push('fence', part(sh, -gw / 2, 0, gzc, gardenDepth, 1, 1, Math.PI / 2), null);
    batch.push('fence', part(sh, gw / 2, 0, gzc, gardenDepth, 1, 1, Math.PI / 2), null);
    for (let i = 0; i < 3; i++) {
      const r = (k) => rand01(seed, 'bush', h.plot, i, k);
      const s = 0.5 + r(2) * 0.6;
      batch.push('bush', part(sh, (r(0) - 0.5) * (gw - 1.5), s * 0.7, gzc + (r(1) - 0.5) * (gardenDepth - 1), s, s * 0.85, s), new THREE.Color().setHSL(0.24 + r(3) * 0.08, 0.45, 0.24 + r(4) * 0.1));
    }
  }
}

function brokenRoofGeo() {
  // rafters with half the covering gone
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const x = -0.45 + i * 0.18;
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(0.04, 0.04, 0.62);
      g.rotateX(s * Math.atan2(1, 0.5));
      g.translate(x, 0.5, s * 0.25);
      parts.push(g);
    }
  }
  const half = gableGeo(1, 1, 1, 0.12);
  // keep only the first slope (6 vertices) and lower it slightly
  const pos = half.attributes.position.array.slice(0, 18);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(half.attributes.uv.array.slice(0, 12), 2));
  g.scale(0.6, 0.95, 1); g.translate(-0.2, 0, 0);
  g.computeVertexNormals();
  parts.push(g);
  return mergeGeometries(parts.map((p) => { const q = p.index ? p.toNonIndexed() : p; for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2)); if (!q.attributes.normal) q.computeVertexNormals(); return q; }));
}

function ruinGeo() {
  const parts = [];
  const heights = [1.6, 0.9, 1.3, 0.5, 1.1, 0.7, 1.5, 0.4];
  let k = 0;
  for (const [x0, z0, x1, z1] of [[-0.5, -0.5, 0.5, -0.5], [0.5, -0.5, 0.5, 0.5], [0.5, 0.5, -0.5, 0.5], [-0.5, 0.5, -0.5, -0.5]]) {
    for (let i = 0; i < 2; i++) {
      const h = heights[k++ % heights.length];
      const ax = x0 + (x1 - x0) * i / 2, az = z0 + (z1 - z0) * i / 2, bx = x0 + (x1 - x0) * (i + 1) / 2, bz = z0 + (z1 - z0) * (i + 1) / 2;
      const len = Math.hypot(bx - ax, bz - az);
      const g = new THREE.BoxGeometry(Math.abs(bx - ax) > 0 ? len : 0.07, h, Math.abs(bz - az) > 0 ? len : 0.07);
      g.translate((ax + bx) / 2, h / 2, (az + bz) / 2);
      parts.push(g.toNonIndexed());
    }
  }
  return mergeGeometries(parts);
}

function fenceGeo() {
  const parts = [];
  for (const y of [0.45, 0.85]) parts.push(new THREE.BoxGeometry(1, 0.08, 0.06).translate(0, y, 0).toNonIndexed());
  for (const x of [-0.5, 0, 0.5]) parts.push(new THREE.BoxGeometry(0.1, 1.05, 0.1).translate(x, 0.52, 0).toNonIndexed());
  return mergeGeometries(parts);
}

function farGeo() {
  const body = new THREE.BoxGeometry(1, 0.62, 1).translate(0, 0.31, 0).toNonIndexed();
  const roof = gableGeo(1.08, 1.1, 0.38).translate(0, 0.62, 0);
  const g = mergeGeometries([body, roof].map((p) => { for (const k of Object.keys(p.attributes)) if (!['position', 'normal'].includes(k)) p.deleteAttribute(k); return p; }));
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) {
    const roofPart = i >= body.attributes.position.count;
    col.set(roofPart ? [1, 1, 1] : [1.25, 1.2, 1.1], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** A single house as a group of meshes whose construction progress p (0..1) can be animated. */
export function buildAnimatedHouse(sh, h, seed, M, defs) {
  const g = new THREE.Group();
  g.matrixAutoUpdate = false;
  g.matrix.copy(sh.matrix);
  const { width: W, depth: D, bodyH, roofH, floors, st, side } = sh;
  const plinth = new THREE.Mesh(defs.plinth.geo, M.stoneDark);
  plinth.scale.set(W + 0.5, sh.base - sh.hmin + 0.6, D + 0.5);
  const body = new THREE.Mesh(defs[`body${floors}${st.timber ? 't' : 'p'}`].geo, (st.timber ? M.timber : M.plaster).clone());
  body.material.color.copy(WALL_COLORS[st.wall]);
  body.scale.set(W, bodyH, D);
  const ry = sh.flip ? Math.PI / 2 : 0;
  const roofMat = st.roof === 5 ? M.thatch : M.roofTile.clone();
  if (st.roof !== 5) roofMat.color.copy(ROOF_COLORS[st.roof]);
  const roof = new THREE.Mesh(defs[st.roof === 5 ? 'thatch' : 'roof'].geo, roofMat);
  roof.rotation.y = ry;
  roof.position.y = bodyH;
  const rs = new THREE.Vector3((sh.flip ? D : W) + 0.9, roofH * (st.roof === 5 ? 1.15 : 1), (sh.flip ? W : D) + 1.0);
  roof.scale.copy(rs);
  const front = -side * D / 2;
  const door = new THREE.Mesh(defs.door.geo, M.woodDark);
  door.position.set(W * 0.18, 0, front - side * 0.06); door.scale.set(1.2, 2.3, 0.25);
  const wins = [];
  for (let f = 0; f < floors; f++) for (const u of f === 0 ? [-0.25] : [-0.28, 0.12, 0.33]) {
    const m = new THREE.Mesh(defs.win.geo, M.window);
    m.position.set(u * W, 1.6 + f * FLOOR_H - 0.55, front - side * 0.06); m.scale.set(1, 1.2, 0.15);
    wins.push(m);
  }
  let chimney = null, chimneyTop = null;
  if (st.chimney) {
    const cx = W * 0.28 * (hash(seed, 'ch', h.plot) & 1 ? 1 : -1), cz = D * 0.12, chh = roofH + 1.4;
    chimney = new THREE.Mesh(defs.chimney.geo, M.stone);
    chimney.position.set(cx, bodyH - 0.5, cz); chimney.scale.set(0.9, chh, 0.9);
    chimneyTop = new THREE.Vector3(cx, bodyH - 0.5 + chh + 0.2, cz).applyMatrix4(sh.matrix);
  }
  // scaffold: poles at the corners and mid-sides, two levels of planks
  const scaffold = new THREE.Group();
  const poleGeo = cylGeo(0.08, 0.08, 1, 6);
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1]]) {
    const p = new THREE.Mesh(poleGeo, M.wood);
    p.position.set(u * (W / 2 + 0.7), (bodyH + 1.5) / 2, v * (D / 2 + 0.7));
    p.scale.set(1, bodyH + 1.5, 1);
    scaffold.add(p);
  }
  for (let l = 1; l <= floors; l++) for (const v of [-1, 1]) {
    const pl = new THREE.Mesh(defs.door.geo, M.wood);
    pl.position.set(0, l * FLOOR_H - 0.6, v * (D / 2 + 0.7)); pl.scale.set(W + 1.6, 0.12, 0.8);
    scaffold.add(pl);
  }
  for (const m of [plinth, body, roof, door, chimney, ...wins, ...scaffold.children].filter(Boolean)) { m.castShadow = true; m.receiveShadow = true; }
  g.add(plinth, body, roof, door, scaffold, ...wins);
  if (chimney) g.add(chimney);
  const top = new THREE.Vector3(0, bodyH + roofH + 1.5, 0).applyMatrix4(sh.matrix);
  return {
    group: g, top, chimneyTop, shape: sh,
    /** p: 0 = bare plot, 0.15 scaffold + plinth, 0.55 walls done, 0.8 roof done, 1 finished */
    set(p) {
      const k = (a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
      plinth.visible = p > 0.02;
      plinth.scale.y = (sh.base - sh.hmin + 0.6) * Math.max(0.01, k(0.02, 0.12));
      scaffold.visible = p > 0.08 && p < 0.97;
      scaffold.scale.y = Math.max(0.01, k(0.08, 0.2));
      body.visible = p > 0.15;
      body.scale.y = bodyH * Math.max(0.01, k(0.15, 0.55));
      roof.visible = p > 0.55;
      roof.scale.set(rs.x, rs.y * Math.max(0.01, k(0.55, 0.8)), rs.z);
      door.visible = wins.every(() => true) && p > 0.5;
      for (const wm of wins) wm.visible = p > 0.55;
      if (chimney) chimney.visible = p > 0.75;
    },
  };
}
