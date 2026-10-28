// Unlockable buildings on their reserved lots. Each builder works in lot-local coordinates
// (x along the lot, z across, y up from the leveled foundation) and returns focus/smoke/light points.
import * as THREE from 'three';
import { Builder, boxGeo, cylGeo, gableGeo, pyramidGeo, lancetGeo, merlonLine, merlonRing } from './kit.js';
import { heightAt, WATER_LEVEL, CASTLE } from '../../sim/world.js';
import { rand01 } from '../../sim/prng.js';
import { planWall2, wallLayout } from '../../sim/wall.js';
import { awningTexture, ROYAL } from './textures.js';

const STALL_COLORS = [['#9b1b30', '#f3ead2'], ['#1d2f6f', '#f3ead2'], ['#2f6b3a', '#efe2b8'], ['#c27a1d', '#f6ecd0'], ['#5b2a86', '#efe6d2'], ['#9b1b30', '#e3b23c']];

function lotFrame(w, lot) {
  const c = Math.cos(lot.rot), s = Math.sin(lot.rot);
  let lo = Infinity, hi = -Infinity;
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
    const h = heightAt(w, lot.x + c * u * lot.hw - s * v * lot.hd, lot.z + s * u * lot.hw + c * v * lot.hd);
    lo = Math.min(lo, h); hi = Math.max(hi, h);
  }
  const base = lot.onWater ? Math.max(hi, WATER_LEVEL + 1.4) : hi + 0.08;
  const m = new THREE.Matrix4().compose(new THREE.Vector3(lot.x, base, lot.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -lot.rot, 0)), new THREE.Vector3(1, 1, 1));
  return { base, lo, m };
}

// structures inside a square stand on the square's paving: the square's frame moved to the spot (and turned by the lot's own
// rot: the Bank faces the fountain)
function plazaFrame(w, parent, lot) {
  const f = lotFrame(w, parent);
  const c = Math.cos(-parent.rot), s = Math.sin(-parent.rot), dx = lot.x - parent.x, dz = lot.z - parent.z;
  const m = f.m.clone().multiply(new THREE.Matrix4().makeTranslation(dx * c - dz * s, 0.05, dx * s + dz * c)).multiply(new THREE.Matrix4().makeRotationY(-((lot.rot ?? 0) - parent.rot)));
  return { base: f.base + 0.05, lo: f.base, m };
}

// ------------------------------------------------------------------ small helpers
function house(b, x, z, w, d, h, { roof = 'roofRed', wall = 'timber', ry = 0, roofH = d * 0.6 } = {}) {
  b.add(wall, boxGeo(w, h, d, 4), x, h / 2, z, ry);
  b.add(roof, gableGeo(w + 0.8, d + 1, roofH), x, h, z, ry);
}
function windowsRow(b, x0, x1, y, z, n, key = 'window', ry = 0, size = [1, 1.3]) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const lx = x0 + (x1 - x0) * t;
    const c = Math.cos(ry), s = Math.sin(ry);
    b.add(key, boxGeo(size[0], size[1], 0.2), lx * c + z * s, y, -lx * s + z * c, ry);
  }
}
// Owner 2026-10-27 (the Cathedral had no door or windows on the side the shots see): doors and pointed windows with a
// frame round them. (x, z) is the middle of the opening on the wall's face, ry the way the wall faces (0: +z, PI/2: +x).
function door(b, x, z, w, h, ry = 0, { pointed = false, frame = 'stoneDark' } = {}) {
  const shape = (ww, hh, d) => (pointed ? lancetGeo(ww, hh, d) : boxGeo(ww, hh, d).translate(0, hh / 2, 0));
  b.add(frame, shape(w + 0.45, h + 0.3, 0.26), x, 0, z, ry);
  b.add('woodDark', shape(w, h, 0.34), x, 0, z, ry);
  for (const y of [h * 0.28, h * 0.62]) b.add('iron', boxGeo(w * 0.8, 0.08, 0.38), x, y, z, ry); // the iron straps
}
function lancet(b, x, y, z, w, h, ry = 0, key = 'stained') {
  b.add('stoneDark', lancetGeo(w + 0.4, h + 0.3, 0.3), x, y - 0.15, z, ry);
  b.add(key, lancetGeo(w, h, 0.36), x, y, z, ry);
  b.add('stoneDark', boxGeo(0.1, h * 0.75, 0.4).translate(0, h * 0.375, 0), x, y, z, ry); // the mullion up the middle
}
/** A round (rose) window of stained glass in a stone ring with spokes, on a wall facing ry. */
function rose(b, x, y, z, r, ry = 0) {
  b.add('stained', cylGeo(r, r, 0.36, 24).rotateX(Math.PI / 2), x, y, z, ry);
  b.add('stoneDark', new THREE.TorusGeometry(r + 0.12, 0.2, 6, 28), x, y, z, ry);
  b.add('stoneDark', cylGeo(r * 0.22, r * 0.22, 0.42, 12).rotateX(Math.PI / 2), x, y, z, ry);
  for (let k = 0; k < 8; k++) b.add('stoneDark', boxGeo(0.1, r * 2, 0.4).rotateZ((k * Math.PI) / 8), x, y, z, ry);
}

// drop: how far the ground falls below the lot's level, so poles always reach the earth
function scaffoldAround(b, hw, hd, h, drop = 0) {
  const pole = cylGeo(0.1, 0.1, h + drop, 6);
  const py = (h - drop) / 2;
  for (let x = -hw; x <= hw + 0.01; x += Math.max(2, (2 * hw) / 6)) for (const z of [-hd, hd]) b.add('wood', pole, x, py, z);
  for (let z = -hd; z <= hd + 0.01; z += Math.max(2, (2 * hd) / 4)) for (const x of [-hw, hw]) b.add('wood', pole, x, py, z);
  for (let y = 3; y < h; y += 3.2) {
    b.add('wood', boxGeo(2 * hw, 0.12, 0.9), 0, y, -hd); b.add('wood', boxGeo(2 * hw, 0.12, 0.9), 0, y, hd);
    b.add('wood', boxGeo(0.9, 0.12, 2 * hd), -hw, y, 0); b.add('wood', boxGeo(0.9, 0.12, 2 * hd), hw, y, 0);
  }
}
function crane(b, x, z, h, drop = 0) {
  b.add('woodDark', boxGeo(0.5, h + drop, 0.5), x, (h - drop) / 2, z);
  b.add('woodDark', boxGeo(h * 0.6, 0.4, 0.4), x + h * 0.2, h - 0.4, z);
  b.add('iron', cylGeo(0.03, 0.03, h * 0.5, 4), x + h * 0.45, h * 0.72, z);
  b.add('stoneDark', boxGeo(1.2, 0.8, 1.2), x + h * 0.45, h * 0.45, z);
}
function tower(b, x, z, r, h, roofH, key = 'stone') {
  b.add(key, cylGeo(r, r * 1.08, h, 18), x, h / 2, z);
  b.add('stoneDark', cylGeo(r + 0.4, r, 0.6, 18), x, h + 0.3, z);
  if (roofH) b.add('slate', cylGeo(0.05, r + 0.6, roofH, 18, 2), x, h + 0.6 + roofH / 2, z);
  else merlonRing(b, 'stone', x, h + 0.6, z, r, Math.round(r * 2.5), [1, 1.2, 0.6]);
}
function lanterns(list, pts) { for (const p of pts) list.push(new THREE.Vector3(...p)); }

