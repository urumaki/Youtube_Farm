// New Year's Eve (31 December): at night the villagers gather round a bonfire in the square, torches and
// mugs in hand, and count down together; at midnight sparks fly up from the fire and everybody jumps and
// cheers. Named villagers stand in the ring with their name tags. No fireworks (medieval town).
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { toolGeo, particles } from '../work.js';
import { person, stage, bonfire, torch, flicker, castTag, ease, clamp01 } from './common.js';

const EXTRAS = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d', '#56606e', '#b5476b'];
const COUNT = [[0.32, '3'], [0.46, '2'], [0.6, '1']], MIDNIGHT = 0.74;

export function buildNewYear({ story, state, M, buildings, seed, lang }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const C = st.square ? new THREE.Vector3(2, 0, 2) : new THREE.Vector3(0, 0, 5);
  const fire = bonfire(group, M, C, 55);
  // the ring of villagers facing the fire: named ones first (on the camera's side), then neighbours
  const cast = [...(story.cast || [])].slice(0, 8);
  while (cast.length < 12) cast.push({ name: null, job: null });
  const ring = cast.map((c, i) => {
    const P = person(M, c.job ? JOBS[c.job]?.color || '#7a6a55' : EXTRAS[i % EXTRAS.length]);
    // named villagers on the far half of the ring, facing the camera (which looks from -z)
    const a = Math.PI / 2 + (i % 2 ? 1 : -1) * (0.25 + Math.floor(i / 2) * 0.52) + rand01(seed, 'ny', i) * 0.1;
    const r = 3.2 + rand01(seed, 'nyr', i) * 0.4;
    P.root.position.set(C.x + Math.cos(a) * r, 0, C.z + Math.sin(a) * r);
    P.root.rotation.y = Math.atan2(C.x - P.root.position.x, C.z - P.root.position.z);
    const flame = i % 3 === 0 ? torch(M, P.l.hand) : null;
    P.r.hand.add(toolGeo('tankard', M));
    group.add(P.root);
    return { P, c, flame, phase: rand01(seed, 'nyph', i) * 6 };
  });
  // sparks bursting up from the fire at midnight
  const sparks = particles(160, '#ffcf6a', 0.12, true);
  group.add(sparks);
  const year = Number(state.date.slice(0, 4)) + (state.date.slice(5) === '12-31' ? 1 : 0);
  const happy = lang === 'it' ? `Buon ${year}!` : `Happy ${year}!`;
  const banner = lang === 'it' ? 'Notte di San Silvestro' : 'New Year’s Eve';
  const labels = [...ring.filter((p) => p.c.name).map((p) => ({ p, ...castTag(p.c, lang), pos: new THREE.Vector3() }))];
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    banner,
    // the countdown in the big title at the top: 3, 2, 1, then the new year
    bannerAt(t, t0, t1) {
      const u = clamp01((t - t0) / (t1 - t0)), step = COUNT.filter(([at]) => u >= at).pop();
      return u >= MIDNIGHT ? happy : step ? step[1] : banner;
    },
    phase: 1,
    focus: st.toWorld(C.x, 1.2, C.z),
    cam(u) {
      const a = -Math.PI / 2 + 0.35 - 0.6 * u, r = 9.5 - 1.5 * ease(u);
      return { pos: st.toWorld(C.x + Math.cos(a) * r, 4.2 - 0.4 * u, C.z + Math.sin(a) * r), look: st.toWorld(C.x, 1.3, C.z + 0.8) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      fire.update(t, group.visible);
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0)), party = u >= MIDNIGHT;
      const step = COUNT.filter(([at]) => u >= at).pop();
      ring.forEach(({ P, flame, phase }, i) => {
        const ph = t * 8 + phase;
        P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
        if (party) {
          // jumping, mugs and torches up
          P.root.position.y = 0.2 * Math.abs(Math.sin(ph * 0.8));
          P.r.g.rotation.set(-2.7 + 0.3 * Math.sin(ph), 0, -0.2);
          P.l.g.rotation.set(flame ? -2.4 : -2.6 + 0.3 * Math.sin(ph + 1), 0, 0.2);
        } else {
          // swaying, counting along with a raised mug at each number
          const beat = step ? 1 - clamp01((u - step[0]) * 10) : 0;
          P.root.position.y = 0;
          P.r.g.rotation.set(-1.0 - 1.4 * beat + 0.08 * Math.sin(t * 2 + i), 0, -0.1);
          P.l.g.rotation.set(flame ? -1.2 : -0.3, 0, 0.15);
        }
        if (flame) flicker(flame, t, i);
      });
      // sparks: thrown up from the fire after midnight, falling back, fading
      const arr = sparks.geometry.attributes.position.array;
      const age0 = (u - MIDNIGHT) * (t1 - t0);
      for (let i = 0; i < 160; i++) {
        const age = age0 - (i % 4) * 0.12;
        if (!party || age < 0) { arr[i * 3 + 1] = -1e4; continue; }
        const a = rand01(seed, 'sp', i) * Math.PI * 2, sp = 1 + rand01(seed, 'sv', i) * 2.5, up = 5 + rand01(seed, 'su', i) * 5;
        arr[i * 3] = C.x + Math.cos(a) * sp * age;
        arr[i * 3 + 1] = 1.2 + up * age - 3.2 * age * age;
        arr[i * 3 + 2] = C.z + Math.sin(a) * sp * age;
      }
      sparks.geometry.attributes.position.needsUpdate = true;
      for (const lb of labels) if (lb.p) lb.pos.copy(tmp.copy(lb.p.P.root.position).setY(2.3)).applyMatrix4(group.matrix);
    },
  };
}
