// Geometry kit: primitives with world-scaled UVs, merged per material for few draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Box whose UVs are in meters / `tile` so textures keep a constant density. */
export function boxGeo(w, h, d, tile = 4) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, n = g.attributes.normal, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ny > 0.5) uv.setXY(i, x / tile, z / tile);
    else if (nx > 0.5) uv.setXY(i, z / tile, y / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  return g;
}

export function cylGeo(rt, rb, h, seg = 16, tile = 4, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const uv = g.attributes.uv;
  const circ = Math.PI * 2 * Math.max(rt, rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * circ) / tile, (uv.getY(i) * h) / tile);
  return g;
}

/** Gable roof prism: ridge along X, width (x) w, depth (z) d, height h, base at y=0. */
export function gableGeo(w, d, h, tile = 3) {
  const hw = w / 2, hd = d / 2;
  const v = [
    // left slope
    -hw, 0, -hd, hw, 0, -hd, hw, h, 0, -hw, 0, -hd, hw, h, 0, -hw, h, 0,
    // right slope
    -hw, 0, hd, -hw, h, 0, hw, h, 0, -hw, 0, hd, hw, h, 0, hw, 0, hd,
    // gable ends
    -hw, 0, -hd, -hw, h, 0, -hw, 0, hd,
    hw, 0, -hd, hw, 0, hd, hw, h, 0,
  ];
  const slope = Math.hypot(hd, h);
  const uv = [
    0, 0, w / tile, 0, w / tile, slope / tile, 0, 0, w / tile, slope / tile, 0, slope / tile,
    0, 0, 0, slope / tile, w / tile, slope / tile, 0, 0, w / tile, slope / tile, w / tile, 0,
    0, 0, hd / tile, h / tile, d / tile, 0,
    0, 0, d / tile, 0, hd / tile, h / tile,
  ];
  // flip triangle winding so faces point outward
  for (let t = 0; t < v.length / 9; t++) {
    for (let k = 0; k < 3; k++) [v[t * 9 + 3 + k], v[t * 9 + 6 + k]] = [v[t * 9 + 6 + k], v[t * 9 + 3 + k]];
    for (let k = 0; k < 2; k++) [uv[t * 6 + 2 + k], uv[t * 6 + 4 + k]] = [uv[t * 6 + 4 + k], uv[t * 6 + 2 + k]];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Arched opening filler: a w x h block with a semicircular hole of radius w/2 at its bottom, extruded along X by depth. */
export function archGeo(w, h, depth, tile = 3) {
  const r = w / 2;
  const s = new THREE.Shape();
  s.moveTo(-r, 0); s.lineTo(-r, h); s.lineTo(r, h); s.lineTo(r, 0);
  s.absarc(0, 0, r, 0, Math.PI, false);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
  return g;
}

/** Four-sided pyramid / hip roof. */
export function pyramidGeo(w, d, h) {
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

export class Builder {
  constructor() { this.parts = new Map(); }
  add(key, geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
    return this.addM(key, geo, m);
  }
  addM(key, geo, matrix) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    return this;
  }
  /** Merge everything into one mesh per material key. */
  build(materials, { castShadow = true, receiveShadow = true } = {}) {
    const group = new THREE.Group();
    for (const [key, geos] of this.parts) {
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), materials[key]);
      mesh.castShadow = castShadow && !materials[key]?.userData?.noShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.name = key;
      group.add(mesh);
    }
    return group;
  }
}

/** A ring of merlons (battlements) around a circle. */
export function merlonRing(b, key, cx, cy, cz, radius, count, size = [1.2, 1.4, 0.8]) {
  const geo = boxGeo(size[0], size[1], size[2], 2);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    b.add(key, geo, cx + Math.cos(a) * radius, cy + size[1] / 2, cz + Math.sin(a) * radius, -a + Math.PI / 2);
  }
}

/** Merlons along a straight wall top from (x0,z0) to (x1,z1). */
export function merlonLine(b, key, x0, z0, x1, z1, y, spacing = 2.4, size = [1.3, 1.4, 0.7]) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.floor(len / spacing));
  const ang = -Math.atan2(z1 - z0, x1 - x0);
  const geo = boxGeo(size[0], size[1], size[2], 2);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    b.add(key, geo, x0 + (x1 - x0) * t, y + size[1] / 2, z0 + (z1 - z0) * t, ang);
  }
}

/** A sheep, facing +z; `head` nods down to graze. */
export function sheep(M) {
  const g = new THREE.Group();
  const add = (geo, m, parent = g) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; parent.add(o); return o; };
  add(new THREE.SphereGeometry(0.36, 12, 9).scale(0.85, 0.75, 1.15).translate(0, 0.62, 0), M.clothIvory);
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0.38);
  g.add(head);
  add(boxGeo(0.17, 0.2, 0.3).translate(0, 0, 0.12), M.gear, head);
  for (const x of [-0.11, 0.11]) add(boxGeo(0.12, 0.04, 0.07).translate(x, 0.05, 0.02), M.gear, head);
  for (const [x, z] of [[-0.14, -0.22], [0.14, -0.22], [-0.14, 0.22], [0.14, 0.22]]) add(boxGeo(0.07, 0.36, 0.07).translate(x, 0.18, z), M.gear);
  return { g, head };
}
