// Detailed procedural house variants. A variant is a set of merged geometries keyed by
// layer (foundation, frame, walls, upper, roof, details) and material, built in local space:
// x along the street frontage, z depth, front wall at z = -D/2 facing the street, ground at y = 0.
// Geometry is shared by every house of the same variant (instancing), so detail is cheap per house.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boxGeo, cylGeo } from './kit.js';
import { rng } from '../../sim/prng.js';

export const FLOOR_H = 3.0;
const BEAM = 0.2;

class Parts {
  constructor() { this.map = new Map(); }
  add(layer, mat, geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1)));
    const key = `${layer}|${mat}`;
    if (!this.map.has(key)) this.map.set(key, []);
    this.map.get(key).push(g);
  }
  box(layer, mat, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0, tile = 2) { this.add(layer, mat, boxGeo(w, h, d, tile), x, y, z, ry, rx, rz); }
  merged() {
    const out = new Map();
    for (const [k, geos] of this.map) {
      const g = mergeGeometries(geos, false);
      g.computeBoundingSphere();
      out.set(k, g);
    }
    return out;
  }
}

/** A wall in its own frame: runs along local x (length L), outward normal +z, placed by `put`. */
function wall(P, layer, { L, H, y0, timber, wallMat, openings, put }) {
  const T = 0.22;
  // infill / masonry
  P.add(layer, wallMat, put(boxGeo(L, H, T, 2)), 0, 0, 0);
  if (!timber) return;
  const add = (w, h, x, y, rz = 0) => P.add(layer, 'woodDark', put(boxGeo(w, h, 0.08, 1), x, y0 + y, T / 2 + 0.04, rz));
  add(L + 0.1, BEAM, 0, BEAM / 2); // sill beam
  add(L + 0.1, BEAM, 0, H - BEAM / 2); // head beam
  const posts = [-L / 2 + 0.11, L / 2 - 0.11];
  const free = (x) => !openings.some((o) => Math.abs(x - o.x) < o.w / 2 + 0.18);
  for (let x = -L / 2 + 1.05; x < L / 2 - 0.8; x += 1.05) if (free(x)) posts.push(x);
  for (const x of posts) add(0.18, H - 2 * BEAM, x, H / 2);
  // mid rail between posts, skipping openings
  const railY = H * 0.5;
  const xs = [...posts].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i], b = xs[i + 1], m = (a + b) / 2;
    if (b - a < 0.3 || openings.some((o) => Math.abs(m - o.x) < o.w / 2 + 0.05 && railY > o.y - o.h / 2 - 0.1 && railY < o.y + o.h / 2 + 0.1)) continue;
    add(b - a, 0.14, m, railY);
  }
  // corner braces
  const bh = H - 2 * BEAM, bl = Math.hypot(0.9, bh * 0.5);
  if (free(-L / 2 + 0.6)) add(0.14, bl, -L / 2 + 0.55, BEAM + bh * 0.25, -Math.atan2(0.9, bh * 0.5));
  if (free(L / 2 - 0.6)) add(0.14, bl, L / 2 - 0.55, BEAM + bh * 0.25, Math.atan2(0.9, bh * 0.5));
}

/** Window with frame, mullion, sill, leaded glass and open shutters. */
function windowAt(P, layer, put, x, y, w, h, shutters, damaged) {
  const T = 0.22;
  const f = (gw, gh, gx, gy, gz = T / 2 + 0.07) => P.add(layer, 'woodDark', put(boxGeo(gw, gh, 0.1, 1), x + gx, y + gy, gz));
  P.add(layer, damaged ? 'dark' : 'glass', put(boxGeo(w, h, 0.05, 1), x, y, T / 2 + 0.01));
  f(w + 0.24, 0.12, 0, h / 2 + 0.06); f(w + 0.3, 0.12, 0, -h / 2 - 0.06, T / 2 + 0.12);
  f(0.12, h, -w / 2 - 0.06, 0); f(0.12, h, w / 2 + 0.06, 0); f(0.07, h, 0, 0);
  if (shutters && !damaged) {
    for (const s of [-1, 1]) P.add(layer, 'wood', put(boxGeo(w / 2, h, 0.05, 1), x + s * (w / 2 + 0.06 + w / 4), y, T / 2 + 0.16));
  } else if (shutters) {
    P.add(layer, 'wood', put(boxGeo(w / 2, h * 0.9, 0.05, 1), x - w / 2 - 0.2, y - 0.25, T / 2 + 0.16, 0, 0.35));
  }
}