// ------------------------------------------------------------------ the buildings
const BUILD = {
  well(b, lot, out) {
    b.add('stone', cylGeo(1.5, 1.6, 1.2, 18), 0, 0.6, 0);
    b.add('woodDark', boxGeo(0.25, 3.2, 0.25), -1.3, 1.6, 0); b.add('woodDark', boxGeo(0.25, 3.2, 0.25), 1.3, 1.6, 0);
    b.add('woodDark', cylGeo(0.12, 0.12, 2.8, 8).rotateZ(Math.PI / 2), 0, 2.6, 0);
    b.add('roofRed', gableGeo(3.6, 2.4, 1.3), 0, 3.1, 0);
    b.add('wood', cylGeo(0.3, 0.25, 0.45, 10), 0.4, 1.6, 0);
    out.focusH = 4;
  },
  sawmill(b, lot, out) {
    house(b, -2.5, 0, 10, 7, 4.2, { roof: 'roofRed', wall: 'timber' });
    door(b, -3.6, 3.52, 2.2, 2.8, 0, { frame: 'woodDark' }); // the wide door for the logs (owner 2026-10-27: doors, windows)
    for (const z of [3.56, -3.56]) windowsRow(b, -6.4, -0.6, 2.4, z, z > 0 ? 2 : 3);
    b.add('woodDark', boxGeo(6, 0.3, 6), 6, 3.6, 0);
    for (const [x, z] of [[3.3, -2.7], [8.7, -2.7], [3.3, 2.7], [8.7, 2.7]]) b.add('woodDark', boxGeo(0.3, 3.6, 0.3), x, 1.8, z);
    b.add('thatch', gableGeo(6.8, 7, 1.6), 6, 3.7, 0);
    b.add('wood', boxGeo(5, 0.8, 1.0), 6, 0.9, 0);
    for (let i = 0; i < 9; i++) {
      const row = i < 4 ? 0 : i < 7 ? 1 : 2, k = i < 4 ? i : i < 7 ? i - 4 : i - 7;
      b.add('wood', cylGeo(0.35, 0.35, 6, 8).rotateX(Math.PI / 2), -4 + k * 0.72 + row * 0.36, 0.35 + row * 0.62, 6.2);
    }
    out.focusH = 6;
  },
  dock(b, lot, out, ctx) {
    // owner 2026-10-27 (the pier stood out in the river, cut off from the bank): the pier runs from the bank, where the
    // ground reaches its deck, straight out over the water, on piles down to the river bed. The lot stays where it was
    // (plots and roads depend on it); the pier finds the land side from the ground around it
    const g = (x, z) => { const p = new THREE.Vector3(x, 0, z).applyMatrix4(ctx.frame.m); return heightAt(ctx.w, p.x, p.z); };
    const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const [lx, lz] = sides.reduce((best, s) => (g(s[0] * 14, s[1] * 14) > g(best[0] * 14, best[1] * 14) ? s : best));
    const dx = -lx, dz = -lz, ry = Math.atan2(dx, dz); // out over the water
    const at = (u, v = 0) => [u * dx + v * dz, u * dz - v * dx]; // u along the pier (toward the water), v across it
    const deck = ctx.frame.base + 0.75;
    let land = 0;
    while (land > -30 && g(...at(land)) < deck - 0.25) land -= 0.5;
    const u0 = land - 1.5, u1 = 9, len = u1 - u0, mid = (u0 + u1) / 2;
    b.add('wood', boxGeo(3.4, 0.3, len, 2), at(mid)[0], 0.6, at(mid)[1], ry);
    for (const v of [-1.6, 1.6]) b.add('woodDark', boxGeo(0.12, 0.8, len - 1), at(mid + 0.5, v)[0], 1.1, at(mid + 0.5, v)[1], ry);
    for (let u = u1 - 0.4; u > land; u -= 3) for (const v of [-1.4, 1.4]) {
      const [x, z] = at(u, v), bed = g(x, z) - ctx.frame.base; // piles from the deck down into the river bed
      b.add('woodDark', cylGeo(0.18, 0.2, 0.6 - bed + 0.5, 6), x, (0.6 + bed - 0.5) / 2, z);
    }
    // a stone abutment where the pier meets the bank, sunk into it
    const ab = at(land - 0.5);
    b.add('stone', boxGeo(4.2, 3.0, 2.4), ab[0], 0.6 - 1.5 + 0.15, ab[1], ry);
    const [cx, cz] = at(u1 - 3, 0.6);
    b.add('wood', boxGeo(1.4, 0.7, 1.0), cx, 1.1, cz, ry); // a crate on the deck
    for (const [u, v, r] of [[u1 - 4, -3.7, 0.12], [u1 - 8, 3.8, -0.1]]) { const [x, z] = at(u, v); ctx.boats.push({ x, z, r: -ry + r, len: 5, sail: false }); }
    out.pier = { origin: at(u1 - 10), dir: [dx, dz], reach: 10 }; // for the fisherman (main.js dockPier): 10 m out to the end
    out.focusH = 3;
  },
  forge(b, lot, out) {
    b.add('stoneDark', boxGeo(10, 5, 8), 0, 2.5, 0);
    b.add('slate', gableGeo(10.8, 9, 3.4), 0, 5, 0);
    b.add('stone', boxGeo(1.8, 10, 1.8), 3.2, 5, -1.5);
    b.add('ember', boxGeo(3.2, 2.6, 0.2), -1.5, 1.5, 4.05);
    door(b, 1.9, 4.02, 1.2, 2.3); // the smith's door beside the hearth
    windowsRow(b, -3, 2.5, 2.6, -4.06, 2);
    windowsRow(b, -2.2, 2.2, 2.6, 5.06, 2, 'window', Math.PI / 2);
    b.add('iron', boxGeo(1.0, 0.6, 0.5), -1.5, 0.95, 5.6); b.add('stoneDark', boxGeo(0.5, 0.6, 0.5), -1.5, 0.3, 5.6);
    // the awning over the yard: a slate lean-to from the wall down onto a beam on two posts
    b.add('slate', boxGeo(4.4, 0.15, 2.3).rotateX(0.28), 1.6, 3.45, 5.05);
    b.add('woodDark', boxGeo(4.2, 0.25, 0.25), 1.6, 3.08, 5.9);
    for (const x of [-0.2, 3.4]) b.add('woodDark', boxGeo(0.2, 3.2, 0.2), x, 1.6, 5.9);
    out.smoke.push([3.2, 10.6, -1.5, 'dark']);
    out.lights.push([-1.5, 1.6, 4.6]);
    out.focusH = 7;
  },
  bakery(b, lot, out) {
    house(b, -1.5, -0.5, 9, 7, 5, { roof: 'roofTileWarm', wall: 'plaster' });
    windowsRow(b, -5, 1.5, 2.2, 3.06, 2, 'windowWarm');
    door(b, -1.75, 3.02, 1.3, 2.4, 0, { frame: 'woodDark' });
    windowsRow(b, -4.5, 1.5, 2.2, -4.06, 2, 'windowWarm');
    b.add('stone', new THREE.SphereGeometry(2.0, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 4.8, 0, 1.5);
    b.add('ember', boxGeo(1.0, 0.8, 0.2), 4.8, 0.5, 3.5);
    b.add('stone', boxGeo(0.8, 3.2, 0.8), 4.8, 3.2, 0.9);
    b.add('woodDark', boxGeo(0.1, 1.0, 1.4), -5.95, 3.4, 1.5);
    out.smoke.push([4.8, 5.0, 0.9]);
    out.lights.push([4.8, 0.6, 3.8]);
    out.focusH = 6;
  },
  quarry(b, lot, out) {
    for (let i = 0; i < 4; i++) b.add('rock', boxGeo(34 - i * 7, 1.6, 22 - i * 4, 3), i * 1.2, -0.6 - i * 1.5, 0);
    for (let i = 0; i < 10; i++) b.add('stone', boxGeo(1.6, 1.0, 1.0, 1), -12 + (i % 5) * 1.8, 0.5 + Math.floor(i / 5), 9);
    crane(b, 8, 6, 9);
    out.focusH = 4;
  },
  market(b, lot, out, ctx) {
    // stalls in two rows facing the road (the road crosses the square, so its centre stays clear)
    let i = 0;
    for (const side of [-1, 1]) for (const x of [-15, -5, 5, 15]) {
      const z = side * 10.5, ry = side > 0 ? Math.PI : 0;
      const key = 'awning' + (i++ % STALL_COLORS.length);
      b.add('wood', boxGeo(3.4, 1.0, 1.6), x, 0.5, z, ry);
      for (const [lx, lz] of [[-1.6, -0.8], [1.6, -0.8], [-1.6, 0.8], [1.6, 0.8]]) b.add('woodDark', boxGeo(0.12, 2.6, 0.12), x + lx, 1.3, z + lz);
      b.add(key, gableGeo(3.8, 2.6, 0.7), x, 2.5, z + side * 0.3, ry);
      b.add('wood', boxGeo(0.7, 0.6, 0.7), x + 1.1, 0.3, z + side * 1.6, 0.3);
      b.add('wood', cylGeo(0.35, 0.3, 0.8, 10), x - 1.2, 0.4, z + side * 1.5);
      ctx.lamps.push([x + 1.9, 2.6, z - side * 0.9]);
    }
    // market cross with the arms, on the north side of the square
    const cz = -15.5;
    b.add('stone', cylGeo(2.4, 2.6, 0.6, 16), 0, 0.3, cz);
    b.add('stone', cylGeo(1.6, 1.8, 0.5, 16), 0, 0.85, cz);
    b.add('stone', boxGeo(0.6, 5, 0.6), 0, 3.6, cz);
    b.add('stone', boxGeo(2.2, 0.5, 0.5), 0, 5.2, cz);
    b.add('gold', new THREE.SphereGeometry(0.35, 10, 8), 0, 6.3, cz);
    if (ctx.built.has('charter_stone')) {
      b.add('stone', boxGeo(1.4, 6, 1.4), 8, 3, 15.5); b.add('gold', pyramidGeo(1.5, 1.5, 1.2), 8, 6, 15.5);
      b.add('arms', new THREE.PlaneGeometry(1.2, 1.5), 8, 3.6, 14.78);
    }
    out.focusH = 6;
  },
  crier_stand(b, lot, out) {
    // a low wooden stand with steps, a bell on a post and a notice board
    b.add('wood', boxGeo(2.6, 0.7, 2.6), 0, 0.35, 0);
    b.add('woodDark', boxGeo(2.8, 0.1, 2.8), 0, 0.72, 0);
    for (let i = 0; i < 2; i++) b.add('wood', boxGeo(1.2, 0.23, 0.4), 0, 0.12 + i * 0.23, 1.5 - i * 0.02 + 0.2 * (1 - i));
    b.add('woodDark', boxGeo(0.18, 3.2, 0.18), -1.1, 2.3, -1.1);
    b.add('woodDark', boxGeo(1.0, 0.14, 0.14), -0.7, 3.8, -1.1);
    b.add('gold', cylGeo(0.08, 0.26, 0.38, 12), -0.35, 3.52, -1.1);
    b.add('woodDark', boxGeo(0.12, 1.9, 0.12), 0.9, 1.65, -1.25); b.add('woodDark', boxGeo(0.12, 1.9, 0.12), 1.9, 1.65, -1.25);
    b.add('wood', boxGeo(1.4, 1.0, 0.08), 1.4, 2.1, -1.25);
    for (const [x, y] of [[1.1, 2.25], [1.6, 2.0], [1.45, 2.35]]) b.add('ivory', boxGeo(0.34, 0.42, 0.02), x, y, -1.2);
    out.flags.push([-1.1, 3.95, -1.1, 0.9, 0.6]);
    out.focusH = 2.4;
  },
  pillory(b, lot, out) {
    // a raised wooden platform with the pillory, a chopping block (with a cabbage) and a basket
    b.add('wood', boxGeo(5, 1.0, 3.2), 0, 0.5, 0);
    b.add('woodDark', boxGeo(5.2, 0.1, 3.4), 0, 1.02, 0);
    for (let i = 0; i < 3; i++) b.add('wood', boxGeo(1.3, 0.33, 0.45), 1.6, 0.17 + i * 0.33, 1.95 - i * 0.22 + 0.2);
    for (const x of [-2.2, -0.8]) b.add('woodDark', boxGeo(0.2, 2.0, 0.2), x, 2.0, -0.6);
    b.add('wood', boxGeo(1.6, 0.36, 0.22), -1.5, 2.3, -0.6);
    for (const x of [-1.95, -1.5, -1.05]) b.add('stoneDark', cylGeo(x === -1.5 ? 0.13 : 0.08, x === -1.5 ? 0.13 : 0.08, 0.24, 10).rotateX(Math.PI / 2), x, 2.3, -0.6);
    b.add('wood', cylGeo(0.42, 0.48, 0.6, 12), 1.0, 1.35, -0.3);
    b.add('greens', new THREE.SphereGeometry(0.2, 10, 8), 1.0, 1.82, -0.3);
    b.add('woodDark', boxGeo(0.06, 0.9, 0.06).rotateZ(0.5), 1.35, 1.95, -0.3);
    b.add('wood', cylGeo(0.4, 0.32, 0.4, 12), -0.1, 1.25, 0.9);
    for (const [x, z] of [[-0.2, 0.85], [0.05, 0.95], [-0.1, 1.05]]) b.add('greens', new THREE.SphereGeometry(0.16, 8, 6), x, 1.5, z);
    out.flags.push([2.3, 2.2, -1.4, 0.8, 0.5]);
    out.focusH = 2.6;
  },
  tailor_stall(b, lot, out) {
    // a stall under a purple awning: bolts of cloth on the counter, a cloak on a dress form, cloth hanging
    b.add('wood', boxGeo(3.0, 0.9, 1.2), 0, 0.45, 0.3);
    for (const [x, z] of [[-1.5, -0.6], [1.5, -0.6], [-1.5, 1.0], [1.5, 1.0]]) b.add('woodDark', boxGeo(0.12, 2.6, 0.12), x, 1.3, z);
    b.add('awning4', gableGeo(3.6, 2.2, 0.7), 0, 2.6, 0.2);
    for (const [x, m] of [[-1.0, 'clothRed'], [-0.45, 'clothBlue'], [0.1, 'ivory'], [0.65, 'clothRed']]) b.add(m, cylGeo(0.17, 0.17, 0.9, 10).rotateX(Math.PI / 2), x, 1.07, 0.3);
    b.add('woodDark', boxGeo(0.08, 1.2, 0.08), 2.3, 0.6, -0.4); // the dress form: a post, a body, a cloak
    b.add('wood', cylGeo(0.22, 0.28, 0.7, 10), 2.3, 1.45, -0.4);
    b.add('clothRed', cylGeo(0.3, 0.5, 1.1, 10, 1), 2.3, 1.15, -0.4);
    for (const [x, m] of [[-1.0, 'clothBlue'], [0.2, 'ivory'], [1.0, 'clothRed']]) b.add(m, boxGeo(0.5, 0.9, 0.02), x, 1.95, -0.6);
    out.focusH = 1.8;
  },
  physician_booth(b, lot, out) {
    // a booth under a green awning: jars of remedies on the counter, herbs drying above, a bench for patients
    b.add('wood', boxGeo(3.4, 0.9, 1.1), 0, 0.45, 0.3);
    for (const [x, z] of [[-1.7, -0.6], [1.7, -0.6], [-1.7, 1.0], [1.7, 1.0]]) b.add('woodDark', boxGeo(0.12, 2.6, 0.12), x, 1.3, z);
    b.add('awning2', gableGeo(4.0, 2.2, 0.7), 0, 2.6, 0.2);
    for (let i = 0; i < 7; i++) b.add(i % 3 ? 'clay' : 'stoneDark', cylGeo(0.09, 0.11, 0.24 + (i % 2) * 0.1, 8), -1.3 + i * 0.4, 1.05, 0.2 + (i % 2) * 0.25);
    b.add('woodDark', boxGeo(3.4, 0.06, 0.06), 0, 2.2, -0.55); // the pole the herbs dry on
    for (let i = 0; i < 6; i++) b.add('greens', new THREE.ConeGeometry(0.12, 0.4, 6).rotateX(Math.PI), -1.4 + i * 0.56, 1.95, -0.55);
    b.add('wood', boxGeo(1.8, 0.45, 0.4), 0.4, 0.22, -1.4); // the bench
    out.focusH = 1.8;
  },
  // goals added 2026-10-22
  potter_stall(b, lot, out) {
    // an orange awning over shelves of jugs and bowls, a wheel at the side
    b.add('wood', boxGeo(2.6, 0.9, 1.0), 0, 0.45, 0.3);
    for (const [x, z] of [[-1.3, -0.5], [1.3, -0.5], [-1.3, 0.9], [1.3, 0.9]]) b.add('woodDark', boxGeo(0.12, 2.5, 0.12), x, 1.25, z);
    b.add('awning3', gableGeo(3.2, 2.0, 0.65), 0, 2.5, 0.2);
    for (let i = 0; i < 5; i++) b.add('clay', new THREE.SphereGeometry(0.17, 10, 8).scale(1, 1.25 + (i % 2) * 0.4, 1), -1.0 + i * 0.5, 1.12, 0.3);
    b.add('woodDark', boxGeo(2.4, 0.06, 0.4), 0, 1.7, -0.45);
    for (let i = 0; i < 6; i++) b.add('clay', cylGeo(0.12, 0.08, 0.16, 10), -1.0 + i * 0.4, 1.81, -0.45);
    b.add('wood', cylGeo(0.35, 0.35, 0.06, 16), 1.9, 0.62, 0.5); b.add('woodDark', boxGeo(0.5, 0.58, 0.5), 1.9, 0.29, 0.5);
    out.focusH = 1.8;
  },
  cobbler_stall(b, lot, out) {
    // a red awning over a counter of shoes and boots, a pair hanging from the front beam
    b.add('wood', boxGeo(2.6, 0.9, 1.0), 0, 0.45, 0.3);
    for (const [x, z] of [[-1.3, -0.5], [1.3, -0.5], [-1.3, 0.9], [1.3, 0.9]]) b.add('woodDark', boxGeo(0.12, 2.5, 0.12), x, 1.25, z);
    b.add('awning0', gableGeo(3.2, 2.0, 0.65), 0, 2.5, 0.2);
    for (let i = 0; i < 4; i++) for (const s of [-0.09, 0.09]) b.add('woodDark', boxGeo(0.14, 0.1 + (i % 2) * 0.22, 0.32), -0.9 + i * 0.6 + s, 0.95 + (i % 2) * 0.11, 0.3);
    for (const s of [-0.12, 0.12]) b.add('woodDark', boxGeo(0.14, 0.4, 0.14), 0.5 + s, 1.95, -0.5);
    out.focusH = 1.8;
  },
  cooperage(b, lot, out) {
    // an open shed with barrels stacked under it, hoops on the wall, a half-made barrel in front
    for (const [x, z] of [[-3.2, -2], [3.2, -2], [-3.2, 2], [3.2, 2]]) b.add('woodDark', boxGeo(0.25, 3.2, 0.25), x, 1.6, z);
    b.add('wood', boxGeo(7.0, 3.2, 0.2), 0, 1.6, 2.1);
    b.add('roofRed', gableGeo(7.6, 5.0, 1.6), 0, 3.2, 0);
    for (let i = 0; i < 3; i++) b.add('wood', cylGeo(0.5, 0.5, 1.1, 14).rotateZ(Math.PI / 2), -2.2 + i * 1.05, 0.5, 1.2);
    for (let i = 0; i < 2; i++) b.add('wood', cylGeo(0.5, 0.5, 1.1, 14).rotateZ(Math.PI / 2), -1.7 + i * 1.05, 1.4, 1.2);
    for (let i = 0; i < 3; i++) b.add('iron', new THREE.TorusGeometry(0.5, 0.03, 4, 16), 1.6 + i * 0.5, 2.1, 1.95);
    b.add('wood', cylGeo(0.45, 0.38, 1.0, 14), 1.5, 0.5, -1.0);
    out.smoke.push([0, 4.2, 0]);
    out.focusH = 3;
  },
  fletcher_workshop(b, lot, out) {
    // owner 2026-10-23: a timber workshop with a thatched roof, bows hanging on its front wall, and a lean-to
    // over the bench where arrows are fletched; a barrel of arrows, staves drying in a rack, a straw butt
    // with a target at the side, the sign with two crossed arrows (front, +z, faces the street)
    house(b, -1.2, -1.8, 7.4, 5, 3.6, { roof: 'thatch', wall: 'timber', roofH: 2.6 });
    windowsRow(b, -4, -2.4, 2.0, 0.76, 1, 'windowWarm');
    b.add('woodDark', boxGeo(1.2, 2.2, 0.15), 1.2, 1.1, 0.76); // the door
    for (const x of [-4.6, 2.2]) b.add('woodDark', boxGeo(0.18, 2.6, 0.18), x, 1.3, 3.1);
    b.add('thatch', boxGeo(7.4, 0.14, 2.9).rotateX(-0.28), -1.2, 2.85, 1.85); // the lean-to
    // bows on the wall beside the door: arcs of yew with a string across
    for (const x of [-2.3, -1.6, -0.9]) { // x: the back of the bow; the arc's centre is 1.4 m to its right
      b.add('woodDark', new THREE.TorusGeometry(1.4, 0.035, 4, 14, 1.15).rotateZ(Math.PI - 0.575), x + 1.4, 1.9, 0.84);
      b.add('clothIvory', boxGeo(0.015, 1.52, 0.015), x + 0.225, 1.9, 0.86);
    }
    // the bench under the lean-to, arrows laid on it, a basket of feathers
    b.add('wood', boxGeo(2.6, 0.1, 0.8), -2.0, 0.85, 1.9);
    for (const x of [-3.1, -0.9]) b.add('woodDark', boxGeo(0.1, 0.85, 0.7), x, 0.42, 1.9);
    for (let i = 0; i < 8; i++) {
      b.add('wood', cylGeo(0.012, 0.012, 0.75, 5).rotateZ(Math.PI / 2), -2.0, 0.92, 1.62 + i * 0.07);
      b.add(i % 2 ? 'clothRed' : 'clothIvory', boxGeo(0.12, 0.05, 0.01), -2.32, 0.94, 1.62 + i * 0.07);
    }
    b.add('hay', cylGeo(0.28, 0.22, 0.3, 10), -0.4, 1.05, 1.7);
    for (let i = 0; i < 5; i++) b.add('clothIvory', boxGeo(0.04, 0.22, 0.01).rotateZ((i - 2) * 0.3), -0.4 + (i - 2) * 0.06, 1.28, 1.7);
    // a barrel of finished arrows, feathers up, by the post
    b.add('wood', cylGeo(0.36, 0.32, 0.9, 12), 1.6, 0.45, 2.8);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, r = 0.18;
      b.add('wood', cylGeo(0.012, 0.012, 0.8, 5).rotateZ(Math.cos(a) * 0.12).rotateX(Math.sin(a) * 0.12), 1.6 + Math.cos(a) * r, 1.05, 2.8 + Math.sin(a) * r);
      b.add(i % 3 ? 'clothIvory' : 'clothRed', boxGeo(0.05, 0.12, 0.05), 1.6 + Math.cos(a) * r * 1.3, 1.42, 2.8 + Math.sin(a) * r * 1.3);
    }
    // staves drying in a rack against the west wall
    b.add('woodDark', boxGeo(0.12, 0.12, 3.2), -5.6, 1.6, -1.8);
    for (let i = 0; i < 7; i++) b.add('wood', cylGeo(0.035, 0.03, 2.0, 5).rotateX(0.05).rotateZ(-0.2), -5.35, 1.0, -3.1 + i * 0.42);
    // the straw butt with its target at the east end of the lot, facing along the street
    b.add('hay', cylGeo(0.75, 0.75, 0.5, 18).rotateZ(Math.PI / 2), 5.0, 1.2, 2.2);
    b.add('clothIvory', cylGeo(0.55, 0.55, 0.02, 18).rotateZ(Math.PI / 2), 4.74, 1.2, 2.2);
    b.add('clothRed', cylGeo(0.36, 0.36, 0.02, 18).rotateZ(Math.PI / 2), 4.73, 1.2, 2.2);
    b.add('gold', cylGeo(0.16, 0.16, 0.02, 14).rotateZ(Math.PI / 2), 4.72, 1.2, 2.2);
    for (const z of [1.65, 2.75]) b.add('woodDark', boxGeo(0.08, 1.5, 0.08).rotateZ(-0.2), 5.3, 0.7, z);
    // the sign: a board on an iron arm with two crossed arrows painted in red
    b.add('iron', boxGeo(0.06, 0.06, 1.1), 2.35, 2.55, 3.65);
    b.add('woodDark', boxGeo(0.06, 0.8, 0.9), 2.35, 2.05, 3.85);
    for (const s of [-1, 1]) b.add('clothRed', boxGeo(0.02, 0.07, 0.75).rotateX(s * 0.7), 2.39, 2.05, 3.85);
    out.lights.push([-4.4, 2.3, 3.0]);
    out.focusH = 2.6;
  },
  counting_house(b, lot, out) {
    // owner 2026-10-23: the tax collector's house. A stone ground floor with barred windows and an arched door,
    // a timber upper storey jutting over the street, the royal banners, a sign with a gold coin; the front (+z)
    // stays clear for the queue of taxpayers along it
    b.add('stone', boxGeo(9, 3.2, 5.5), 0, 1.6, -2.2);
    b.add('timber', boxGeo(9.6, 2.6, 6.1), 0, 4.5, -2.2);
    b.add('woodDark', boxGeo(9.8, 0.25, 6.3), 0, 3.25, -2.2); // the jetty beam under the upper storey
    b.add('slate', gableGeo(10.4, 7, 2.8), 0, 5.8, -2.2);
    b.add('stone', boxGeo(0.9, 3.4, 0.9), 3.6, 7.3, -3.6); // chimney
    b.add('woodDark', boxGeo(1.4, 2.3, 0.15), 1.6, 1.15, 0.58); // the door under a round arch
    b.add('stoneDark', new THREE.TorusGeometry(0.75, 0.14, 6, 12, Math.PI), 1.6, 2.3, 0.6);
    b.add('woodDark', new THREE.CircleGeometry(0.7, 12, 0, Math.PI), 1.6, 2.3, 0.58);
    for (const x of [-3.2, -1.2]) { // barred windows
      b.add('window', boxGeo(1.0, 1.1, 0.12), x, 1.8, 0.56);
      for (let i = -1; i <= 1; i++) b.add('iron', boxGeo(0.05, 1.1, 0.05), x + i * 0.3, 1.8, 0.66);
    }
    windowsRow(b, -3.4, 3.4, 4.6, 0.86, 3, 'windowWarm');
    // the sign: a gold coin on an iron arm by the door
    b.add('iron', boxGeo(0.06, 0.06, 1.0), 2.8, 2.9, 1.05);
    b.add('gold', cylGeo(0.42, 0.42, 0.08, 18).rotateZ(Math.PI / 2), 2.8, 2.4, 1.4);
    b.add('woodDark', boxGeo(0.12, 0.6, 0.12), 2.8, 2.75, 1.4);
    // a strongbox and a barrel by the wall
    b.add('woodDark', boxGeo(0.9, 0.55, 0.6), -4.0, 0.28, 1.0); b.add('iron', boxGeo(0.95, 0.08, 0.65), -4.0, 0.45, 1.0);
    b.add('wood', cylGeo(0.35, 0.3, 0.85, 12), 3.9, 0.42, 1.0);
    out.banners.push([-2.2, 5.8, 0.9, 1.2, 2.0], [0.2, 5.8, 0.9, 1.2, 2.0]);
    out.lights.push([0.6, 2.6, 1.0]);
    out.smoke.push([3.6, 9.1, -3.6]);
    out.focusH = 3;
  },
  apothecary_shop(b, lot, out) {
    // owner 2026-10-23: the apothecary's shop. A timber house with a shop window under a green awning, jars and
    // bottles on its sill, herbs hanging to dry, a sign with a mortar and pestle, a bench for the ones waiting;
    // the front (+z) stays clear for the queue of the sick and the lame
    house(b, 0, -2.2, 9, 5.5, 3.6, { roof: 'roofRed', wall: 'timber', roofH: 3 });
    b.add('window', boxGeo(3.0, 1.4, 0.12), -2.0, 1.75, 0.56); // the shop window and its sill
    b.add('woodDark', boxGeo(3.4, 0.14, 0.7), -2.0, 1.0, 0.85);
    b.add('woodDark', boxGeo(3.4, 0.9, 0.1), -2.0, 0.5, 1.15);
    for (let i = 0; i < 8; i++) b.add(i % 3 ? 'clay' : 'stained', cylGeo(0.08 + (i % 2) * 0.03, 0.1, 0.2 + (i % 3) * 0.08, 8), -3.3 + i * 0.37, 1.18 + (i % 3) * 0.04, 0.85);
    b.add('awning2', boxGeo(3.6, 0.06, 1.3).rotateX(0.35), -2.0, 2.75, 1.05);
    for (let i = 0; i < 6; i++) b.add('greens', new THREE.ConeGeometry(0.12, 0.42, 6).rotateX(Math.PI), -3.4 + i * 0.56, 2.25, 1.35);
    b.add('woodDark', boxGeo(3.6, 0.06, 0.06), -2.0, 2.5, 1.35); // the pole the herbs hang from
    b.add('woodDark', boxGeo(1.2, 2.3, 0.15), 2.0, 1.15, 0.6); // the green door
    b.add('greens', boxGeo(1.0, 2.1, 0.05), 2.0, 1.1, 0.68);
    windowsRow(b, -3, 3, 4.6, 0.56, 3, 'windowWarm');
    // the sign: a mortar and pestle on a board, hung from an iron arm
    b.add('iron', boxGeo(0.06, 0.06, 1.0), 3.3, 3.0, 1.1);
    b.add('woodDark', boxGeo(0.08, 0.8, 0.8), 3.3, 2.5, 1.45);
    b.add('stoneDark', cylGeo(0.22, 0.15, 0.25, 10), 3.38, 2.4, 1.45);
    b.add('wood', cylGeo(0.04, 0.05, 0.5, 6).rotateX(0.5), 3.38, 2.65, 1.5);
    b.add('wood', boxGeo(1.8, 0.45, 0.4), 4.2, 0.22, 3.4, Math.PI / 2); // the bench
    out.lights.push([0.3, 2.6, 1.2]);
    out.smoke.push([-3, 7.6, -3]);
    out.focusH = 3;
  },
  bank(b, lot, out) {
    // owner 2026-10-27: the Bank, a stone palazzo with a loggia of three round arches at the front (+z); under it the money
    // changers' bench with its green cloth, piles of coins and a pair of scales, an iron-bound strongbox; the upper floor with
    // its windows and the banners, a gold coin on the sign
    b.add('stone', boxGeo(9.6, 4.0, 3.6), 0, 2.0, -1.4); // the hall behind the loggia
    b.add('stone', boxGeo(10.2, 3.0, 6.4), 0, 5.5, 0); // the upper floor over hall and loggia
    b.add('stoneDark', boxGeo(10.5, 0.35, 6.7), 0, 4.15, 0); // the string course
    b.add('slate', pyramidGeo(11.0, 7.2, 2.4), 0, 7.0, 0);
    b.add('stoneDark', boxGeo(10.8, 0.3, 7.0), 0, 7.05, 0); // the cornice
    for (const x of [-4.75, -1.6, 1.6, 4.75]) b.add('stoneDark', boxGeo(0.6, 4.0, 0.6), x, 2.0, 2.9); // the loggia's piers
    for (const x of [-3.18, 0, 3.18]) { // the round arches between them
      b.add('stone', new THREE.TorusGeometry(1.28, 0.24, 6, 14, Math.PI), x, 2.3, 2.9);
      b.add('stone', boxGeo(2.6, 0.6, 0.6), x, 3.7, 2.9);
    }
    b.add('cobble', boxGeo(9.6, 0.12, 2.6), 0, 0.06, 1.9); // the loggia's floor
    door(b, 2.6, 0.42, 1.5, 2.6, 0); // the door into the hall
    for (const x of [-3.0, -0.4]) b.add('window', boxGeo(1.0, 1.3, 0.12), x, 2.3, 0.42);
    windowsRow(b, -3.6, 3.6, 5.6, 3.24, 4, 'windowWarm');
    windowsRow(b, -3.6, 3.6, 5.6, -3.24, 4);
    for (const x of [-5.14, 5.14]) windowsRow(b, -1.6, 1.6, 5.6, x, 2, 'window', Math.PI / 2);
    // the money changers' bench: green cloth, coin piles, the scales
    b.add('woodDark', boxGeo(3.4, 0.9, 0.9), -1.7, 0.45, 1.6);
    b.add('greens', boxGeo(3.5, 0.06, 1.0), -1.7, 0.93, 1.6);
    for (const [x, n] of [[-3.0, 5], [-2.6, 3], [-2.2, 6], [-0.8, 4]]) b.add('gold', cylGeo(0.09, 0.09, 0.04 * n, 10), x, 0.96 + 0.02 * n, 1.55);
    b.add('iron', cylGeo(0.02, 0.02, 0.5, 5), -1.4, 1.2, 1.5); // the scales: a post, a beam, two pans
    b.add('iron', boxGeo(0.6, 0.03, 0.03), -1.4, 1.45, 1.5);
    for (const x of [-1.68, -1.12]) b.add('gold', cylGeo(0.1, 0.07, 0.04, 10), x, 1.2, 1.5);
    b.add('woodDark', boxGeo(1.1, 0.7, 0.7), 2.9, 0.35, 1.7); // the strongbox
    for (const x of [2.55, 3.25]) b.add('iron', boxGeo(0.08, 0.74, 0.74), x, 0.37, 1.7);
    b.add('wood', boxGeo(1.6, 0.45, 0.4), -1.7, 0.22, 2.7); // a bench for the ones waiting
    // the sign: a gold coin on an iron arm at the corner of the loggia
    b.add('iron', boxGeo(0.06, 0.06, 1.0), 4.75, 3.3, 3.6);
    b.add('gold', cylGeo(0.45, 0.45, 0.08, 18).rotateX(Math.PI / 2), 4.75, 2.8, 3.95);
    out.banners.push([-2.6, 6.9, 3.3, 1.2, 2.0], [2.6, 6.9, 3.3, 1.2, 2.0]);
    out.lights.push([0, 3.4, 1.9]);
    out.focusH = 4;
  },
  apiary(b, lot, out) {
    // straw skeps in a row on a long bench, a small shelter roof over them
    b.add('woodDark', boxGeo(4.0, 0.5, 0.8), 0, 0.25, 0);
    for (let i = 0; i < 5; i++) b.add('thatch', new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.3, 1), -1.6 + i * 0.8, 0.5, 0);
    for (const x of [-1.9, 1.9]) b.add('woodDark', boxGeo(0.12, 1.9, 0.12), x, 0.95, -0.5);
    b.add('thatch', boxGeo(4.4, 0.15, 1.6).rotateX(0.35), 0, 1.9, -0.1);
    out.focusH = 1.2;
  },
  bell_foundry(b, lot, out) {
    // a stone workshop with a tall furnace chimney, and a new bell hanging in a timber frame outside
    house(b, 0, 0.6, 6.4, 3.8, 3.4, { roof: 'slate', wall: 'stone' });
    door(b, -1.3, 2.52, 1.4, 2.4);
    windowsRow(b, 0.7, 0.7, 2.0, 2.56, 1, 'windowWarm');
    b.add('stone', boxGeo(1.2, 7.5, 1.2), 2.4, 3.75, 1.3);
    out.smoke.push([2.4, 7.8, 1.3, 'dark']);
    for (const x of [-1.6, 1.6]) b.add('woodDark', boxGeo(0.25, 3.6, 0.25), x, 1.8, -2.2);
    b.add('woodDark', boxGeo(3.6, 0.25, 0.3), 0, 3.6, -2.2);
    b.add('gold', cylGeo(0.5, 1.0, 1.5, 20, 1), 0, 2.6, -2.2);
    out.focusH = 3;
  },
  clock_tower(b, lot, out) {
    // a tall square stone tower with a clock face on each side and a slate spire
    const H = 17;
    b.add('stone', boxGeo(5, H, 5), 0, H / 2, 0);
    b.add('stoneDark', boxGeo(5.6, 0.6, 5.6), 0, H + 0.3, 0);
    b.add('slate', pyramidGeo(5.8, 5.8, 6), 0, H + 0.6, 0);
    for (let k = 0; k < 4; k++) {
      const ry = (k * Math.PI) / 2, dx = Math.sin(ry) * 2.53, dz = -Math.cos(ry) * 2.53;
      b.add('ivory', cylGeo(1.5, 1.5, 0.06, 24).rotateX(Math.PI / 2), dx, H - 3, dz, ry);
      b.add('gold', new THREE.TorusGeometry(1.5, 0.08, 6, 24), dx, H - 3, dz, ry);
      b.add('iron', boxGeo(0.12, 1.1, 0.04).translate(0, 0.5, 0).rotateZ(-0.5), dx * 1.02, H - 3, dz * 1.02, ry); // the hands at ten past ten
      b.add('iron', boxGeo(0.14, 0.8, 0.04).translate(0, 0.38, 0).rotateZ(0.9), dx * 1.02, H - 3, dz * 1.02, ry);
    }
    door(b, 0, 2.52, 1.4, 2.6, 0, { pointed: true });
    for (let k = 0; k < 4; k++) for (const y of [6, 9.5]) {
      const ry = (k * Math.PI) / 2;
      b.add('window', lancetGeo(0.45, 1.5, 0.2), Math.sin(ry) * 2.52, y, Math.cos(ry) * 2.52, ry);
    }
    out.flags.push([0, H + 7.2, 0, 1.4, 0.9]);
    out.focusH = 12;
  },
  stone_bridge(b, lot) {
    // a stone bridge across the river: piers with cutwaters in the water, the deck between the banks,
    // parapets and a small gate tower at each end (local z across the river, x along it)
    const L = lot.hd * 2, W = lot.hw * 2;
    b.add('stone', boxGeo(W, 1.2, L, 4), 0, 0.6, 0);
    for (const x of [-W / 2 + 0.3, W / 2 - 0.3]) b.add('stone', boxGeo(0.6, 1.1, L, 4), x, 1.75, 0);
    for (const z of [-6.5, 6.5]) {
      b.add('stone', boxGeo(W + 0.6, 9, 2.6, 4), 0, -4.5, z);
      for (const s of [-1, 1]) b.add('stone', boxGeo(1.9, 9, 1.9).rotateY(Math.PI / 4), s * (W / 2 + 0.3), -4.5, z);
    }
    for (const z of [-L / 2 + 2, L / 2 - 2]) {
      for (const x of [-W / 2 - 0.4, W / 2 + 0.4]) b.add('stone', boxGeo(1.6, 6, 1.6), x, 3, z);
      b.add('stone', boxGeo(W + 2.4, 1.4, 1.6), 0, 5.5, z);
      b.add('slate', pyramidGeo(W + 2.6, 2.0, 1.2), 0, 6.2, z);
    }
  },
  tavern(b, lot, out, ctx) {
    house(b, 0, 0, 13, 9, 7, { roof: 'thatch', wall: 'timber', roofH: 5 });
    windowsRow(b, -5, 5, 2.2, -4.56, 3, 'windowWarm'); windowsRow(b, -5, 5, 5.2, -4.56, 4, 'windowWarm');
    windowsRow(b, -5, 2, 2.2, 4.56, 3, 'windowWarm'); windowsRow(b, -5, 5, 5.2, 4.56, 4, 'windowWarm'); // the back, the side the shots see
    door(b, 4.6, 4.52, 1.3, 2.4, 0, { frame: 'woodDark' });
    for (const x of [-6.56, 6.56]) windowsRow(b, -2, 2, 3.8, x, 2, 'windowWarm', Math.PI / 2);
    b.add('woodDark', boxGeo(1.6, 2.6, 0.25), 1.5, 1.3, -4.6);
    b.add('iron', boxGeo(0.1, 0.1, 1.6), 5.5, 4.5, -5.3);
    b.add('woodDark', boxGeo(0.12, 1.1, 1.3), 5.5, 3.8, -5.9);
    for (const x of [-4, 3.5]) { b.add('wood', boxGeo(2.6, 0.12, 0.7), x, 0.75, -6.2); b.add('wood', boxGeo(2.6, 0.7, 0.12), x, 0.38, -6.2); }
    b.add('stone', boxGeo(1.2, 9.5, 1.2), -4.5, 4.75, 1.5);
    out.smoke.push([-4.5, 9.8, 1.5]);
    lanterns(ctx.lampsWorld, []);
    ctx.lamps.push([-1, 2.8, -5], [4, 2.8, -5]);
    out.focusH = 8;
  },
  chapel(b, lot, out) {
    // the tower and door face +z, the side the building shots look from (and the market square)
    b.add('stone', boxGeo(10, 7, 18), 0, 3.5, -2);
    b.add('slate', gableGeo(18.8, 11, 5.5).rotateY(Math.PI / 2), 0, 7, -2);
    for (const z of [-6, -1, 4]) for (const s of [-1, 1]) {
      b.add('stained', boxGeo(0.2, 3, 1.2), s * 5.05, 3.8, z);
      b.add('stained', cylGeo(0.6, 0.6, 0.2, 10).rotateZ(Math.PI / 2), s * 5.05, 5.3, z);
    }
    tower(b, 0, 9.5, 2.8, 13, 0, 'stone');
    b.add('stone', boxGeo(5, 13, 5), 0, 6.5, 9.5);
    b.add('slate', pyramidGeo(5.6, 5.6, 9), 0, 13, 9.5);
    b.add('gold', boxGeo(0.25, 2.2, 0.25), 0, 23, 9.5); b.add('gold', boxGeo(1.2, 0.25, 0.25), 0, 23.5, 9.5);
    b.add('stained', cylGeo(1.4, 1.4, 0.2, 18).rotateX(Math.PI / 2), 0, 9.2, 12.06);
    b.add('woodDark', boxGeo(2, 3.2, 0.3), 0, 1.6, 12.1);
    out.focusH = 12;
  },
  windmill(b, lot, out, ctx) {
    b.add('stone', cylGeo(2.6, 3.8, 11, 16), 0, 5.5, 0);
    b.add('thatch', cylGeo(0.1, 3.3, 4, 16, 2), 0, 13, 0);
    b.add('woodDark', boxGeo(1.4, 2.4, 0.25), 0, 1.2, 3.75);
    for (const y of [4, 8]) b.add('window', boxGeo(0.8, 1.0, 0.2), 0, y, 3.35 - y * 0.08);
    ctx.sails.push({ at: new THREE.Vector3(0, 11.5, 3.4), len: 9 });
    out.focusH = 10;
  },
  townhall(b, lot, out) {
    b.add('stone', boxGeo(22, 9, 16), 0, 4.5, 0);
    b.add('slate', gableGeo(23, 17, 6), 0, 9, 0);
    for (let i = -4; i <= 4; i++) { b.add('stoneDark', boxGeo(0.9, 4.2, 0.9), i * 2.4, 2.1, 8.4); }
    b.add('stone', boxGeo(22, 1, 1.6), 0, 4.6, 8.4);
    windowsRow(b, -9, 9, 6.6, 8.05, 6);
    door(b, 0, 8.02, 2.6, 3.6, 0, { pointed: true }); // the door behind the arcade, windows either side
    for (const x of [-8.4, -6, -3.6, 3.6, 6, 8.4]) b.add('window', boxGeo(1.0, 1.6, 0.2), x, 2.2, 8.05); // between the arcade's pillars
    windowsRow(b, -9, 9, 6.6, -8.05, 6); windowsRow(b, -9, 9, 2.4, -8.05, 6);
    for (const x of [-11.05, 11.05]) windowsRow(b, -5, 5, 6.6, x, 3, 'window', Math.PI / 2);
    b.add('stone', boxGeo(5, 22, 5), 0, 11, -3);
    b.add('ivory', cylGeo(1.5, 1.5, 0.2, 20).rotateX(Math.PI / 2), 0, 17.5, -0.45);
    b.add('iron', boxGeo(0.12, 1.2, 0.1), 0, 17.8, -0.3); b.add('iron', boxGeo(0.9, 0.12, 0.1), 0.35, 17.5, -0.3);
    b.add('slate', pyramidGeo(5.8, 5.8, 7), 0, 22, -3);
    out.banners.push([-5, 8.6, 8.3, 1.8, 3.3], [5, 8.6, 8.3, 1.8, 3.3]); // clear of the arcade beam below
    out.focusH = 14;
  },
  harbor(b, lot, out, ctx) {
    b.add('stone', boxGeo(72, 4.4, 23), 0, -1.8, -0.5); // the quay, from under the warehouses to the piers, down into the water (owner 2026-10-27)
    for (const x of [-24, 0, 24]) {
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) b.add('woodDark', cylGeo(0.2, 0.22, 5, 6), x + s * 1.8, -1.8, 13 + i * 3);
      b.add('wood', boxGeo(4.2, 0.35, 15, 2), x, 0.55, 18);
    }
    for (const x of [-30, -10, 12]) {
      house(b, x, -4, 14, 7, 6, { roof: 'roofRed', wall: 'stone' });
      door(b, x, -0.48, 3.0, 3.4, 0, { frame: 'woodDark' }); // the warehouse doors toward the quay
      windowsRow(b, x - 4.5, x + 4.5, 4.2, -0.44, 2);
      windowsRow(b, x - 5, x + 5, 3.6, -7.56, 3);
    }
    ctx.boats.push({ x: -12, z: 21, r: 0.05, len: 16, sail: true }, { x: 12, z: 24, r: -0.08, len: 13, sail: true }, { x: 36, z: 18, r: 0.2, len: 6, sail: false });
    out.focusH = 8;
  },
  cathedral(b, lot, out) {
    // owner 2026-10-27: the west front with its two towers, the three portals and the rose faces +z, the side the building
    // shots look from (before, the plain east end did, with no door or window); the apse with its tall windows at -z.
    // The nave (z -24..16) and aisles match the interior (church.js)
    b.add('stone', boxGeo(14, 18, 40), 0, 9, -4);
    b.add('slate', gableGeo(41, 15, 9).rotateY(Math.PI / 2), 0, 18, -4);
    for (const s of [-1, 1]) {
      const ry = (s * Math.PI) / 2;
      b.add('stone', boxGeo(6, 10, 34), s * 10, 5, -6);
      b.add('slate', gableGeo(34.5, 6.6, 3).rotateY(Math.PI / 2), s * 10, 10, -6);
      for (let z = -20; z <= 10; z += 5) {
        b.add('stoneDark', boxGeo(1.2, 12, 1.4), s * 13.6, 6, z); // buttresses and the flying buttresses over the aisles
        b.add('stoneDark', boxGeo(4.8, 1.0, 1.0), s * 10.6, 15.5, z, 0, 0, s * 0.5);
        if (z < 10 && Math.abs(z + 2.5 + 12) > 4.5) { // not where the transept stands
          lancet(b, s * 7.02, 11, z + 2.5, 1.5, 5.2, ry); // clerestory
          lancet(b, s * 13.02, 2.6, z + 2.5, 1.3, 4.2, ry); // aisle
        }
      }
      // the west towers: tall belfry openings, lancets lower down, a spire with a gold cross
      b.add('stone', boxGeo(6.5, 34, 6.5), s * 5.5, 17, 18);
      b.add('stoneDark', boxGeo(7.1, 0.8, 7.1), s * 5.5, 34.2, 18);
      b.add('slate', pyramidGeo(7, 7, 14), s * 5.5, 34.6, 18);
      b.add('gold', boxGeo(0.3, 2.4, 0.3), s * 5.5, 49.6, 18); b.add('gold', boxGeo(1.2, 0.3, 0.3), s * 5.5, 50.2, 18);
      for (const x of [-1.3, 1.3]) lancet(b, s * 5.5 + x, 25.5, 21.27, 1.0, 5, 0, 'window');
      lancet(b, s * 8.77, 25.5, 18, 1.0, 5, ry, 'window');
      lancet(b, s * 5.5, 13, 21.27, 1.3, 4.2);
      door(b, s * 5.5, 21.3, 1.9, 4.4, 0, { pointed: true }); // the side portals
      // the transept's ends: a rose over a portal
      rose(b, s * 15.02, 10.5, -12, 2.4, ry);
      door(b, s * 15.05, -12, 2.2, 4.8, ry, { pointed: true });
    }
    // the west front between the towers, flush with them: the great portal, a string course, the rose
    b.add('stone', boxGeo(4.6, 18, 5.4), 0, 9, 18.6);
    b.add('stone', gableGeo(5.4, 15, 9).rotateY(Math.PI / 2), 0, 18, 18.6); // the stone gable over the front
    b.add('stoneDark', boxGeo(17.6, 0.6, 0.4), 0, 8.6, 21.4);
    door(b, 0, 21.32, 2.9, 6.8, 0, { pointed: true });
    rose(b, 0, 13, 21.27, 1.85);
    // the transept
    b.add('stone', boxGeo(30, 16, 8), 0, 8, -12);
    b.add('slate', gableGeo(31, 9, 6), 0, 16, -12);
    // the apse at the east end: a half round with tall windows under a half cone
    const apse = new THREE.CylinderGeometry(7, 7, 16, 20, 1, false, Math.PI / 2, Math.PI);
    const auv = apse.attributes.uv;
    for (let i = 0; i < auv.count; i++) auv.setXY(i, (auv.getX(i) * Math.PI * 7) / 3, (auv.getY(i) * 16) / 3);
    b.add('stone', apse, 0, 8, -24);
    b.add('slate', new THREE.ConeGeometry(7.6, 7, 20, 1, false, Math.PI / 2, Math.PI), 0, 19.5, -24);
    for (const a of [Math.PI * 0.68, Math.PI, Math.PI * 1.32]) lancet(b, Math.sin(a) * 7.02, 4, -24 + Math.cos(a) * 7.02, 1.5, 7.5, a);
    out.focusH = 22;
  },
  tournament(b, lot, out, ctx) {
    const rx = 40, rz = 21;
    for (let i = 0; i < 48; i++) {
      const a0 = (i / 48) * Math.PI * 2, a1 = ((i + 1) / 48) * Math.PI * 2;
      const x0 = Math.cos(a0) * rx, z0 = Math.sin(a0) * rz, x1 = Math.cos(a1) * rx, z1 = Math.sin(a1) * rz;
      const len = Math.hypot(x1 - x0, z1 - z0);
      b.add('wood', boxGeo(len, 0.15, 0.15), (x0 + x1) / 2, 1.1, (z0 + z1) / 2, -Math.atan2(z1 - z0, x1 - x0));
      b.add('woodDark', boxGeo(0.2, 1.3, 0.2), x0, 0.65, z0);
    }
    b.add('wood', boxGeo(50, 1.2, 0.3), 0, 0.6, 0); // the tilt barrier
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) b.add('wood', boxGeo(26, 0.8, 2), 0, 0.8 + k * 0.9, s * (rz + 3 + k * 1.6));
      b.add('awning' + (s > 0 ? 0 : 1), gableGeo(27, 8, 2.2), 0, 7.2, s * (rz + 5.5));
      for (const x of [-12.5, 12.5]) b.add('woodDark', boxGeo(0.3, 7.2, 0.3), x, 3.6, s * (rz + 8.5));
    }
    for (let i = 0; i < 6; i++) {
      const x = -38 + i * 15, z = i % 2 ? -27 : 27;
      b.add('awning' + (i % STALL_COLORS.length), cylGeo(0.1, 3, 4, 10, 2), x * 0.98, 2, z * 1.12);
      b.add('woodDark', cylGeo(0.06, 0.06, 7, 6), x, 3.5, z * 0.9);
      out.flags.push([x, 7, z * 0.9, 2.0, 1.0]);
    }
    out.focusH = 6;
  },
  district(b, lot, out) {
    b.add('cobble', boxGeo(lot.hw * 2, 0.2, lot.hd * 2, 3), 0, 0.1, 0);
    b.add('stone', cylGeo(4.5, 4.8, 0.9, 24), 0, 0.45, 0);
    // the water a little over the basin's floor, under a stone lip (owner 2026-10-28: the water and the stone shared one
    // plane and flickered)
    b.add('water', cylGeo(4.0, 4.0, 0.08, 24), 0, 0.96, 0);
    b.add('stone', new THREE.TorusGeometry(4.25, 0.24, 6, 32).rotateX(Math.PI / 2), 0, 1.0, 0);
    b.add('stone', cylGeo(0.5, 0.7, 3, 10), 0, 2, 0);
    b.add('stone', cylGeo(1.5, 0.5, 0.5, 14), 0, 3.6, 0);
    b.add('gold', new THREE.SphereGeometry(0.4, 10, 8), 0, 4.2, 0);
    for (const [x, z] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
      b.add('woodDark', cylGeo(0.1, 0.12, 8, 6), x, 4, z);
      out.flags.push([x, 7.6, z, 1.6, 2.6, 'banner']);
    }
    out.focusH = 5;
  },
  // below the castle (owner 2026-10-22): a quadrangle of two-storey ranges round a lawn and a cloister,
  // tall windows between buttresses, the chapel with its spire on the west, the gatehouse on the east (on the
  // lane from the avenue), a stair tower at the corner
  university(b, lot, out) {
    const H = 10;
    for (const [x, z, w, d] of [[0, -18, 53, 9], [0, 18, 53, 9], [-22, 0, 9, 27], [22, 0, 9, 27]]) {
      b.add('stone', boxGeo(w, H, d), x, H / 2, z);
      b.add('stoneDark', boxGeo(w + 0.5, 0.6, d + 0.5), x, 0.3, z);
      b.add('stoneDark', boxGeo(w + 0.3, 0.35, d + 0.3), x, H * 0.48, z);
      b.add('slate', gableGeo(w > d ? w + 1 : d + 1, w > d ? d + 1 : w + 1, 5), x, H, z, w > d ? 0 : Math.PI / 2);
    }
    // outer faces: two rows of tall windows, buttresses between them
    for (const [z, ry, x0, x1, n] of [[-22.6, 0, -24, 24, 10], [22.6, 0, -24, 24, 10], [26.6, Math.PI / 2, -10, 10, 3], [-26.6, Math.PI / 2, -10, 10, 4]]) {
      for (const y of [2.6, 7.3]) windowsRow(b, x0, x1, y, z, n, 'window', ry, [1.1, 2.2]);
      const c = Math.cos(ry), s = Math.sin(ry);
      for (let i = 0; i <= n; i++) {
        const lx = x0 - (x1 - x0) / (2 * (n - 1)) + ((x1 - x0) * i) / (n - 1), lz = z + Math.sign(z) * 0.4;
        if (Math.abs(lx) > 26) continue;
        b.add('stoneDark', boxGeo(0.9, H - 1, 0.9), lx * c + lz * s, (H - 1) / 2, -lx * s + lz * c, ry);
      }
    }
    // the cloister: a lean-to arcade along the inner faces of the long ranges
    for (const sz of [-1, 1]) {
      for (let x = -16; x <= 16; x += 2.9) b.add('stone', cylGeo(0.22, 0.25, 3.2, 8), x, 1.6, sz * 11.2);
      b.add('slate', boxGeo(35, 0.25, 2.8), 0, 3.6, sz * 12.3, 0, sz * 0.3);
    }
    // the lawn, paths crossing it and the well in the middle
    b.add('greens', boxGeo(34, 0.12, 20), 0, 0.06, 0);
    b.add('cobble', boxGeo(34, 0.16, 2), 0, 0.08, 0);
    b.add('cobble', boxGeo(2, 0.16, 20), 0, 0.08, 0);
    b.add('stone', cylGeo(1.3, 1.4, 1, 14), 0, 0.5, 0);
    b.add('woodDark', boxGeo(0.2, 2.6, 0.2), -1.1, 1.3, 0); b.add('woodDark', boxGeo(0.2, 2.6, 0.2), 1.1, 1.3, 0);
    b.add('slate', gableGeo(3, 2, 1), 0, 2.6, 0);
    // the chapel on the west range: taller, with a great window over the lawn and a spire on its ridge
    b.add('stone', boxGeo(12, 15, 15), -22, 7.5, 0);
    b.add('slate', gableGeo(15.6, 12.6, 6.5), -22, 15, 0, Math.PI / 2);
    b.add('stained', boxGeo(0.2, 6.5, 3.4), -15.95, 8.5, 0);
    b.add('stone', boxGeo(2.6, 4, 2.6), -22, 21.5, 0);
    b.add('slate', pyramidGeo(3.2, 3.2, 8), -22, 23.5, 0);
    b.add('gold', boxGeo(0.25, 1.8, 0.25), -22, 32, 0);
    // the gatehouse on the lane: an arch with its doors, turrets on the corners, a flag
    b.add('stone', boxGeo(9, 15, 12), 25, 7.5, 0);
    b.add('woodDark', boxGeo(0.3, 6, 4.2), 29.6, 3, 0);
    b.add('stoneDark', boxGeo(0.6, 1, 5.6), 29.7, 6.4, 0);
    windowsRow(b, -2.5, 2.5, 10.5, 29.6, 2, 'window', Math.PI / 2, [1.1, 2.2]);
    for (const sz of [-1, 1]) tower(b, 29, sz * 6.2, 1.7, 18, 5);
    b.add('slate', pyramidGeo(9.4, 12.4, 4.5), 25, 15, 0);
    b.add('woodDark', cylGeo(0.1, 0.12, 5, 6), 25, 21.5, 0);
    out.flags.push([25, 23.4, 0, 2.6, 1.7, 'flag']);
    // the stair tower at the north-east corner
    tower(b, 26.5, -22.5, 3.2, 20, 8);
    out.focusH = 14;
  },
  palace(b, lot, out) {
    b.add('stone', boxGeo(60, 16, 26), 0, 8, 0);
    b.add('slate', gableGeo(61, 27, 7), 0, 16, 0);
    b.add('stone', boxGeo(16, 24, 18), 0, 12, 10);
    b.add('gold', new THREE.SphereGeometry(7, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, 24, 10);
    for (const s of [-1, 1]) tower(b, s * 30, -10, 5, 30, 12);
    windowsRow(b, -26, 26, 6, 13.05, 14); windowsRow(b, -26, 26, 11.5, 13.05, 14);
    door(b, 0, 19.02, 4, 6.5, 0, { pointed: true, frame: 'gold' }); // the great door under the dome
    for (const y of [10, 16]) windowsRow(b, -5, 5, y, 19.05, 3);
    windowsRow(b, -26, 26, 6, -13.05, 14); windowsRow(b, -26, 26, 11.5, -13.05, 14);
    out.banners.push([-6, 20, 19.25, 3, 8], [6, 20, 19.25, 3, 8]);
    out.focusH = 20;
  },
  lighthouse(b, lot, out, ctx) {
    b.add('stone', cylGeo(3.2, 4.4, 26, 16), 0, 13, 0);
    door(b, 0, 4.32, 1.3, 2.4, 0, { pointed: true });
    for (const y of [10, 18]) b.add('window', boxGeo(0.7, 1.2, 0.3), 0, y, 4.36 - y * 0.046);
    for (const y of [6, 14, 22]) b.add('clothRed', cylGeo(3.6 - y * 0.03, 3.7 - y * 0.03, 2, 16), 0, y, 0);
    b.add('lamp', cylGeo(2.2, 2.2, 3, 12), 0, 27.5, 0);
    b.add('slate', cylGeo(0.1, 3, 3, 12, 2), 0, 30.5, 0);
    out.lights.push([0, 27.5, 0]);
    out.focusH = 20;
  },
  colossus(b, lot, out) {
    b.add('stone', boxGeo(14, 6, 14), 0, 3, 0);
    b.add('stone', cylGeo(3.5, 4.5, 14, 12), 0, 13, 0);
    b.add('stone', boxGeo(10, 9, 5), 0, 24, 0);
    b.add('stone', new THREE.SphereGeometry(3, 16, 12), 0, 31, 0);
    b.add('gold', cylGeo(3.2, 2.8, 2, 12), 0, 34, 0);
    b.add('stone', boxGeo(2.2, 12, 2.2), 6.5, 24, 0, 0, 0, -0.35);
    b.add('woodDark', cylGeo(0.3, 0.3, 22, 8), 9, 30, 0);
    out.flags.push([9, 39, 0, 6, 4, 'flag']);
    out.focusH = 25;
  },
};
BUILD.district_east = BUILD.district_north = BUILD.district_south = BUILD.district_far = BUILD.district;

