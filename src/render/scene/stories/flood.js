// The river floods after the rain: villagers carry sandbags from a cart and stack a wall along the bank
// by the houses, named villagers leading, while the water creeps up. Nobody gets hurt and the wall holds.
import * as THREE from 'three';
import { RIVER_HALF_WIDTH, WATER_LEVEL } from '../../../sim/world.js';
import { JOBS } from '../../../sim/tiers.js';
import { rand01 } from '../../../sim/prng.js';
import { wagon } from '../caravan.js';
import { toolGeo } from '../work.js';
import { person, stride, castTag, clamp01 } from './common.js';

const HELPERS = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a'];
const ROWS = 3, PER_ROW = 9, BAG_W = 0.62;
const LOOP = 3.2; // seconds for one trip: cart to wall and back
const RISE = 0.45; // how far the river comes up during the scene

export function buildFlood({ story, w, state, M, houses, yFn, seed, lang, water }) {
  // the stretch of bank closest to an occupied house
  let best = null;
  for (const h of state.houses) {
    if (h.status !== 'occupied') continue;
    const sh = houses.shapes.get(h.id);
    if (!sh) continue;
    for (let i = 0; i < w.riverPts.length; i += 3) {
      const p = w.riverPts[i], d = Math.hypot(p[0] - sh.x, p[1] - sh.z);
      if (!best || d < best.d) best = { d, i, sh };
    }
  }
  if (!best) return null;
  const p = w.riverPts[best.i], q = w.riverPts[Math.min(w.riverPts.length - 1, best.i + 1)];
  const along = new THREE.Vector3(q[0] - p[0], 0, q[1] - p[1]).normalize();
  let toLand = new THREE.Vector3(-along.z, 0, along.x);
  if (toLand.x * (best.sh.x - p[0]) + toLand.z * (best.sh.z - p[1]) < 0) toLand.negate();
  // the scene's frame: origin on the bank, +z toward the river, x along it
  // the wall stands on the first ground well above the risen water (the water surface reaches under the
  // low bank, so the scene would be under it)
  const origin = new THREE.Vector3();
  for (let d = RIVER_HALF_WIDTH + 2; d < RIVER_HALF_WIDTH + 60; d += 0.5) {
    origin.set(p[0], 0, p[1]).addScaledVector(toLand, d);
    origin.y = yFn(origin.x, origin.z);
    if (origin.y > WATER_LEVEL + RISE + 0.5) break;
  }
  const frame = new THREE.Group();
  frame.position.copy(origin);
  frame.rotation.y = Math.atan2(-toLand.x, -toLand.z);
  frame.updateMatrixWorld(true);
  const group = new THREE.Group();
  group.visible = false;
  const local = (x, z) => frame.localToWorld(new THREE.Vector3(x, 0, z));
  const ground = (x, z) => { const v = local(x, z); v.y = yFn(v.x, v.z); return v; };
  // the sandbags: the wall grows as the bags arrive
  const bagGeo = new THREE.SphereGeometry(0.34, 10, 8).scale(1, 0.42, 0.62);
  const bags = [];
  for (let r = 0; r < ROWS; r++) for (let k = 0; k < PER_ROW - r; k++) {
    const x = (k - (PER_ROW - r - 1) / 2) * BAG_W;
    const pos = ground(x, 0.3);
    pos.y += 0.13 + r * 0.25;
    const m = new THREE.Mesh(bagGeo, M.hay);
    m.position.copy(pos);
    m.rotation.y = frame.rotation.y + (rand01(seed, 'bag', r, k) - 0.5) * 0.2;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    bags.push(m);
  }
  // the cart with more bags, a few metres inland
  const cart = wagon(M, seed + 3, 0, '#7b6a4a');
  cart.g.position.copy(ground(-4.6, -4.4));
  cart.g.rotation.y = frame.rotation.y - Math.PI / 2; // the ox faces away from the camera
  group.add(cart.g);
  const pickup = (x) => ground(x, -4.2);
  // the carriers: named villagers first
  const cast = [...(story.cast || [])].slice(0, 3);
  while (cast.length < 5) cast.push(null);
  const carriers = cast.map((c, i) => {
    const P = person(M, c ? JOBS[c.job]?.color || '#7a6a55' : HELPERS[i % HELPERS.length]);
    const sack = toolGeo('sack', M);
    sack.position.set(-0.3, 0.4, 0.05);
    P.r.hand.add(sack);
    group.add(P.root);
    return { P, c, sack, off: (i / cast.length) * LOOP + rand01(seed, 'fl', i) * 0.4, x: (i - (cast.length - 1) / 2) * 1.2 };
  });
  const labels = carriers.filter((k) => k.c).map((k) => ({ k, ...castTag(k.c, lang), pos: new THREE.Vector3() }));
  const tmp = new THREE.Vector3();
  const focus = ground(0, -1.2).add(new THREE.Vector3(0, 1.0, 0));
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Il fiume è in piena!' : 'The river floods!',
    focus,
    cam(u) {
      // from inland, to one side, looking over the carriers at the wall and the river
      return { pos: local(4.6 - 1.4 * u, -6.6 + 0.6 * u).setY(origin.y + 3.2), look: local(-0.6, -0.4).setY(origin.y + 0.7) };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      group.visible = on;
      // the river rises during the scene (and only then)
      if (water) water.position.y = on ? RISE * clamp01((t - t0) / (t1 - t0)) : 0;
      if (!on) return;
      const u = clamp01((t - t0) / (t1 - t0));
      const shown = Math.round(bags.length * (0.35 + 0.65 * u));
      bags.forEach((b, i) => { b.visible = i < shown; });
      carriers.forEach((k, i) => {
        const ph = ((t - t0 + k.off) % LOOP) / LOOP; // 0..0.45 to the wall, 0.45..0.55 drop, 0.55..1 back
        const go = ph < 0.45 ? ph / 0.45 : ph < 0.55 ? 1 : 1 - (ph - 0.55) / 0.45;
        const from = pickup(k.x * 0.5 - 2.8), to = ground(k.x, -0.45);
        k.P.root.position.copy(from).lerp(to, go);
        k.P.root.rotation.y = frame.rotation.y + (ph < 0.5 ? 0 : Math.PI); // toward the river, then back
        const moving = ph < 0.45 || ph > 0.55;
        stride(k.P, (t - t0) * 9 + i, moving ? 0.45 : 0, { arms: false });
        const carrying = ph < 0.5;
        k.sack.visible = carrying;
        k.P.r.g.rotation.set(carrying ? -0.9 : 0.2 * Math.sin(t * 9 + i), 0, carrying ? -0.3 : 0);
        k.P.l.g.rotation.set(carrying ? -0.9 : -0.2 * Math.sin(t * 9 + i), 0, carrying ? 0.3 : 0);
        k.P.body.rotation.x = ph >= 0.45 && ph < 0.55 ? 0.5 * Math.sin(Math.PI * (ph - 0.45) / 0.1) : carrying ? 0.1 : 0;
      });
      for (const lb of labels) lb.pos.copy(tmp.copy(lb.k.P.root.position)).add(new THREE.Vector3(0, 2.3, 0));
    },
  };
}