function door(P, layer, put, x, w, h, damaged) {
  const T = 0.22;
  P.add(layer, 'woodDark', put(boxGeo(w, h, 0.08, 1), x, h / 2, T / 2 + 0.03));
  for (let i = 0; i < 4; i++) P.add(layer, 'wood', put(boxGeo(w / 4 - 0.03, h - 0.08, 0.05, 1), x - w / 2 + w / 8 + (i * w) / 4, h / 2, T / 2 + 0.08));
  P.add(layer, 'iron', put(boxGeo(w * 0.9, 0.08, 0.04, 1), x, h * 0.25, T / 2 + 0.12));
  P.add(layer, 'iron', put(boxGeo(w * 0.9, 0.08, 0.04, 1), x, h * 0.72, T / 2 + 0.12));
  P.add(layer, 'woodDark', put(boxGeo(w + 0.3, 0.16, 0.16, 1), x, h + 0.08, T / 2 + 0.08)); // lintel
  if (damaged) for (const a of [0.6, -0.6]) P.add(layer, 'wood', put(boxGeo(w * 1.2, 0.18, 0.05, 1), x, h * 0.5, T / 2 + 0.16, 0, 0, a));
}

/** Gable roof with real thickness, eaves, ridge, bargeboards; returns nothing. Ridge along x. */
function roof(P, { W, D, y, pitch, mat, thatch, damaged, front, zc = 0 }) {
  const ov = thatch ? 0.55 : 0.4, og = thatch ? 0.4 : 0.3;
  const half = D / 2 + ov;
  const rise = half * Math.tan(pitch);
  const slope = Math.hypot(half, rise);
  const th = thatch ? 0.45 : 0.16;
  for (const s of [-1, 1]) {
    // slab hinged at the ridge
    const g = boxGeo(W + 2 * og, th, slope, thatch ? 1.5 : 1);
    const missing = damaged && s === -1;
    if (missing) {
      // half the covering gone: show rafters
      for (let x = -W / 2; x <= W / 2; x += 0.6) P.add('roof', 'woodDark', boxGeo(0.12, 0.12, slope, 1), x, y + rise / 2, zc + s * half / 2, 0, s * pitch);
      P.add('roof', mat, boxGeo((W + 2 * og) * 0.45, th, slope, 1), W * 0.3, y + rise / 2, zc + s * half / 2, 0, s * pitch);
    } else {
      P.add('roof', mat, g, 0, y + rise / 2 + (th / 2) * Math.cos(pitch), zc + s * (half / 2) + s * (th / 2) * Math.sin(pitch), 0, s * pitch);
    }
  }
  // ridge
  if (thatch) P.add('roof', mat, cylGeo(0.32, 0.32, W + 2 * og, 8, 1).rotateZ(Math.PI / 2), 0, y + rise + 0.25, zc);
  else P.add('roof', 'woodDark', boxGeo(W + 2 * og + 0.05, 0.18, 0.3, 1), 0, y + rise + 0.14, zc);
  // gable triangles (walls) and bargeboards
  for (const sx of [-1, 1]) {
    const tri = new THREE.BufferGeometry();
    const hw = D / 2;
    tri.setAttribute('position', new THREE.Float32BufferAttribute(sx > 0 ? [0, 0, hw, 0, 0, -hw, 0, rise * (hw / half), 0] : [0, 0, -hw, 0, 0, hw, 0, rise * (hw / half), 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, D / 2, 0, D / 4, rise / 2], 2));
    tri.computeVertexNormals();
    P.add('roof', front, tri, sx * (W / 2), y, zc);
    if (!thatch) for (const s of [-1, 1]) P.add('roof', 'woodDark', boxGeo(0.1, 0.24, slope, 1), sx * (W / 2 + og), y + rise / 2 + 0.05, zc + s * half / 2, 0, s * pitch);
  }
  return rise;
}

/**
 * Build one variant.
 * spec: { arch: 'timber'|'stone'|'cottage'|'fine', W, D, floors, chimney, dormer, damaged, seed }
 * 'fine': a Noble Quarter town house (owner 2026-10-22): a taller stone ground floor with a carved doorway,
 * timber-framed upper floors oversailing the street, an oriel window, two chimneys, two dormers.
 */