// ------------------------------------------------------------------ the second wall
/** The Second Wall's pieces along its route (state.wall2, planned round the houses: src/sim/wall.js). */
export function wall2Layout(w, state) {
  return wallLayout(w, (state.wall2 || planWall2(w, state)).pts);
}

const WALL_STAGES = 10; // the wall goes up a stretch at a time, outward from the gate the camera looks at

/**
 * The wall as it goes up: low foundations along the whole route from the first day (so the route shows),
 * then full-height stretches, the nearest to the main gate first. Returns { group, focus, setProgress }.
 */
function buildWall2(w, layout, mats) {
  const H = 9;
  // the gate nearest the market: the camera looks there and the building starts there
  const gate = [...layout.gates].sort((g, h) => Math.hypot(g.x - 102, g.z) - Math.hypot(h.x - 102, h.z))[0]
    || (layout.pieces[0] && { x: layout.pieces[0].x, z: layout.pieces[0].z }) || { x: 300, z: 0 };
  const parts = [
    ...layout.pieces.map((s) => ({ x: s.x, z: s.z, add(b) {
      const y = Math.max(heightAt(w, s.x, s.z), 1.6);
      b.add('stone', boxGeo(s.hw * 2 + 0.6, H + 3, 3, 4), s.x, y - 3 + (H + 3) / 2, s.z, -s.rot);
      // battlements along the top, on the outer face
      const c = Math.cos(s.rot), sn = Math.sin(s.rot);
      const ox = -sn * 1.15, oz = c * 1.15;
      const outward = ((s.x - 150) * ox + s.z * oz) > 0 ? 1 : -1;
      merlonLine(b, 'stone', s.x - c * s.hw + ox * outward, s.z - sn * s.hw + oz * outward, s.x + c * s.hw + ox * outward, s.z + sn * s.hw + oz * outward, y + H, 2.4, [1.2, 1.3, 0.6]);
    }, base(b) {
      const y = Math.max(heightAt(w, s.x, s.z), 1.6);
      b.add('stone', boxGeo(s.hw * 2 + 0.6, 4.4, 3.4, 4), s.x, y - 3 + 2.2, s.z, -s.rot);
    } })),
    // a tower at every corner, where the wall changes direction
    ...layout.towers.map(([x, z]) => ({ x, z, add(b) {
      const y = Math.max(heightAt(w, x, z), 1.6);
      b.add('stone', cylGeo(4, 4.4, H + 9, 16), x, y - 3 + (H + 9) / 2, z);
      merlonRing(b, 'stone', x, y + H + 6, z, 4, 10, [1.1, 1.3, 0.6]);
    }, base(b) {
      const y = Math.max(heightAt(w, x, z), 1.6);
      b.add('stone', cylGeo(4.6, 4.8, 4.6, 16), x, y - 3 + 2.3, z);
    } })),
    ...layout.gates.map((g) => ({ x: g.x, z: g.z, add(b) {
      const y = Math.max(heightAt(w, g.x, g.z), 1.6);
      const c = Math.cos(g.rot), s = Math.sin(g.rot);
      for (const k of [-1, 1]) {
        const x = g.x + c * k * 7, z = g.z + s * k * 7;
        b.add('stone', boxGeo(5, H + 7, 5, 4), x, y - 3 + (H + 7) / 2, z, -g.rot);
        b.add('slate', pyramidGeo(5.6, 5.6, 4), x, y + H + 4, z, -g.rot);
      }
      b.add('stone', boxGeo(10, 3, 4, 4), g.x, y + H + 0.5, g.z, -g.rot);
    }, base(b) {
      const y = Math.max(heightAt(w, g.x, g.z), 1.6);
      const c = Math.cos(g.rot), s = Math.sin(g.rot);
      for (const k of [-1, 1]) b.add('stone', boxGeo(5.4, 4.6, 5.4, 4), g.x + c * k * 7, y - 3 + 2.3, g.z + s * k * 7, -g.rot);
    } })),
  ].sort((p, q) => Math.hypot(p.x - gate.x, p.z - gate.z) - Math.hypot(q.x - gate.x, q.z - gate.z));
  const group = new THREE.Group();
  const base = new Builder();
  for (const p of parts) p.base(base);
  group.add(base.build(mats));
  const stages = Array.from({ length: WALL_STAGES }, (_, k) => {
    const b = new Builder();
    for (const p of parts.slice(Math.floor((k * parts.length) / WALL_STAGES), Math.floor(((k + 1) * parts.length) / WALL_STAGES))) p.add(b);
    const g = b.build(mats);
    group.add(g);
    return g;
  });
  return {
    group,
    focus: new THREE.Vector3(gate.x, 12, gate.z),
    setProgress(p) { stages.forEach((g, k) => { g.visible = p >= 0.999 || k < Math.ceil(p * WALL_STAGES); }); },
  };
}

