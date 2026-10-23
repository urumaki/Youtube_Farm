// Villager houses: detailed procedural variants (timber-framed, stone, thatched cottage) shared by
// instancing, chunked with a simplified far LOD; woodpiles and barrels beside them (no gardens);
// abandoned and ruin states; individually animated houses for today's construction.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt, DENSE_ID } from '../../sim/world.js';
import { houseStyle, houseFloors } from '../../sim/simulate.js';
import { insideWall2 } from '../../sim/wall.js';
import { hash, rand01 } from '../../sim/prng.js';
import { gableGeo, boxGeo, cylGeo } from './kit.js';
import { buildHouseVariant, propGeos } from './houseKit.js';

const ROOF_COLORS = ['#a24b31', '#8a3f2b', '#6e6f78', '#9a5c3c', '#7a4a3a', '#b0603c', '#c46a3c', '#5d4a40', '#8c5a48'].map((c) => new THREE.Color(c));
// limewash in several earth pigments: cream, ochre, rose, pale grey-blue, buff, white
const WALL_COLORS = ['#efe6d2', '#e2c48c', '#e6c3b4', '#cfd5d6', '#d8c6a4', '#f4f1e8', '#e9d29a', '#dcb9a6', '#c9cfc4'].map((c) => new THREE.Color(c));
const q05 = (v) => Math.round(v * 2) / 2;

/** Which variant a house uses, and where it stands. */
export function houseShape(seed, house, plot, w, { terrace = false } = {}) {
  const st = houseStyle(seed, plot.id);
  const h = hash(seed, 'arch', plot.id);
  const cap = house.cap0 ?? house.capacity; // as built: storeys added later keep the footprint
  // small early houses vary too: some get a second storey, some are stone or thatched cottages
  const built = houseFloors(seed, { plot: house.plot, capacity: cap });
  const floors = houseFloors(seed, house);
  let arch = 'timber';
  if (built === 1 && h % 5 < 2) arch = floors > 1 ? 'timber' : 'cottage'; // a raised cottage is rebuilt timber-framed
  else if (built === 1 && h % 5 === 2) arch = 'stone';
  else if (built >= 2 && h % 7 < 2) arch = 'stone';
  if (plot.fine) arch = 'fine'; // the Noble Quarter's town houses (owner 2026-10-22)
  // terraced rows inside the walls: the house fills its plot's frontage and the gap to the next plot, square to
  // the street, its front on one line with the neighbours' fronts
  const row = terrace && !plot.fine ? streetLine(w, plot) : null;
  const W = plot.fine ? Math.min(q05(2 * plot.hw - 2.5), 12) : row ? Math.min(q05(2 * plot.hw + (plot.id >= DENSE_ID ? 0.4 : 1.1)), 11.5)
    : Math.max(5, Math.min(q05(2 * plot.hw - 1.0), cap >= 4 ? 9 : 8));
  const D = plot.fine ? 10 : Math.max(5, Math.min(q05(Math.min(2 * plot.hd - 6, cap >= 4 ? 8.5 : 7)), 8.5));
  const side = plot.facing || 1;
  const rot = row ? row.rot : plot.rot;
  const c = Math.cos(rot), s = Math.sin(rot);
  const nx = -s, nz = c;
  // front of the house on the street, croft behind
  const lz = row ? -side * (row.dist - row.halfWidth - 0.9 - D / 2) : -side * (plot.hd - D / 2 - (plot.fine ? 2.5 : 1.0));
  const hx = plot.x + nx * lz, hz = plot.z + nz * lz;
  let hmin = Infinity, hmax = -Infinity;
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
    const px = hx + c * u * W / 2 + nx * v * D / 2, pz = hz + s * u * W / 2 + nz * v * D / 2;
    const hh = heightAt(w, px, pz);
    hmin = Math.min(hmin, hh); hmax = Math.max(hmax, hh);
  }
  const base = hmax + 0.15;
  const yaw = -rot + (side < 0 ? Math.PI : 0);
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(hx, base, hz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1));
  return {
    st, arch, floors, W, D, side, base, hmin, matrix, x: hx, z: hz, rot, plot, yaw,
    wallColor: WALL_COLORS[hash(seed, 'wall', plot.id) % WALL_COLORS.length], roofColor: ROOF_COLORS[hash(seed, 'roof', plot.id) % ROOF_COLORS.length],
    chimney: st.chimney || arch === 'stone', dormer: floors >= 2 && h % 4 === 0,
    key: (damaged) => `${arch}|${W}|${D}|${floors}|${st.chimney || arch === 'stone' ? 1 : 0}|${floors >= 2 && h % 4 === 0 ? 1 : 0}|${damaged ? 1 : 0}`,
  };
}