export function buildHouseVariant(spec) {
  const { arch, W, D, floors, chimney, dormer, damaged } = spec;
  const r = rng(spec.seed || 1, 'hv', arch, W, D, floors);
  const P = new Parts();
  const timber = arch === 'timber', fine = arch === 'fine';
  const wallMat = arch === 'stone' ? 'stone' : 'plaster';
  const groundH = arch === 'cottage' ? 2.7 : fine ? FLOOR_H + 0.5 : FLOOR_H;
  // foundation course
  P.box('foundation', 'stoneDark', W + 0.3, 0.45, D + 0.3, 0, 0.22, 0);
  let y = 0.45;
  const jetty = (timber || fine) && floors > 1 ? 0.45 : 0;
  const levels = [];
  for (let f = 0; f < floors; f++) {
    const H = f === 0 ? groundH : FLOOR_H;
    const j = f === 0 ? 0 : jetty; // upper floors oversail the street
    levels.push({ y, H, j });
    y += H;
  }
  const eaves = y;
  levels.forEach(({ y: y0, H, j }, f) => {
    const layer = f === 0 ? 'walls' : f === floors - 1 ? 'top' : 'upper'; // the top storey on its own (a storey added later rises)
    const zf = -D / 2 - j, zb = D / 2, Wf = W + (f > 0 && jetty ? 0.25 : 0);
    const depth = zb - zf;
    const lTimber = fine ? f > 0 : timber, lMat = fine ? (f > 0 ? 'plaster' : 'stone') : wallMat;
    const oriel = fine && f === 1; // the oriel window in the middle of the first floor
    // openings on the front
    const nWin = Math.max(1, Math.round((Wf - (f === 0 ? 1.4 : 0)) / (fine ? 2.4 : 2.0)));
    const openings = [];
    const doorX = f === 0 ? (fine ? 0 : (r.chance(0.5) ? -1 : 1) * Math.min(Wf / 2 - 0.9, Wf * 0.22)) : null;
    if (doorX !== null) openings.push({ x: doorX, y: 1.05, w: fine ? 1.6 : 1.1, h: fine ? 2.5 : 2.1 });
    if (oriel) openings.push({ x: 0, y: 1.5, w: 2.0, h: 2.2 });
    const winY = f === 0 ? (fine ? 1.75 : 1.55) : 1.45;
    for (let i = 0; i < nWin; i++) {
      const x = -Wf / 2 + ((i + 0.5) * Wf) / nWin;
      if (doorX !== null && Math.abs(x - doorX) < (fine ? 1.8 : 1.3)) continue;
      if (oriel && Math.abs(x) < 1.8) continue;
      openings.push({ x, y: winY, w: fine ? 1.1 : f === 0 ? 0.9 : 1.0, h: fine ? 1.35 : f === 0 ? 1.0 : 1.1, win: true });
    }
    const putFront = (g, x = 0, yy = 0, z = 0, rz = 0) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, (yy || y0 + H / 2), zf - z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, rz)), new THREE.Vector3(1, 1, 1)));
    const putBack = (g, x = 0, yy = 0, z = 0, rz = 0) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, (yy || y0 + H / 2), zb + z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(1, 1, 1)));
    const putSide = (sx) => (g, x = 0, yy = 0, z = 0, rz = 0) => g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(sx * (Wf / 2 + z), (yy || y0 + H / 2), (zf + zb) / 2 + x * sx), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sx * Math.PI / 2, rz)), new THREE.Vector3(1, 1, 1)));
    wall(P, layer, { L: Wf, H, y0, timber: lTimber, wallMat: lMat, openings, put: wrapY(putFront, y0, H) });
    wall(P, layer, { L: Wf, H, y0, timber: lTimber, wallMat: lMat, openings: [{ x: 0, y: winY, w: 1, h: 1 }], put: wrapY(putBack, y0, H) });
    for (const sx of [-1, 1]) wall(P, layer, { L: depth, H, y0, timber: lTimber, wallMat: lMat, openings: [{ x: 0, y: winY, w: 1, h: 1 }], put: wrapY(putSide(sx), y0, H) });
    for (const o of openings) if (o.win) windowAt(P, layer, wrapY(putFront, y0, H), o.x, y0 + o.y, o.w, o.h, (arch !== 'stone' && !fine) || f > 0, damaged);
    if (oriel) {
      // a bay on a stone corbel, glazed on three sides, under its own little roof
      P.box(layer, 'stoneDark', 1.6, 0.5, 0.6, 0, y0 + 0.1, zf - 0.3, 0, 0, 0, 1);
      P.box(layer, 'plaster', 2.1, 2.2, 0.8, 0, y0 + 1.45, zf - 0.4);
      P.box(layer, 'glass', 1.6, 1.4, 0.05, 0, y0 + 1.55, zf - 0.83);
      for (const s of [-1, 1]) P.box(layer, 'glass', 0.05, 1.3, 0.45, s * 1.07, y0 + 1.55, zf - 0.4);
      for (const x of [-0.8, 0, 0.8]) P.box(layer, 'woodDark', 0.1, 1.5, 0.08, x, y0 + 1.55, zf - 0.86);
      P.box(layer, 'roofTile', 2.4, 0.12, 1.05, 0, y0 + 2.7, zf - 0.45, 0, -0.45);
    }
    if (fine && f === 0) {
      // the carved doorway: stone jambs and a lintel with a carved panel, two steps, a string course above
      for (const s of [-1, 1]) P.box(layer, 'stoneDark', 0.35, 2.75, 0.3, s * 0.98, 1.38, zf - 0.1, 0, 0, 0, 1);
      P.box(layer, 'stoneDark', 2.4, 0.4, 0.34, 0, 2.9, zf - 0.12, 0, 0, 0, 1);
      P.box(layer, 'stone', 0.9, 0.5, 0.1, 0, 3.35, zf - 0.08, 0, 0, 0, 1);
      P.box(layer, 'stoneDark', 2.4, 0.16, 0.9, 0, 0.08, zf - 0.45);
      P.box(layer, 'stoneDark', Wf + 0.1, 0.18, 0.2, 0, H - 0.09, zf - 0.08);
    }
    windowAt(P, layer, wrapY(putBack, y0, H), 0, y0 + winY, 0.9, 1.0, false, damaged);
    if (depth > 4.5) for (const sx of [-1, 1]) windowAt(P, layer, wrapY(putSide(sx), y0, H), 0, y0 + winY, 0.8, 0.9, false, damaged);
    if (doorX !== null && fine) door(P, layer, wrapY(putFront, 0, 0), doorX, 1.5, 2.5, damaged);
    else if (doorX !== null) {
      door(P, layer, wrapY(putFront, 0, 0), doorX, 1.05, 2.05, damaged);
      // door hood
      P.box('details', 'woodDark', 1.6, 0.1, 0.8, doorX, 2.55, zf - 0.45, 0, -0.35);
      for (const s of [-1, 1]) P.box('details', 'woodDark', 0.08, 0.6, 0.08, doorX + s * 0.7, 2.25, zf - 0.55);
      P.box('details', 'stoneDark', 1.4, 0.18, 0.6, doorX, 0.09, zf - 0.3); // step
    }
    if (f > 0 && j > 0) {
      // jetty: bressumer and joist ends under the oversailing floor
      P.box(layer, 'woodDark', Wf + 0.1, 0.24, 0.24, 0, y0 + 0.12, zf + 0.1);
      for (let x = -Wf / 2 + 0.25; x <= Wf / 2 - 0.2; x += 0.55) P.box(layer, 'woodDark', 0.16, 0.16, j + 0.2, x, y0 - 0.08, zf + j / 2 + 0.05);
    }
    if (arch === 'stone' || (fine && f === 0)) {
      // quoins
      for (let k = 0; k < Math.floor(H / 0.5); k++) for (const sx of [-1, 1]) for (const zz of [zf, zb]) {
        const long = k % 2 === 0;
        P.box(layer, 'stoneDark', long ? 0.55 : 0.3, 0.44, long ? 0.3 : 0.55, sx * (Wf / 2 - (long ? 0.2 : 0.08)), y0 + k * 0.5 + 0.25, zz + (zz === zf ? 0.08 : -0.08));
      }
    }
  });
  if ((timber || fine) && floors > 1) P.box('top', 'woodDark', W + 0.35, 0.22, D + 0.5, 0, eaves + 0.05, -0.2);
  // roof
  const pitch = arch === 'cottage' ? 0.85 : arch === 'stone' ? 0.72 : fine ? 1.0 : 0.92;
  const roofMat = arch === 'cottage' ? 'thatch' : arch === 'stone' ? 'slate' : 'roofTile';
  const rise = roof(P, { W, D: D + jetty, y: eaves + 0.1, pitch, mat: roofMat, thatch: arch === 'cottage', damaged, front: timber || fine ? 'plaster' : wallMat, zc: -jetty / 2 });
  if ((dormer || fine) && !damaged) for (const dx of fine ? [-W / 4, W / 4] : [0]) {
    const dw = Math.min(1.8, W * 0.3), dy = eaves + rise * 0.3;
    P.box('roof', fine ? 'plaster' : wallMat, dw, 1.3, 1.2, dx, dy + 0.65, -D / 4);
    P.box('roof', 'glass', dw * 0.55, 0.8, 0.05, dx, dy + 0.7, -D / 4 - 0.62);
    for (const s of [-1, 1]) P.box('roof', roofMat, dw / 2 + 0.35, 0.1, 1.5, dx + s * dw / 4, dy + 1.45, -D / 4, 0, 0, s * -0.6);
  }
  let chimneyTop = null;
  if (chimney || fine) for (const side of fine ? [-1, 1] : [r.chance(0.5) ? -1 : 1]) {
    const cx = side * (W / 2 - 0.55), top = eaves + rise + 1.0;
    chimneyTop = [cx, top + 0.7, 0.4];
    P.box('details', 'stone', 0.75, top - 0.4, 0.75, cx, (top + 0.4) / 2, 0.4, 0, 0, 0, 1);
    P.box('details', 'stoneDark', 0.95, 0.14, 0.95, cx, top + 0.07, 0.4);
    P.add('details', 'clay', cylGeo(0.13, 0.15, 0.45, 8), cx + 0.15, top + 0.36, 0.4);
    if (r.chance(0.5)) P.add('details', 'clay', cylGeo(0.12, 0.14, 0.38, 8), cx - 0.17, top + 0.33, 0.4);
  }
  return { parts: P.merged(), eaves, rise, height: eaves + rise, chimneyTop, jetty, topBase: levels.at(-1).y };
}