// ------------------------------------------------------------------ fields
function buildFields(w, state, M, season) {
  const farmers = state.villagers.filter((v) => v.job === 'farmer').length;
  const built = state.buildings.some((b) => b.id === 'fields');
  const n = built ? Math.min(w.fields.length, 2 + Math.ceil(farmers / 2)) : 0;
  const tint = { spring: '#8fbf55', summer: '#d8c25a', autumn: '#e0b448', winter: '#8a7a62' }[season];
  const g = new THREE.Group();
  const bales = [];
  for (let i = 0; i < n; i++) {
    const f = w.fields[i];
    const geo = new THREE.PlaneGeometry(f.hw * 2, f.hd * 2, 8, 6);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, uv = geo.attributes.uv;
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    for (let k = 0; k < p.count; k++) {
      const lx = p.getX(k), lz = p.getZ(k);
      const x = f.x + lx * c - lz * s, z = f.z + lx * s + lz * c;
      p.setXYZ(k, x, heightAt(w, x, z) + 0.12, z);
      uv.setXY(k, (lx + f.hw) / 4, (lz + f.hd) / 4);
    }
    geo.computeVertexNormals();
    const mat = M.crop.clone();
    mat.color.set(tint).offsetHSL(rand01(state.seed, 'field', i) * 0.06 - 0.03, 0, rand01(state.seed, 'fieldl', i) * 0.1 - 0.05);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    g.add(mesh);
    if ((season === 'autumn' || season === 'summer') && i % 2 === 0) {
      for (let k = 0; k < 4; k++) bales.push([f.x + (k - 1.5) * 3.2 * c, f.z + (k - 1.5) * 3.2 * s]);
    }
  }
  if (bales.length) {
    const im = new THREE.InstancedMesh(cylGeo(0.75, 0.75, 1.3, 12).rotateZ(Math.PI / 2), M.hay, bales.length);
    const m = new THREE.Matrix4();
    bales.forEach(([x, z], i) => im.setMatrixAt(i, m.makeTranslation(x, heightAt(w, x, z) + 0.75, z)));
    im.castShadow = true;
    g.add(im);
  }
  return { group: g, count: n };
}