/** The street a plot fronts: its direction there (turned to the plot's own) and how far the plot's centre is from it. */
function streetLine(w, plot) {
  const road = w.allPaths.find((r) => r.id === plot.road);
  if (!road) return null;
  let best = null;
  for (let i = 1; i < road.pts.length; i++) {
    const [ax, az] = road.pts[i - 1], [bx, bz] = road.pts[i];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1e-9;
    const u = Math.max(0, Math.min(1, ((plot.x - ax) * dx + (plot.z - az) * dz) / l2));
    const d = Math.hypot(plot.x - ax - u * dx, plot.z - az - u * dz);
    if (!best || d < best.dist) best = { dist: d, ang: Math.atan2(dz, dx) };
  }
  let rot = best.ang;
  while (rot - plot.rot > Math.PI / 2) rot -= Math.PI;
  while (plot.rot - rot > Math.PI / 2) rot += Math.PI;
  return { rot, dist: best.dist, halfWidth: road.width / 2 };
}

const variantCache = new Map();
function variant(sh, damaged, seed) {
  const key = sh.key(damaged);
  if (!variantCache.has(key)) {
    variantCache.set(key, buildHouseVariant({ arch: sh.arch, W: sh.W, D: sh.D, floors: sh.floors, chimney: sh.chimney, dormer: sh.dormer, damaged, seed }));
  }
  return variantCache.get(key);
}

class Batch {
  constructor() { this.items = new Map(); }
  push(key, def, m, color) {
    if (!this.items.has(key)) this.items.set(key, { def, mats: [], colors: [] });
    const it = this.items.get(key);
    it.mats.push(m.clone());
    it.colors.push(color ? color.clone() : null);
  }
  build(group) {
    for (const { def, mats, colors } of this.items.values()) {
      const im = new THREE.InstancedMesh(def.geo, def.mat, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      if (colors.some(Boolean)) colors.forEach((c, i) => im.setColorAt(i, c || new THREE.Color(1, 1, 1)));
      im.castShadow = def.shadow !== false; im.receiveShadow = true;
      im.computeBoundingSphere();
      group.add(im);
    }
  }
}

const tmp = new THREE.Matrix4();
const local = (sh, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) =>
  sh.matrix.clone().multiply(tmp.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz)));

export function houseMaterials(M) {
  return {
    stone: M.stone, stoneDark: M.stoneDark, plaster: M.plasterTint, woodDark: M.woodDark, wood: M.wood, roofTile: M.roofTile,
    thatch: M.thatch, slate: M.slate, glass: M.window, dark: M.iron, iron: M.iron, clay: M.clay, soil: M.soil, greens: M.greens,
  };
}

export function buildHouses(state, w, M, { animatedIds = new Set(), chunk = 300 } = {}) {
  const seed = state.seed;
  const HM = houseMaterials(M);
  const plots = new Map(state.plots.map((p) => [p.id, p]));
  const props = propGeos();
  const unit = { plinth: boxGeo(1, 1, 1, 0.5).translate(0, -0.5, 0), ruin: ruinGeo(), rubble: new THREE.DodecahedronGeometry(1, 0), far: farGeo() };
  const farMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
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
    const sh = houseShape(seed, h, plot, w, { terrace: !!state.wall2?.pts && insideWall2(state.wall2.pts, plot.x, plot.z, 0.03, w) });
    shapes.set(h.id, sh);
    if (animatedIds.has(h.id)) continue;
    const ch = getChunk(sh.x, sh.z);
    ch.near.push('plinth', { geo: unit.plinth, mat: M.stoneDark }, local(sh, 0, 0.05, 0, sh.W + 0.6, sh.base - sh.hmin + 0.7, sh.D + 0.6));
    if (h.status === 'ruin') {
      ch.near.push('ruin', { geo: unit.ruin, mat: M.rubble }, local(sh, 0, 0, 0, sh.W, 1, sh.D), new THREE.Color('#a7a294'));
      for (let i = 0; i < 6; i++) {
        const r = (k) => rand01(seed, 'rubble', h.plot, i, k);
        ch.near.push('rubble', { geo: unit.rubble, mat: M.rubble }, local(sh, (r(0) - 0.5) * sh.W * 1.2, 0.2, (r(1) - 0.5) * sh.D * 1.2, 0.4 + r(2) * 0.6, 0.3 + r(3) * 0.4, 0.4 + r(4) * 0.6, r(5) * 6));
      }
      ch.far.push('far', { geo: unit.far, mat: farMat, shadow: false }, local(sh, 0, 0, 0, sh.W, 1.5, sh.D), new THREE.Color('#77736a'));
      continue;
    }
    const damaged = h.status === 'abandoned';
    const v = variant(sh, damaged, seed);
    const wall = sh.wallColor.clone().multiplyScalar(damaged ? 0.6 : 1);
    const roofC = sh.roofColor.clone().multiplyScalar(damaged ? 0.6 : 1);
    const m = local(sh, 0, 0, 0);
    for (const [key, geo] of v.parts) {
      const mat = key.split('|')[1];
      const tint = mat === 'plaster' ? wall : mat === 'roofTile' ? roofC : damaged ? new THREE.Color(0.6, 0.6, 0.6) : null;
      ch.near.push(sh.key(damaged) + key, { geo, mat: damaged && mat === 'glass' ? HM.dark : HM[mat], shadow: mat !== 'glass' }, m, tint);
    }
    if (v.chimneyTop && !damaged) chimneys.push(new THREE.Vector3(...v.chimneyTop).applyMatrix4(sh.matrix));
    // the crofts of villagers named by commenters are kept clear for their work scenes (work.js)
    if (!h.occupants.some((id) => state.names?.[id])) addYard(ch.near, sh, h, seed, props, HM);
    ch.far.push('far', { geo: unit.far, mat: farMat, shadow: false }, local(sh, 0, 0, 0, sh.W, v.height * 0.85, sh.D), roofC.clone().lerp(wall, 0.3));
  }

  const group = new THREE.Group();
  const chunkList = [];
  for (const ch of chunks.values()) {
    const near = new THREE.Group(), far = new THREE.Group();
    ch.near.build(near);
    ch.far.build(far);
    group.add(near, far);
    chunkList.push({ near, far, cx: ch.cx, cz: ch.cz });
  }
  return {
    group, chimneys, shapes, unit, props, HM,
    updateLod(camera, nearDist = 480) {
      for (const c of chunkList) {
        const d = Math.hypot(camera.position.x - c.cx, camera.position.z - c.cz);
        c.near.visible = d < nearDist;
        c.far.visible = !c.near.visible;
      }
    },
  };
}

