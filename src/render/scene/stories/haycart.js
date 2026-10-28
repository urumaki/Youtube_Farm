// The hay cart stuck in the gate (owner 2026-10-25): a cart piled high with hay sits tilted with a wheel in the mud of a
// gateway of the Second Wall (the one nearest the market). The carter (a named farmer or peasant when there is one) hauls
// on the shafts, four named villagers push from behind; it lurches free, and the top of the load slides off backwards
// onto the pushers, who come up out of the hay. Comic, nobody hurt.
import * as THREE from 'three';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { wall2Layout } from '../buildings.js';
import { person, stride, castTag, ease, clamp01 } from './common.js';

const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a'];
const FREE = 0.6; // the share of the shot when the cart comes out of the mud

export function buildHayCart({ story, w, state, M, yFn }) {
  if (!state.wall2) return null;
  const gates = wall2Layout(w, state).gates;
  const g = [...gates].sort((a, b) => Math.hypot(a.x - 102, a.z) - Math.hypot(b.x - 102, b.z))[0];
  if (!g) return null;
  const group = new THREE.Group();
  group.visible = false;
  // the road's way through the gate (into town: toward the market) and the wall's way
  const along = new THREE.Vector3(Math.cos(g.rot), 0, Math.sin(g.rot));
  let road = new THREE.Vector3(-along.z, 0, along.x);
  if (road.x * (102 - g.x) + road.z * (0 - g.z) < 0) road.negate();
  const at = (r, s) => { const p = new THREE.Vector3(g.x, 0, g.z).addScaledVector(road, r).addScaledVector(along, s); p.y = yFn(p.x, p.z); return p; };
  const yaw = Math.atan2(road.x, road.z);
  // the mud and the cart (its own frame: +z along the road into town)
  const mudAt = at(0, 0);
  const mud = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5a3a1e', roughness: 0.6 }));
  mud.position.copy(mudAt).setY(mudAt.y + 0.04);
  group.add(mud);
  const cart = new THREE.Group();
  group.add(cart);
  const add = (geo, mat, x, y, z, parent = cart) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  add(boxGeo(1.6, 0.12, 2.6), M.wood, 0, 0.7, 0);
  for (const s of [-1, 1]) {
    add(boxGeo(0.08, 0.4, 2.6), M.woodDark, s * 0.8, 0.9, 0);
    add(cylGeo(0.48, 0.48, 0.1, 14).rotateZ(Math.PI / 2), M.woodDark, s * 0.9, 0.48, -0.2);
    add(boxGeo(0.07, 0.07, 1.9), M.woodDark, s * 0.45, 0.62, 2.1); // the shafts
  }
  add(boxGeo(1.7, 1.2, 2.5), M.hay, 0, 1.35, 0);
  const top = add(boxGeo(1.6, 0.9, 2.2), M.hay, 0, 2.4, -0.05);
  const cast = story.cast;
  const carter = person(M, JOBS[cast[0]?.job]?.color || JOBS.farmer.color);
  group.add(carter.root);
  const pushers = [1, 2, 3, 4].map((i) => {
    const c = cast[i] || null, P = person(M, c ? JOBS[c.job]?.color || CROWD[i - 1] : CROWD[i - 1]);
    group.add(P.root);
    return { P, c, s: [-0.6, 0.6, -0.25, 0.3][i - 1], back: i < 3 ? 1.75 : 2.45 };
  });
  const labels = [...(cast[0] ? [{ ...castTag(cast[0]), P: carter }] : []), ...pushers.filter((p) => p.c).map((p) => ({ ...castTag(p.c), P: p.P }))];
  const fwd = (u) => 2.6 * ease(clamp01((u - FREE) / 0.18));
  return {
    group,
    labels,
    banner: 'The hay cart is stuck!',
    focus: at(0, 0).setY(at(0, 0).y + 1.4),
    cam(u) {
      // outside the wall behind the pushers, a little to one side, the gate and the town beyond
      const p = at(-8.8 + 0.9 * u, -2.6), l = at(0.6, 0);
      return { pos: p.setY(p.y + 3.0), look: l.setY(l.y + 1.5) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0)), free = u > FREE, f = fwd(u);
      // the cart: tilted into the mud and rocking with each heave, then level and rolled forward
      const heave = free ? 0 : Math.max(0, Math.sin((t - t0) * 4.2));
      const c = at(f, 0);
      cart.position.copy(c);
      cart.rotation.set(free ? 0 : -0.05 - 0.04 * heave, yaw, free ? 0 : 0.13 - 0.03 * heave, 'YXZ');
      cart.position.y -= free ? 0 : 0.18;
      // the top of the load slides off backwards when it lurches free, onto the pushers
      const slide = ease(clamp01((u - FREE - 0.04) / 0.14));
      // (it ends round the pushers' waists: they stand buried in it to the belt)
      top.position.set(0, 2.4 - 1.5 * slide, -0.05 - 4.05 * slide); // the cart has rolled 2.6 m on: back to the pushers
      top.rotation.x = -0.3 * slide * (1 - slide);
      top.scale.set(1 + 0.7 * slide, 1 - 0.3 * slide, 1 + 0.15 * slide);
      // the carter at the shafts, pulling; the pushers leaning into the back, then buried and climbing out
      const front = at(f + 3.3, 0);
      carter.root.position.copy(front);
      carter.root.rotation.y = yaw;
      carter.body.rotation.x = free ? 0 : 0.45;
      stride(carter, (t - t0) * (free ? 8 : 3), free && u < FREE + 0.18 ? 0.5 : 0.2, { arms: false });
      carter.r.g.rotation.set(free ? -2.6 : 0.4, 0, -0.2); carter.l.g.rotation.set(free ? -2.4 : 0.4, 0, 0.2);
      pushers.forEach(({ P, s, back }, i) => {
        const buried = slide > 0.6;
        const p = at((free ? Math.min(f, 0.6) : 0) - back, s);
        P.root.position.copy(p);
        P.root.rotation.y = yaw;
        if (!buried) {
          P.body.rotation.x = 0.55 + 0.1 * heave;
          stride(P, (t - t0) * 3 + i, 0.25, { arms: false });
          P.r.g.rotation.set(-1.55, 0, -0.1); P.l.g.rotation.set(-1.55, 0, 0.1);
        } else {
          // buried to the waist in the hay, arms up, shaking it off
          P.body.rotation.x = 0;
          P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
          P.r.g.rotation.set(-2.6 + 0.4 * Math.sin(t * 9 + i), 0, -0.4); P.l.g.rotation.set(-2.4, 0, 0.4);
        }
      });
      for (const l of labels) l.pos.copy(l.P.root.position).setY(Math.max(l.P.root.position.y, yFn(l.P.root.position.x, l.P.root.position.z)) + 2.3);
    },
  };
}
