// The proclamation (owner 2026-10-25): on the day the kingdom reaches a new goal, the town crier (a named one when there
// is one) climbs a small wooden dais in the market square, rings the bell, unrolls the scroll and reads it out; the named
// villagers in front cheer and throw their caps when it is read.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { toolGeo } from '../work.js';
import { person, stage, castTag, ease, clamp01 } from './common.js';

const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d'];
const READ = 0.25, DONE = 0.62; // the bell until READ, the scroll read until DONE, then the cheering

export function buildProclaim({ story, M, buildings, seed }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const C = st.square ? new THREE.Vector3(3, 0, 2) : new THREE.Vector3(0, 0, 4.5);
  const add = (geo, mat, x, y, z, parent = group) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  // the dais with its steps, draped in red
  add(boxGeo(1.8, 0.7, 1.3), M.wood, C.x, 0.35, C.z + 1.5);
  add(boxGeo(1.84, 0.4, 0.04), M.clothRed, C.x, 0.45, C.z + 0.84);
  add(boxGeo(0.7, 0.35, 0.4), M.woodDark, C.x + 1.25, 0.175, C.z + 1.3);
  for (const x of [-0.85, 0.85]) add(cylGeo(0.05, 0.05, 2.4, 6), M.woodDark, C.x + x, 1.9, C.z + 2.1);
  add(boxGeo(1.75, 0.9, 0.04), M.clothBlue, C.x, 2.55, C.z + 2.12);
  // the crier on the dais, facing the square, the bell in one hand, the scroll in both after it
  const crier = story.crier;
  const K = person(M, JOBS[crier?.job]?.color || JOBS.crier.color);
  K.root.position.set(C.x, 0.7, C.z + 1.5);
  K.root.rotation.y = Math.PI;
  group.add(K.root);
  const bell = toolGeo('handbell', M);
  K.r.hand.add(bell);
  const scroll = new THREE.Group();
  add(new THREE.PlaneGeometry(0.42, 0.55), new THREE.MeshStandardMaterial({ color: '#efe3c4', roughness: 0.9, side: THREE.DoubleSide }), 0, 0, 0, scroll);
  for (const y of [-0.28, 0.28]) add(cylGeo(0.03, 0.03, 0.48, 8).rotateZ(Math.PI / 2), M.clothIvory, 0, y, 0, scroll);
  // held in both hands in front of the chest (in the crier's body frame, so it moves with him)
  scroll.position.set(0, 0.6, 0.62);
  scroll.rotation.x = -0.25;
  K.body.add(scroll);
  // the crowd in front of the dais, the named villagers in the front row
  const named = story.cast.filter((c) => c.id !== crier?.id);
  const crowd = Array.from({ length: Math.max(8, named.length + 3) }, (_, i) => {
    const c = named[i] || null, row = i < 5 ? 0 : 1, k = row ? i - 5 : i, n = row ? 6 : 5;
    const P = person(M, c ? JOBS[c.job]?.color || CROWD[i % 6] : CROWD[i % 6]);
    // two arcs between the camera and the dais: the camera looks at the crier over their heads
    const a = Math.PI + (k - (n - 1) / 2) * 0.32;
    const r = 2.4 + row * 1.0;
    P.root.position.set(C.x + Math.sin(a) * r * 1.3, 0, C.z + 1.5 + Math.cos(a) * r);
    P.root.rotation.y = Math.atan2(C.x - P.root.position.x, C.z + 1.5 - P.root.position.z);
    group.add(P.root);
    return { P, c, ph: rand01(seed, 'proc', i) * 6 };
  });
  const labels = [...(crier ? [{ ...castTag(crier), P: K }] : []), ...crowd.filter((g) => g.c).map((g) => ({ ...castTag(g.c), P: g.P }))];
  const title = story.title || '';
  return {
    group,
    labels,
    banner: `Hear ye! ${title}!`,
    focus: st.toWorld(C.x, 1.6, C.z + 1.5),
    cam(u) {
      // low over the crowd's heads, looking up at the crier, drifting in
      const k = ease(u);
      return { pos: st.toWorld(C.x - 1.2 + 0.9 * k, 3.4, C.z - 6.8 + 1.0 * k), look: st.toWorld(C.x, 1.5, C.z + 1.2) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      const ringing = u < READ, cheer = u > DONE;
      bell.visible = ringing;
      scroll.visible = !ringing;
      if (ringing) {
        K.r.g.rotation.set(-2.2, 0, -0.25 + 0.35 * Math.sin(t * 16));
        K.l.g.rotation.set(-0.2, 0, 0.1);
      } else {
        // the scroll held open in front of the chest with both hands; read, it is rolled up and both arms go up
        const lift = ease(clamp01((u - DONE) / 0.1));
        scroll.visible = lift < 0.5;
        K.r.g.rotation.set(-1.25 - 1.5 * lift, 0, -0.12 + 0.5 * lift); K.l.g.rotation.set(-1.25 - 1.5 * lift, 0, 0.12 - 0.5 * lift);
      }
      crowd.forEach(({ P, ph }, i) => {
        const b = t * 8 + ph;
        if (cheer) { P.r.g.rotation.set(-2.7 + 0.3 * Math.sin(b), 0, -0.2); P.l.g.rotation.set(i % 2 ? -2.6 : -0.3, 0, 0.2); P.root.position.y = 0.1 * Math.abs(Math.sin(b)); }
        else { P.r.g.rotation.set(-0.2, 0, -0.05); P.l.g.rotation.set(-0.2, 0, 0.05); P.root.position.y = 0; }
        if (P.hat) P.hat.position.y = (P.hat.userData.y0 ??= P.hat.position.y) + (cheer && i % 3 === 0 ? 0.6 * Math.abs(Math.sin(b * 0.5)) : 0); // a cap thrown up
      });
      for (const l of labels) l.pos.copy(l.P.root.position).setY(l.P.root.position.y + 2.3).applyMatrix4(group.matrix);
    },
  };
}
