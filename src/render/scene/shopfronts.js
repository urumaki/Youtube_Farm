// Shop fronts (owner 2026-11-25): the trades with no workplace of their own work at a shop front on the street side of a
// house (src/sim/shops.js says which houses). A lean-to roof on two poles, a sign hung out over the street, and each trade's
// own things; the worker stands at `userData.counter`, facing the street. The tax collector's is a timber booth with a barred
// window over its counter and two guards with spears, one each side of it (the same booth stands at the Counting House).
// Frame: the shop's front middle at (0, 0, 0) on the ground, the street toward +z, the house wall at z = -1.6.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boxGeo, cylGeo } from './kit.js';
import { rig, toolGeo } from './work.js';
import { JOBS } from '../../sim/tiers.js';

export const SHOP_KINDS = ['carpenter', 'taxcollector', 'cook', 'barber', 'brewer', 'weaver'];
const WALL = -1.6, HW = 1.6; // the house wall behind, the half width

const flat = (g) => { const q = g.index ? g.toNonIndexed() : g; if (q.attributes.uv) q.deleteAttribute('uv'); return q; };

/** A shop front of `kind`: a group with userData.counter (where the worker stands) and, for the tax booth, userData.guards. */
export function shopFront(kind, M) {
  const parts = new Map(); // material -> geometries, merged at the end (a few meshes a shop: there are dozens in town)
  const put = (geo, mat) => { if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(flat(geo)); };
  const g = new THREE.Group();
  const booth = kind === 'taxcollector';
  // the lean-to: a sloping roof from the wall out over the front, on two posts; a beam along the wall
  put(boxGeo(2 * HW + 0.3, 0.08, -WALL + 0.5).rotateX(-0.22).translate(0, 2.45, (WALL + 0.25) / 2), M.woodDark);
  for (const s of [-1, 1]) put(boxGeo(0.12, 2.35, 0.12).translate(s * HW, 1.17, 0.1), M.woodDark);
  put(boxGeo(2 * HW + 0.2, 0.16, 0.18).translate(0, 2.62, WALL + 0.05), M.woodDark);
  // the sign on an iron arm out over the street, at the right-hand post
  put(boxGeo(0.05, 0.05, 0.7).translate(HW, 2.25, 0.4), M.iron);
  const sign = (geo, mat) => put(geo.translate(HW, 1.95, 0.7), mat);
  const counter = new THREE.Vector3(0, 0, -0.85);
  if (booth) {
    // a timber booth: side walls and a front wall up to the counter, iron bars from the counter to the roof, a coin sign
    for (const s of [-1, 1]) put(boxGeo(0.1, 2.3, -WALL).translate(s * (HW - 0.1), 1.15, WALL / 2), M.wood);
    put(boxGeo(2 * HW - 0.2, 1.0, 0.1).translate(0, 0.5, 0), M.wood);
    put(boxGeo(2 * HW, 0.08, 0.4).translate(0, 1.04, 0.05), M.woodDark); // the counter's ledge
    for (let x = -HW + 0.3; x <= HW - 0.29; x += 0.22) put(cylGeo(0.018, 0.018, 1.25, 5).translate(x, 1.7, 0), M.iron);
    put(boxGeo(2 * HW - 0.2, 0.08, 0.08).translate(0, 2.33, 0), M.woodDark);
    for (const x of [-1.0, 1.0]) put(new THREE.SphereGeometry(0.14, 8, 6).scale(1, 1.2, 1).translate(x, 1.2, 0.08), M.cloth); // sacks left on the counter
    sign(cylGeo(0.3, 0.3, 0.06, 16).rotateZ(Math.PI / 2), M.gold);
    counter.set(0, 0, -1.0);
    g.userData.guards = [[-HW - 0.45, 0.35], [HW + 0.45, 0.35]];
  } else if (kind === 'carpenter') {
    // an open shed: planks leaning on the wall, a rack of tools, offcuts; the bench is the scene's own
    for (let i = 0; i < 5; i++) put(boxGeo(0.22, 2.0, 0.05).rotateX(0.18).translate(-HW + 0.35 + i * 0.26, 1.0, WALL + 0.25), M.wood);
    put(boxGeo(1.0, 0.06, 0.12).translate(0.9, 1.6, WALL + 0.08), M.woodDark);
    for (let i = 0; i < 3; i++) put(boxGeo(0.04, 0.4, 0.03).translate(0.6 + i * 0.3, 1.38, WALL + 0.12), M.iron);
    sign(boxGeo(0.06, 0.18, 0.6), M.wood);
  } else if (kind === 'cook') {
    // a cookshop: a shelf of bowls on the wall, a bench, a pot-shaped sign
    put(boxGeo(1.6, 0.05, 0.3).translate(-0.6, 1.5, WALL + 0.16), M.woodDark);
    for (let i = 0; i < 5; i++) put(cylGeo(0.1, 0.06, 0.07, 8).translate(-1.2 + i * 0.3, 1.56, WALL + 0.16), M.clay);
    put(boxGeo(1.2, 0.08, 0.35).translate(-HW + 0.7, 0.45, 0.6), M.wood);
    sign(cylGeo(0.2, 0.14, 0.26, 10), M.iron);
  } else if (kind === 'barber') {
    // the barber's pole, red and white bands, a basin on a stand, a towel on the wall
    for (let i = 0; i < 8; i++) put(cylGeo(0.06, 0.06, 0.22, 8).translate(-HW - 0.05, 0.55 + i * 0.22, 0.25), i % 2 ? M.clothIvory : M.clothRed);
    put(cylGeo(0.2, 0.16, 0.1, 12).translate(-1.0, 0.95, WALL + 0.35), M.clay);
    put(cylGeo(0.03, 0.03, 0.9, 6).translate(-1.0, 0.45, WALL + 0.35), M.woodDark);
    put(boxGeo(0.4, 0.6, 0.03).translate(0.9, 1.5, WALL + 0.03), M.clothIvory);
    sign(cylGeo(0.12, 0.12, 0.05, 12).rotateZ(Math.PI / 2), M.clay);
  } else if (kind === 'brewer') {
    // barrels along the wall, a tankard on the sign
    for (let i = 0; i < 3; i++) put(cylGeo(0.3, 0.3, 0.8, 12).rotateZ(Math.PI / 2).translate(-1.0 + i * 0.66, 0.3, WALL + 0.35), M.wood);
    put(cylGeo(0.3, 0.3, 0.8, 12).rotateZ(Math.PI / 2).translate(-0.67, 0.82, WALL + 0.35), M.wood);
    sign(cylGeo(0.12, 0.11, 0.24, 10), M.wood);
  } else if (kind === 'weaver') {
    // a loom under the roof, skeins hung on the wall
    for (const s of [-1, 1]) put(boxGeo(0.08, 1.5, 0.08).translate(-0.9 + s * 0.5, 0.75, -0.4), M.woodDark);
    put(boxGeo(1.08, 0.06, 0.06).translate(-0.9, 1.45, -0.4), M.woodDark);
    put(boxGeo(0.9, 1.0, 0.01).translate(-0.9, 0.9, -0.4), M.clothBlue);
    for (let i = 0; i < 4; i++) put(new THREE.TorusGeometry(0.1, 0.04, 5, 10).translate(0.4 + i * 0.28, 1.5, WALL + 0.06), i % 2 ? M.clothRed : M.clothIvory);
    sign(new THREE.TorusGeometry(0.15, 0.05, 6, 12).rotateY(Math.PI / 2), M.clothRed);
    counter.set(0.5, 0, -0.85);
  }
  for (const [mat, geos] of parts) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  for (const [x, z] of g.userData.guards || []) g.add(guard(M, x, z));
  g.userData.counter = counter;
  g.userData.kind = kind;
  return g;
}

/** A guard with a spear, standing by a counter facing the street (owner 2026-11-25: two at every tax counter). */
export function guard(M, x, z) {
  const P = rig(M, JOBS.guard.color);
  const spear = toolGeo('spear', M);
  P.r.hand.add(spear);
  P.r.g.rotation.set(-0.35, 0, 0.12);
  P.r.elbow.rotation.x = -1.2;
  P.root.position.set(x, 0, z);
  return P.root;
}
