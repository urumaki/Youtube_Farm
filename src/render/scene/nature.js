// Forests, scattered trees and rocks. Trees never stand on plots, lots, roads, fields or water,
// so houses built later never intersect them. Chunked with a cheap far LOD.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt, fbm, CASTLE, RIVER_HALF_WIDTH } from '../../sim/world.js';
import { rand01 } from '../../sim/prng.js';
import { SpatialHash, obbAabb, pointInObb, grow } from '../../sim/geometry.js';

function clean(g) {
  const q = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(q.attributes)) if (!['position', 'normal'].includes(k)) q.deleteAttribute(k);
  return q;
}
function colored(g, c) {
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function broadleafGeo(detail = 1) {
  const trunk = colored(clean(new THREE.CylinderGeometry(0.22, 0.34, 3.4, 6).translate(0, 1.7, 0)), new THREE.Color(0.32, 0.24, 0.17));
  const blobs = [[0, 4.6, 0, 2.3], [0.9, 3.9, 0.4, 1.6], [-0.8, 4.0, -0.5, 1.7], [0.2, 5.6, -0.2, 1.5]].map(([x, y, z, r], i) => {
    const g = clean(new THREE.IcosahedronGeometry(r, detail));
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { // lumpy canopy
      const f = 1 + 0.12 * Math.sin(p.getX(k) * 3.1 + i) * Math.cos(p.getZ(k) * 2.7 - i);
      p.setXYZ(k, p.getX(k) * f, p.getY(k) * f * 0.92, p.getZ(k) * f);
    }
    g.computeVertexNormals();
    return colored(g.translate(x, y, z), new THREE.Color(1, 1, 1).multiplyScalar(0.85 + i * 0.06));
  });
  return mergeGeometries([trunk, ...blobs]);
}
function coniferGeo(seg = 7) {
  const trunk = colored(clean(new THREE.CylinderGeometry(0.16, 0.26, 2.4, 6).translate(0, 1.2, 0)), new THREE.Color(0.3, 0.22, 0.16));
  const cones = [[2.6, 3.4, 2.2], [2.0, 3.0, 4.2], [1.35, 2.6, 6.0]].map(([r, h, y], i) =>
    colored(clean(new THREE.ConeGeometry(r, h, seg).translate(0, y + h / 2 - 0.6, 0)), new THREE.Color(1, 1, 1).multiplyScalar(0.85 + i * 0.08)));
  return mergeGeometries([trunk, ...cones]);
}
function farTreeGeo(conifer) {
  const g = conifer ? new THREE.ConeGeometry(2.3, 7.6, 5).translate(0, 4.2, 0) : new THREE.OctahedronGeometry(2.6, 0).scale(1, 1.1, 1).translate(0, 4.4, 0);
  return colored(clean(g), new THREE.Color(0.9, 0.9, 0.9));
}

export function buildNature(w, state, M, { season = 'summer' } = {}) {
  const seed = w.seed;
  const block = new SpatialHash(50);
  for (const p of w.plots) block.insert(obbAabb(grow(p, 2)), grow(p, 2));
  for (const l of Object.values(w.lots)) if (!l.virtual) block.insert(obbAabb(grow(l, 6)), grow(l, 6));
  for (const f of w.fields) block.insert(obbAabb(grow(f, 3)), grow(f, 3));
  for (const s of w.wall2.segments) block.insert(obbAabb(grow(s, 5)), grow(s, 5));
  const blocked = (x, z) => {
    for (const b of block.query([x, z, x, z])) if (pointInObb(b, x, z)) return true;
    return false;
  };

  const trees = [];
  const STEP = 9;
  for (let x = -1500; x < 2800; x += STEP) {
    for (let z = -1600; z < 1000; z += STEP) {
      const jx = x + (rand01(seed, 'tx', x, z) - 0.5) * STEP * 0.9, jz = z + (rand01(seed, 'tz', x, z) - 0.5) * STEP * 0.9;
      let dens = (fbm(seed + 99, jx / 320, jz / 320, 3) + 1) / 2;
      const town = jx > 40 && jz > -950 && jz < 480 && jx < 2650;
      if (jx < -170 || jz < -420) dens += 0.18;
      if (town) dens -= 0.32;
      const rc = Math.hypot(jx, jz);
      if (rc < CASTLE.moatOuter + 24) continue;
      const rd = w.river.dist(jx, jz, 60);
      if (rd < RIVER_HALF_WIDTH + 5) continue;
      if (rd < 60 && !town) dens += 0.12; // riverside woods
      const th = town ? 0.62 : 0.5;
      if (dens < th && rand01(seed, 'lone', x, z) > 0.012) continue;
      if (w.pathIndex.edgeDist(jx, jz, 12) < 3.5) continue;
      if (blocked(jx, jz)) continue;
      const h = heightAt(w, jx, jz);
      if (h < 1.5) continue;
      const hill = h > 12 || jz < -500;
      const conifer = hill ? rand01(seed, 'kind', x, z) < 0.8 : rand01(seed, 'kind', x, z) < 0.22;
      trees.push({ x: jx, z: jz, y: h - 0.2, conifer, s: 0.75 + rand01(seed, 'ts', x, z) * 0.7, r: rand01(seed, 'tr', x, z) * 6.28, c: rand01(seed, 'tc', x, z) });
    }
  }

  const palettes = {
    summer: ['#3f6b2a', '#4c7a31', '#5b8a36', '#355d28'],
    spring: ['#5c8f34', '#6fa03c', '#4f7f2e', '#7aa846'],
    autumn: ['#c2702a', '#d4a03a', '#a5452a', '#7a8a35', '#b8862e'],
    winter: ['#5f6a52', '#6d7262', '#55604a', '#77806a'],
  };
  const leafCols = palettes[season].map((c) => new THREE.Color(c));
  const pineCols = ['#2c4a2c', '#2f5232', '#264028', '#36583a'].map((c) => new THREE.Color(c));

  const CH = 320;
  const chunks = new Map();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (const t of trees) {
    const key = `${Math.floor(t.x / CH)},${Math.floor(t.z / CH)}`;
    if (!chunks.has(key)) chunks.set(key, { cx: (Math.floor(t.x / CH) + 0.5) * CH, cz: (Math.floor(t.z / CH) + 0.5) * CH, list: [] });
    chunks.get(key).list.push(t);
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
  const geos = { b: broadleafGeo(1), c: coniferGeo(7), fb: farTreeGeo(false), fc: farTreeGeo(true) };
  const group = new THREE.Group();
  const chunkList = [];
  for (const ch of chunks.values()) {
    const near = new THREE.Group(), far = new THREE.Group();
    for (const kind of ['b', 'c']) {
      const list = ch.list.filter((t) => t.conifer === (kind === 'c'));
      if (!list.length) continue;
      const nearIm = new THREE.InstancedMesh(geos[kind], mat, list.length);
      const farIm = new THREE.InstancedMesh(geos['f' + kind], mat, list.length);
      list.forEach((t, i) => {
        m4.compose(v.set(t.x, t.y, t.z), q.setFromEuler(e.set(0, t.r, 0)), sc.set(t.s, t.s * (0.9 + t.c * 0.25), t.s));
        nearIm.setMatrixAt(i, m4); farIm.setMatrixAt(i, m4);
        const pal = kind === 'c' ? pineCols : leafCols;
        const col = pal[Math.floor(t.c * pal.length) % pal.length];
        nearIm.setColorAt(i, col); farIm.setColorAt(i, col);
      });
      nearIm.castShadow = true; nearIm.receiveShadow = true;
      nearIm.computeBoundingSphere(); farIm.computeBoundingSphere();
      near.add(nearIm); far.add(farIm);
    }
    group.add(near, far);
    chunkList.push({ near, far, cx: ch.cx, cz: ch.cz });
  }

  // rocks along the river, on the hills and near the quarry
  const rocks = [];
  for (let i = 0; i < 900; i++) {
    const x = -900 + rand01(seed, 'rx', i) * 3300, z = -1300 + rand01(seed, 'rz', i) * 2100;
    const h = heightAt(w, x, z);
    if (h < 1.2 || blocked(x, z) || w.pathIndex.edgeDist(x, z, 10) < 3 || Math.hypot(x, z) < 80) continue;
    if (!(h > 9 || w.river.dist(x, z, 60) < 40 || rand01(seed, 'rk', i) < 0.25)) continue;
    rocks.push([x, h, z, 0.4 + rand01(seed, 'rs', i) * 1.6, rand01(seed, 'rr', i) * 6]);
  }
  const rockIm = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), M.rock, rocks.length);
  rocks.forEach(([x, h, z, s, r], i) => rockIm.setMatrixAt(i, m4.compose(v.set(x, h, z), q.setFromEuler(e.set(r, r * 2, 0)), sc.set(s * 1.3, s * 0.7, s))));
  rockIm.castShadow = rockIm.receiveShadow = true;
  rockIm.computeBoundingSphere();
  group.add(rockIm);

  return {
    group, count: trees.length,
    updateLod(camera, nearDist = 420) {
      for (const c of chunkList) {
        const d = Math.hypot(camera.position.x - c.cx, camera.position.z - c.cz);
        c.near.visible = d < nearDist;
        c.far.visible = !c.near.visible;
      }
    },
  };
}