/**
 * Beside the house: a woodpile and barrels. No gardens behind the houses (owner 2026-10-22: no vegetable
 * beds, sheds, carts or wattle fences in the crofts).
 */
function addYard(batch, sh, h, seed, props, HM) {
  const back = sh.D / 2; // local z of the back wall (front is -D/2)
  const r = (k) => rand01(seed, 'yard', h.plot, k);
  const put = (name, x, z, ry = 0, s = 1) => {
    for (const { mat, geo } of props.get(name)) batch.push(`prop|${name}|${mat}`, { geo, mat: HM[mat] }, local(sh, x, 0, z, s, s, s, ry));
  };
  if (r(0) < 0.75) put('woodpile', sh.W / 2 + 0.7, back - 1.6, Math.PI / 2, 0.9);
  if (r(1) < 0.6) put('barrels', -sh.W / 2 + 0.3, -sh.D / 2 - 0.9, 0);
}

function ruinGeo() {
  const parts = [];
  const heights = [1.6, 0.9, 1.3, 0.5, 1.1, 0.7, 1.5, 0.4];
  let k = 0;
  for (const [x0, z0, x1, z1] of [[-0.5, -0.5, 0.5, -0.5], [0.5, -0.5, 0.5, 0.5], [0.5, 0.5, -0.5, 0.5], [-0.5, 0.5, -0.5, -0.5]]) {
    for (let i = 0; i < 2; i++) {
      const hh = heights[k++ % heights.length];
      const ax = x0 + (x1 - x0) * i / 2, az = z0 + (z1 - z0) * i / 2, bx = x0 + (x1 - x0) * (i + 1) / 2, bz = z0 + (z1 - z0) * (i + 1) / 2;
      const len = Math.hypot(bx - ax, bz - az);
      const g = new THREE.BoxGeometry(Math.abs(bx - ax) > 0 ? len : 0.07, hh, Math.abs(bz - az) > 0 ? len : 0.07);
      g.translate((ax + bx) / 2, hh / 2, (az + bz) / 2);
      parts.push(g.toNonIndexed());
    }
  }
  // two charred beams fallen across
  parts.push(new THREE.BoxGeometry(1.1, 0.05, 0.05).rotateZ(0.5).translate(0, 0.5, 0.1).toNonIndexed());
  parts.push(new THREE.BoxGeometry(0.05, 0.05, 1.0).rotateX(-0.4).translate(0.2, 0.4, 0).toNonIndexed());
  return mergeGeometries(parts);
}

