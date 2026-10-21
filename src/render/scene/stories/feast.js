// The King's second day (src/sim/stories.js, royal step 'feast'): a long table in the square, the King on
// a high-backed chair at its head with two banner guards behind him, named villagers on the benches with
// tankards. They toast now and then; near the end everybody stands up for a toast to the King.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { rig, toolGeo } from '../work.js';
import { king, bannerGuard } from './royal.js';
import { stage, castTag, ease, clamp01 } from './common.js';

const EXTRAS = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d'];
const LEN = 6.4, TOP = 0.82, BENCH = 0.47; // table length and heights
const SEATS = [-2.4, -0.8, 0.8]; // along the table (x), on both sides
const TOAST = 0.68; // the share of the shot when everybody toasts the King

export function buildFeast({ story, M, buildings, seed, lang }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const C = st.square ? new THREE.Vector3(2, 0, 2.5) : new THREE.Vector3(0, 0, 5);
  const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(C.x + x, y, C.z + z); o.castShadow = true; o.receiveShadow = true; group.add(o); return o; };
  // the table, a white cloth, the benches
  add(boxGeo(LEN, 0.08, 1.15), M.wood, 0, TOP, 0);
  add(boxGeo(LEN + 0.1, 0.02, 1.25), M.clothIvory, 0, TOP + 0.05, 0);
  for (const x of [-LEN / 2 + 0.3, LEN / 2 - 0.3]) for (const z of [-0.45, 0.45]) add(boxGeo(0.1, TOP, 0.1), M.woodDark, x, TOP / 2, z);
  for (const z of [-0.95, 0.95]) {
    add(boxGeo(LEN - 0.6, 0.07, 0.34), M.wood, -0.3, BENCH - 0.035, z);
    for (const x of [-2.9, 2.3]) add(boxGeo(0.08, BENCH - 0.07, 0.3), M.woodDark, x, (BENCH - 0.07) / 2, z);
  }
  // the King's chair at the head of the table (+x), facing along it
  const HX = LEN / 2 + 0.55;
  add(boxGeo(0.7, 0.08, 0.7), M.clothRed, HX, BENCH, 0);
  add(boxGeo(0.1, 1.5, 0.75), M.clothRed, HX + 0.38, BENCH + 0.75, 0);
  add(boxGeo(0.12, 0.08, 0.8), M.gold, HX + 0.38, BENCH + 1.52, 0);
  for (const z of [-0.3, 0.3]) for (const x of [-0.28, 0.28]) add(boxGeo(0.07, BENCH, 0.07), M.woodDark, HX + x, BENCH / 2, z);
  const K = king(M);
  K.root.position.set(C.x + HX, BENCH - 0.47, C.z);
  K.root.rotation.y = -Math.PI / 2;
  const goblet = toolGeo('tankard', M);
  K.r.hand.add(goblet);
  group.add(K.root);
  const guards = [-1, 1].map((s) => {
    const g = bannerGuard(M);
    g.P.root.position.set(C.x + HX + 1.1, 0, C.z + s * 1.0);
    g.P.root.rotation.y = -Math.PI / 2;
    group.add(g.P.root);
    return g;
  });
  // food down the middle: a roast on a platter, loaves, a bowl of apples
  add(cylGeo(0.32, 0.32, 0.03, 16), M.gold, 0.2, TOP + 0.07, 0);
  add(new THREE.SphereGeometry(0.2, 12, 9).scale(1.5, 0.75, 0.95), M.wood, 0.2, TOP + 0.2, 0);
  for (const x of [-2.2, -1.1, 1.4, 2.3]) add(new THREE.SphereGeometry(0.15, 10, 8).scale(1.6, 0.7, 1), M.hay, x, TOP + 0.13, (rand01(seed, 'loaf', x) - 0.5) * 0.4);
  add(cylGeo(0.2, 0.14, 0.12, 12), M.wood, -1.6, TOP + 0.12, 0.1);
  for (let i = 0; i < 5; i++) add(new THREE.SphereGeometry(0.06, 8, 6), M.clothRed, -1.6 + (i % 3 - 1) * 0.08, TOP + 0.2, 0.1 + (i < 3 ? 0 : 0.08));
  // the guests: named villagers first (on the far bench, facing the camera), neighbours to fill the benches
  const cast = (story.cast || []).slice(0, 6);
  const guests = [];
  for (let i = 0; i < SEATS.length * 2; i++) {
    const side = i % 2 ? -1 : 1, x = SEATS[Math.floor(i / 2)];
    const c = cast[i] || null;
    const P = rig(M, c ? JOBS[c.job]?.color || '#7a6a55' : EXTRAS[i % EXTRAS.length], { seated: true });
    P.root.position.set(C.x + x, BENCH - 0.47, C.z + side * 0.95);
    P.root.rotation.y = side > 0 ? Math.PI : 0; // facing the table
    P.r.hand.add(toolGeo('tankard', M));
    group.add(P.root);
    guests.push({ P, c, ph: rand01(seed, 'feast', i) * 6, side });
  }
  const labels = [{ pos: new THREE.Vector3(), title: lang === 'it' ? 'Il Re' : 'The King', sub: lang === 'it' ? 'Alla salute!' : 'Cheers!' }];
  for (const g of guests) if (g.c) labels.push({ g, ...castTag(g.c, lang), pos: new THREE.Vector3() });
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Il banchetto del Re' : 'A feast for the King',
    focus: st.toWorld(C.x + 0.8, 1.1, C.z),
    cam(u) {
      // from the foot of the table, a little to the side: both benches and the King at the far end,
      // moving slowly toward him (a narrow, tall frame needs the length of the table in depth)
      const e = ease(u);
      return { pos: st.toWorld(C.x - LEN / 2 - 6.5 + 2.0 * e, 3.4 - 0.4 * e, C.z - 2.6 + 0.6 * e), look: st.toWorld(C.x + 1.0, 0.9, C.z) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      // the toast to the King: everybody raises the tankard high and holds it
      const all = clamp01((u - TOAST) / 0.06);
      guests.forEach(({ P, ph }, i) => {
        // between bites, now and then a toast across the table
        const sip = Math.max(0, Math.sin(t * 1.7 + ph)) ** 3;
        const r = THREE.MathUtils.lerp(-0.9 - 1.2 * sip, -2.7 + 0.15 * Math.sin(t * 7 + i), all);
        P.r.g.rotation.set(r, 0, -0.1);
        P.l.g.rotation.set(-0.85, 0, 0.12);
        P.body.rotation.set(0.05 + 0.05 * Math.sin(t * 2.3 + ph), 0.15 * Math.sin(t * 0.9 + ph) * (1 - all), 0);
      });
      K.r.g.rotation.set(THREE.MathUtils.lerp(-1.0 + 0.4 * Math.sin(t * 1.1), -2.6, clamp01((u - TOAST + 0.08) / 0.06)), 0, -0.1);
      K.l.g.rotation.set(-0.8, 0, 0.12);
      K.body.rotation.set(0, 0.25 * Math.sin(t * 0.7), 0);
      guards.forEach(({ P, flag }, k) => {
        P.r.g.rotation.set(-0.5, 0, 0);
        P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
        flag.rotation.y = 0.15 * Math.sin(t * 2 + k);
      });
      group.updateMatrixWorld(true);
      labels[0].pos.copy(K.root.getWorldPosition(tmp)).add(new THREE.Vector3(0, 2.0, 0));
      for (const lb of labels) if (lb.g) lb.pos.copy(lb.g.P.root.getWorldPosition(tmp)).add(new THREE.Vector3(0, 1.75, 0));
    },
  };
}
