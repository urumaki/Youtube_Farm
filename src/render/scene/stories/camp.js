// The merchants' second day (src/sim/stories.js, merchants step 'camp'): at night their wagons stand round
// the square, a bonfire burns in the middle and the merchants dance round it with the villagers, hand in
// hand, while one of them beats a drum. The newest named villagers dance with their name tags.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { wagon } from '../caravan.js';
import { cylGeo } from '../kit.js';
import { merchant, COVERS } from './merchants.js';
import { person, stage, bonfire, castTag, ease } from './common.js';

const EXTRAS = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d'];
const RING = 2.9; // the dancers' circle round the fire
const SPIN = 0.55; // how fast the ring turns (rad/s)

export function buildCamp({ story, M, buildings, seed }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const C = st.square ? new THREE.Vector3(2, 0, 2) : new THREE.Vector3(0, 0, 5);
  const fire = bonfire(group, M, C, 55);
  // the wagons parked side by side on the far side of the fire (the camera looks from -z)
  const nW = story.wagons || 2;
  for (let k = 0; k < nW; k++) {
    const wg = wagon(M, seed + 7, k, COVERS[k % COVERS.length]);
    wg.g.position.set(C.x + (k - (nW - 1) / 2) * 4.2, 0, C.z + 7.2);
    wg.g.rotation.y = Math.PI / 2 + (rand01(seed, 'camp-w', k) - 0.5) * 0.3;
    group.add(wg.g);
  }
  // the ring: named villagers and merchants in turn, then neighbours to close it
  const cast = (story.cast || []).slice(0, 6);
  const ring = [];
  let m = 0, e = 0;
  for (let i = 0; i < 12; i++) {
    const c = i % 2 === 0 ? cast[i / 2] : null;
    const P = c ? person(M, JOBS[c.job]?.color || '#7a6a55') : i % 2 ? merchant(M, m++) : person(M, EXTRAS[e++ % EXTRAS.length]);
    group.add(P.root);
    ring.push({ P, c, a0: (i / 12) * Math.PI * 2 + Math.PI / 2, ph: rand01(seed, 'camp-ph', i) * 6 });
  }
  // a merchant beats a drum by the wagons
  const drummer = merchant(M, 4);
  drummer.root.position.set(C.x - 4.6, 0, C.z + 3.4);
  drummer.root.rotation.y = Math.atan2(C.x - drummer.root.position.x, C.z - drummer.root.position.z);
  const drum = new THREE.Mesh(cylGeo(0.26, 0.24, 0.5, 14), M.wood);
  drum.position.set(0, 0.62, 0.42);
  drum.castShadow = true;
  drummer.root.add(drum);
  group.add(drummer.root);
  const labels = ring.filter((d) => d.c).map((d) => ({ d, ...castTag(d.c), pos: new THREE.Vector3() }));
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    banner: 'Dancing with the merchants!',
    phase: 1,
    focus: st.toWorld(C.x, 1.2, C.z),
    cam(u) {
      // from the open side of the square (as the New Year scene), circling a little
      const a = -Math.PI / 2 + 0.35 - 0.6 * u, r = 7.6 - 1.2 * ease(u);
      return { pos: st.toWorld(C.x + Math.cos(a) * r, 3.4 - 0.4 * u, C.z + Math.sin(a) * r), look: st.toWorld(C.x, 1.2, C.z + 0.8) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      fire.update(t, group.visible);
      if (!group.visible) return;
      // the ring turns; everybody faces the fire, steps sideways with a hop, hands joined and raised on the beat
      const turn = (t - t0) * SPIN;
      const beat = Math.sin(t * Math.PI * 2 * 1.6);
      ring.forEach(({ P, a0, ph }, i) => {
        const a = a0 + turn;
        P.root.position.set(C.x + Math.cos(a) * RING, 0.08 * Math.abs(beat), C.z + Math.sin(a) * RING);
        P.root.rotation.y = Math.atan2(C.x - P.root.position.x, C.z - P.root.position.z);
        P.legs[0].rotation.x = 0.35 * beat;
        P.legs[1].rotation.x = -0.35 * beat;
        // arms out to the neighbours' hands, swung up high on the beat
        const up = 0.5 + 0.5 * Math.sin(t * 3.2 + (i % 2) * 0.4);
        P.r.g.rotation.set(-0.3 * up, 0, 1.1 + 1.2 * up);
        P.l.g.rotation.set(-0.3 * up, 0, -1.1 - 1.2 * up);
        P.body.rotation.z = 0.08 * Math.sin(t * 3.2 + ph);
      });
      // the drummer: both hands on the drum, in time
      drummer.r.g.rotation.set(-0.9 - 0.35 * Math.max(0, beat), 0, -0.25);
      drummer.l.g.rotation.set(-0.9 - 0.35 * Math.max(0, -beat), 0, 0.25);
      drummer.legs[0].rotation.x = drummer.legs[1].rotation.x = 0;
      for (const lb of labels) lb.pos.copy(tmp.copy(lb.d.P.root.position).setY(2.25)).applyMatrix4(group.matrix);
    },
  };
}