function farGeo() {
  const body = new THREE.BoxGeometry(1, 0.6, 1).translate(0, 0.3, 0).toNonIndexed();
  const roof = gableGeo(1.08, 1.1, 0.4).translate(0, 0.6, 0);
  const g = mergeGeometries([body, roof].map((p) => { for (const k of Object.keys(p.attributes)) if (!['position', 'normal'].includes(k)) p.deleteAttribute(k); return p; }));
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) col.set(i >= body.attributes.position.count ? [1, 1, 1] : [1.25, 1.2, 1.1], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/**
 * A single house built layer by layer so construction (0..1) can be animated. `raised`: a lived-in house
 * getting another storey (the new top floor rises under its roof, which goes up with it).
 */
export function buildAnimatedHouse(sh, h, seed, M, housesCtx, { raised = false } = {}) {
  const HM = housesCtx.HM;
  const v = variant(sh, false, seed);
  const g = new THREE.Group();
  g.matrixAutoUpdate = false;
  g.matrix.copy(sh.matrix);
  const layers = {};
  for (const [key, geo] of v.parts) {
    const [layer, mat] = key.split('|');
    let material = HM[mat];
    if (mat === 'plaster' || mat === 'roofTile') {
      material = material.clone();
      material.color.copy(mat === 'plaster' ? sh.wallColor : sh.roofColor);
    }
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = mat !== 'glass'; mesh.receiveShadow = true;
    (layers[layer] ||= new THREE.Group()).add(mesh);
  }
  const plinth = new THREE.Mesh(housesCtx.unit.plinth, M.stoneDark);
  plinth.scale.set(sh.W + 0.6, sh.base - sh.hmin + 0.7, sh.D + 0.6);
  plinth.position.y = 0.05;
  g.add(plinth);
  for (const l of Object.values(layers)) g.add(l);
  // scaffold: poles around the house and plank levels
  const scaffold = new THREE.Group();
  const poleGeo = cylGeo(0.08, 0.08, 1, 6);
  const H = v.eaves + 1.2;
  for (const [u, vv] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1]]) {
    const p = new THREE.Mesh(poleGeo, M.wood);
    p.position.set(u * (sh.W / 2 + 0.8), H / 2, vv * (sh.D / 2 + 0.9));
    p.scale.set(1, H, 1);
    scaffold.add(p);
  }
  for (let y = 2.8; y < H; y += 3) for (const vv of [-1, 1]) {
    const pl = new THREE.Mesh(boxGeo(sh.W + 1.8, 0.1, 0.8, 1), M.wood);
    pl.position.set(0, y, vv * (sh.D / 2 + 0.9));
    scaffold.add(pl);
  }
  scaffold.traverse((o) => { o.castShadow = true; });
  g.add(scaffold);
  const chimneyTop = v.chimneyTop ? new THREE.Vector3(...v.chimneyTop).applyMatrix4(sh.matrix) : null;
  const top = new THREE.Vector3(0, v.height + 1, 0).applyMatrix4(sh.matrix);
  const mid = new THREE.Vector3(0, v.height * 0.5, 0).applyMatrix4(sh.matrix);
  // each layer rises from its own base line
  const grow = (obj, a, b, p, pivot = 0) => {
    const k = Math.min(1, Math.max(0, (p - a) / (b - a)));
    if (!obj) return;
    obj.visible = k > 0.001;
    obj.scale.y = Math.max(0.001, k);
    obj.position.y = pivot * (1 - obj.scale.y);
  };
  return {
    group: g, top, mid, chimneyTop, shape: sh,
    raised,
    /** p: 0 = bare plot · foundation · ground-floor walls · upper floors · roof · details · 1 finished */
    set(p) {
      if (raised) {
        // the house stands; the scaffold goes up, the new storey rises and lifts the roof with it
        const k = Math.min(1, Math.max(0, (p - 0.12) / 0.7));
        grow(layers.top, 0.12, 0.82, p, v.topBase);
        if (layers.roof) layers.roof.position.y = -(v.eaves - v.topBase) * (1 - k);
        scaffold.visible = p > 0.02 && p < 0.96;
        scaffold.scale.y = Math.max(0.01, Math.min(1, (p - 0.02) / 0.12));
        return;
      }
      plinth.visible = p > 0.01;
      grow(layers.foundation, 0.01, 0.1, p);
      grow(layers.walls, 0.1, 0.38, p);
      const three = !!layers.upper;
      grow(layers.upper, 0.36, 0.46, p, 3.45);
      grow(layers.top, three ? 0.46 : 0.36, 0.56, p, v.topBase);
      grow(layers.roof, 0.56, 0.8, p, v.eaves);
      grow(layers.details, 0.8, 0.9, p);
      scaffold.visible = p > 0.06 && p < 0.96;
      scaffold.scale.y = Math.max(0.01, Math.min(1, (p - 0.06) / 0.2));
    },
  };
}