function wrapY(put, y0, H) {
  // walls are built centred on their own height; openings/frames use absolute y
  return (g, x = 0, yy = 0, z = 0, rz = 0) => put(g, x, yy === 0 ? y0 + H / 2 : yy, z, rz);
}

// ------------------------------------------------------------------ yard props
export function propGeos() {
  const P = new Parts();
  // woodpile under a little roof
  for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) P.add('woodpile', 'wood', cylGeo(0.16, 0.16, 1.4, 6).rotateX(Math.PI / 2), -0.8 + i * 0.32 + row * 0.16, 0.16 + row * 0.28, 0);
  P.box('woodpile', 'woodDark', 2.3, 0.08, 1.2, 0, 1.25, 0, 0, 0.2);
  // barrels
  for (const [x, z] of [[0, 0], [0.7, 0.2]]) {
    P.add('barrels', 'wood', cylGeo(0.3, 0.27, 0.85, 10), x, 0.43, z);
    P.add('barrels', 'iron', cylGeo(0.31, 0.31, 0.05, 10), x, 0.2, z);
    P.add('barrels', 'iron', cylGeo(0.31, 0.31, 0.05, 10), x, 0.66, z);
  }
  // shed (lean-to)
  P.box('shed', 'wood', 2.6, 2.0, 2.0, 0, 1.0, 0);
  P.box('shed', 'thatch', 3.0, 0.25, 2.6, 0, 2.15, 0, 0, 0.3);
  P.box('shed', 'woodDark', 0.9, 1.6, 0.06, 0.4, 0.8, -1.02);
  // vegetable bed: soil + rows of greens
  P.box('veg', 'soil', 3.2, 0.2, 2.4, 0, 0.1, 0);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 6; k++) P.add('veg', 'greens', new THREE.IcosahedronGeometry(0.2, 0), -1.3 + k * 0.52, 0.28, -0.9 + i * 0.6);
  // hand cart
  P.box('cart', 'wood', 1.8, 0.5, 1.1, 0, 0.75, 0);
  for (const s of [-1, 1]) P.add('cart', 'woodDark', cylGeo(0.45, 0.45, 0.08, 12).rotateX(Math.PI / 2), 0, 0.45, s * 0.6);
  P.box('cart', 'woodDark', 1.6, 0.06, 0.06, 1.5, 0.75, -0.3, 0, 0, -0.15);
  P.box('cart', 'woodDark', 1.6, 0.06, 0.06, 1.5, 0.75, 0.3, 0, 0, -0.15);
  // wattle fence panel, 2 m long (posts and woven rods)
  for (const x of [-1, 0, 1]) P.add('wattle', 'woodDark', cylGeo(0.05, 0.06, 1.2, 5), x, 0.6, 0);
  for (let k = 0; k < 6; k++) P.add('wattle', 'wood', boxGeo(2, 0.06, 0.05, 1), 0, 0.2 + k * 0.16, (k % 2 ? 1 : -1) * 0.03);
  const out = new Map();
  for (const [key, g] of P.merged()) {
    const [name, mat] = key.split('|');
    if (!out.has(name)) out.set(name, []);
    out.get(name).push({ mat, geo: g });
  }
  return out;
}
