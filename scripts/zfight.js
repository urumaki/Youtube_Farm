// Owner 2026-11-07 ("some walls flicker"): finds the faces of the buildings that lie in the same plane as another part's
// face and overlap it (z-fighting: the two surfaces flicker in the video). Builds every building of buildings.js with a
// recording Builder and lists, per building, each pair of parts with a shared face, where it is and how big.
//   node scripts/zfight.js [building ...]
import * as THREE from 'three';
import { Builder } from '../src/render/scene/kit.js';
import { BUILD } from '../src/render/scene/buildings.js';

const only = process.argv.slice(2);
const parts = [];
const addM = Builder.prototype.addM;
Builder.prototype.addM = function (key, geo, matrix) {
  addM.call(this, key, geo, matrix);
  const g = this.parts.get(key).at(-1);
  parts.push({ key, g });
  return this;
};

/** The faces of a part that look along an axis: { plane: 'x+:1.250', rect: [u0, u1, v0, v1] } per triangle. */
function faces(g) {
  const p = g.attributes.position, out = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i + 2 < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    n.subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    const ax = ['x', 'y', 'z'].find((k) => Math.abs(n[k]) > 0.999);
    if (!ax) continue;
    const [u, v] = ['x', 'y', 'z'].filter((k) => k !== ax);
    const sign = Math.sign(n[ax]) > 0 ? '+' : '-';
    const k0 = Math.round(a[ax] * 2000) / 2000;
    out.push({ plane: `${ax}${sign}:${k0.toFixed(3)}`, rect: [Math.min(a[u], b[u], c[u]), Math.max(a[u], b[u], c[u]), Math.min(a[v], b[v], c[v]), Math.max(a[v], b[v], c[v])] });
  }
  return out;
}
const overlap = (r, s) => Math.max(0, Math.min(r[1], s[1]) - Math.max(r[0], s[0])) * Math.max(0, Math.min(r[3], s[3]) - Math.max(r[2], s[2]));

let total = 0;
for (const [id, fn] of Object.entries(BUILD)) {
  if (only.length && !only.includes(id)) continue;
  parts.length = 0;
  const b = new Builder();
  const out = { smoke: [], lights: [], flags: [], banners: [], focusH: 6 };
  const ctx = { built: new Set(), boats: [], sails: [], lamps: [], lampsWorld: [], noble: 'Test' };
  try { fn(b, { id, hw: 10, hd: 10, rot: 0 }, out, ctx); } catch (e) { console.log(`${id}: skipped (${e.message.slice(0, 60)})`); continue; }
  const fs = parts.map((x) => ({ key: x.key, f: faces(x.g) }));
  const found = new Map();
  for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
    for (const fa of fs[i].f) for (const fb of fs[j].f) {
      if (fa.plane !== fb.plane) continue;
      const o = overlap(fa.rect, fb.rect);
      if (o < 1e-3) continue;
      const k = `${i}:${j}:${fa.plane}`;
      found.set(k, { a: fs[i].key, b: fs[j].key, i, j, plane: fa.plane, area: (found.get(k)?.area || 0) + o });
    }
  }
  if (!found.size) continue;
  console.log(`${id}:`);
  for (const f of found.values()) { total++; console.log(`  part ${f.i} (${f.a}) and part ${f.j} (${f.b}) share ${f.plane}, ${f.area.toFixed(3)} m2`); }
}
console.log(`${total} shared faces`);