// ------------------------------------------------------------------ entry
export function buildBuildings(w, state, M, { season, progressOverride = {} } = {}) {
  const group = new THREE.Group();
  const extraMats = {
    roofTileWarm: M.roofRed, ivory: M.clothIvory, water: new THREE.MeshStandardMaterial({ color: '#3d6b78', roughness: 0.1, metalness: 0.2 }),
  };
  STALL_COLORS.forEach(([a, c], i) => { extraMats['awning' + i] = new THREE.MeshStandardMaterial({ map: awningTexture(a, c), roughness: 0.85, side: THREE.DoubleSide }); });
  const mats = { ...M, ...extraMats };
  const built = new Set(state.buildings.map((b) => b.id));
  const ctx = { built, boats: [], sails: [], lamps: [], lampsWorld: [] };
  const items = {};
  const smoke = [], lights = [], flags = [], banners = [], sails = [], boats = [];

  for (const bd of state.buildings) {
    if (bd.id === 'fields' || bd.id === 'guardposts' || bd.id === 'charter_stone') continue;
    if (bd.id === 'wall2') {
      const wall = buildWall2(w, wall2Layout(w, state), mats);
      const prog = progressOverride[bd.id] ?? (bd.status === 'done' ? 1 : progressOf(state, bd.id));
      wall.setProgress(prog);
      group.add(wall.group);
      items.wall2 = { group: wall.group, focus: wall.focus, progress: prog, setProgress: wall.setProgress };
      continue;
    }
    const lot = w.lots[bd.id];
    const fn = BUILD[bd.id];
    if (!lot || !fn) continue;
    const parent = lot.onPlaza && w.lots[lot.onPlaza];
    const frame = parent ? plazaFrame(w, parent, lot) : lotFrame(w, lot);
    const b = new Builder();
    const out = { smoke: [], lights: [], flags: [], banners: [], focusH: 6 };
    ctx.boats = []; ctx.sails = []; ctx.lamps = []; ctx.w = w; ctx.frame = frame;
    fn(b, lot, out, ctx);
    // a leveled foundation pad (skip on water)
    const padH = frame.base - frame.lo + 1.2;
    const padGeo = boxGeo(lot.hw * 2 + 1, padH, lot.hd * 2 + 1, 3);
    if (lot.plaza) {
      // squares get sloping sides (an embankment, not a wall) so the roads still run up onto them
      const pp = padGeo.attributes.position, flare = padH * 1.8;
      for (let k = 0; k < pp.count; k++) if (pp.getY(k) < 0) {
        pp.setX(k, pp.getX(k) + Math.sign(pp.getX(k)) * flare);
        pp.setZ(k, pp.getZ(k) + Math.sign(pp.getZ(k)) * flare);
      }
      padGeo.computeVertexNormals();
    }
    // the Tournament Ground's lists are bare earth, not paving (owner 2026-10-28)
    const foundation = new THREE.Mesh(padGeo, bd.id === 'tournament' ? M.dirt : M.cobble);
    foundation.position.y = -padH / 2 + 0.05;
    foundation.receiveShadow = true;
    const inner = b.build(mats);
    const root = new THREE.Group();
    root.matrixAutoUpdate = false;
    root.matrix.copy(frame.m);
    const body = new THREE.Group();
    body.add(inner);
    root.add(body);
    if (!lot.onWater && !parent && bd.id !== 'quarry') root.add(foundation); // squares too: stalls and crosses need a level floor
    // construction site extras, standing on the ground (or the river bed) below the lot level
    const drop = lot.onWater ? 4 : frame.base - frame.lo + 0.3;
    const site = new Builder();
    scaffoldAround(site, lot.hw * 0.9, lot.hd * 0.9, Math.max(6, out.focusH * 1.2), drop);
    crane(site, lot.hw * 0.7, -lot.hd * 0.7, Math.max(10, out.focusH * 1.5), drop);
    const siteGroup = site.build(mats);
    root.add(siteGroup);
    const toWorld = (p) => new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(frame.m);
    // no chimney smoke while the building (and its chimney) is still going up
    if (bd.status === 'done') for (const s of out.smoke) smoke.push({ pos: toWorld(s), dark: s[3] === 'dark', id: bd.id });
    for (const l of [...out.lights, ...ctx.lamps]) lights.push({ pos: toWorld(l), id: bd.id });
    for (const f of out.flags) flags.push({ pos: toWorld(f), size: [f[3], f[4]], kind: f[5] || 'pennant' });
    for (const bn of out.banners) banners.push({ pos: toWorld(bn), w: bn[3], h: bn[4], rot: lot.rot });
    for (const s of ctx.sails) sails.push({ pos: s.at.clone().applyMatrix4(frame.m), len: s.len, rot: lot.rot });
    for (const bt of ctx.boats) boats.push({ pos: toWorld([bt.x, 0, bt.z]), rot: lot.rot + bt.r, len: bt.len, sail: bt.sail });
    const item = {
      group: root, body, site: siteGroup, focus: toWorld([0, out.focusH, 0]), lot, base: frame.base, toWorld, pier: out.pier,
      // the paved foundation under the lot (its top 0.05 m over `base`, 0.5 m wider than the lot, `padH` deep; a square's
      // sides slope out `flare` metres at the bottom); stalls on a square stand on the square's
      pad: !lot.onWater && !parent && bd.id !== 'quarry', padH, flare: lot.plaza ? padH * 1.8 : 0,
      setProgress(p) {
        body.scale.y = Math.max(0.02, Math.min(1, 0.1 + 0.9 * p));
        siteGroup.visible = p < 0.999;
      },
    };
    item.setProgress(progressOverride[bd.id] ?? (bd.status === 'done' ? 1 : progressOf(state, bd.id)));
    items[bd.id] = item;
    group.add(root);
  }
  const fields = buildFields(w, state, M, season);
  group.add(fields.group);
  return { group, items, smoke, lights, flags, banners, sails, boats, fields };
}

export function progressOf(state, id) {
  const p = state.pendingConstruction.find((x) => x.building === id);
  return p ? Math.max(0.05, 1 - p.daysLeft / p.daysTotal) : 1;
}

export { ROYAL, CASTLE };
