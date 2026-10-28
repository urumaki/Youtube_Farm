// St Martin's Day (owner 2026-10-25, 11 November): the new wine is opened in the market square. A big barrel lies on
// trestles under a line of bunting, the innkeeper (a named one when there is one) behind it filling cups at the tap; the
// newest named villagers stand round it with their tankards and raise them together twice ("Cheers!"), the crowd behind.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { toolGeo } from '../work.js';
import { person, stage, castTag, ease, clamp01 } from './common.js';

const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d', '#56606e'];
const FLAGS = ['#b03030', '#e0b040', '#3a6ab0', '#f0ece0'];
// the two toasts: the share of the shot when the cups go up and come down
const TOASTS = [[0.3, 0.48], [0.68, 0.88]];

export function buildMartinmas({ story, M, buildings, seed }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const C = st.square ? new THREE.Vector3(3, 0, 2) : new THREE.Vector3(0, 0, 4.5);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(C.x + x, y, C.z + z); m.castShadow = true; group.add(m); return m; };
  const wine = new THREE.MeshStandardMaterial({ color: '#6b1530', roughness: 0.3 });
  // the barrel on two trestles, its tap toward the camera side
  for (const x of [-0.6, 0.6]) {
    add(boxGeo(0.08, 0.7, 0.9), M.woodDark, x, 0.35, 1.2).rotation.x = 0.0;
    add(boxGeo(0.12, 0.1, 0.9), M.wood, x, 0.72, 1.2);
  }
  add(cylGeo(0.5, 0.5, 1.5, 16).rotateZ(Math.PI / 2), M.wood, 0, 1.25, 1.2);
  for (const x of [-0.55, 0, 0.55]) add(cylGeo(0.52, 0.52, 0.06, 16).rotateZ(Math.PI / 2), M.iron, x, 1.25, 1.2);
  add(cylGeo(0.035, 0.035, 0.22, 6).rotateX(Math.PI / 2), M.iron, 0, 1.05, 0.62); // the tap
  const stream = add(cylGeo(0.018, 0.018, 0.34, 6), wine, 0, 0.84, 0.72);
  // bunting between two poles behind the barrel
  for (const x of [-2.4, 2.4]) add(cylGeo(0.05, 0.06, 3.0, 6), M.woodDark, x, 1.5, 2.2);
  for (let i = 0; i < 9; i++) {
    const x = -2.1 + i * 0.52, sag = 0.35 * Math.sin((Math.PI * (i + 0.5)) / 9);
    const flag = add(new THREE.ConeGeometry(0.16, 0.32, 3).rotateX(Math.PI), new THREE.MeshStandardMaterial({ color: FLAGS[i % 4], roughness: 0.8, side: THREE.DoubleSide }), x, 2.75 - sag, 2.2);
    flag.castShadow = false;
  }
  // the innkeeper behind the barrel, facing the camera
  const [keeper, ...guests] = story.cast;
  const K = person(M, JOBS[keeper?.job]?.color || JOBS.innkeeper.color);
  K.root.position.set(C.x + 1.05, 0, C.z + 1.75); // beside the tap end, not hidden by the barrel
  K.root.rotation.y = Math.PI;
  group.add(K.root);
  // the guests round the front of the barrel, three each side, tankards in hand
  const ring = guests.slice(0, 6).map((c, i) => {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
    const a = Math.PI + side * (0.75 + 0.42 * k);
    const P = person(M, JOBS[c.job]?.color || CROWD[i]);
    P.root.position.set(C.x + Math.sin(a) * 2.0, 0, C.z + 1.0 + Math.cos(a) * 1.6);
    P.root.rotation.y = Math.atan2(C.x - P.root.position.x, C.z + 0.9 - P.root.position.z);
    P.r.hand.add(toolGeo('tankard', M));
    group.add(P.root);
    return { P, c, base: P.root.position.clone(), ph: rand01(seed, 'mm', i) * 6 };
  });
  // the crowd behind, cheering at the toasts
  const crowd = CROWD.map((col, i) => {
    const P = person(M, col);
    P.root.position.set(C.x - 3.2 + i * 1.05, 0, C.z + 3.4 + (i % 2) * 0.7);
    P.root.rotation.y = Math.PI;
    group.add(P.root);
    return P;
  });
  const labels = [...(keeper ? [{ ...castTag(keeper), P: K }] : []), ...ring.map((g) => ({ ...castTag(g.c), P: g.P }))];
  const tmp = new THREE.Vector3();
  const raise = (u) => Math.max(...TOASTS.map(([a, b]) => ease(clamp01((u - a) / 0.06)) * (1 - ease(clamp01((u - b) / 0.08)))));
  return {
    group,
    labels,
    banner: 'St Martin’s Day: the new wine!',
    focus: st.toWorld(C.x, 1.1, C.z + 1),
    cam(u) {
      const a = -Math.PI / 2 - 0.35 + 0.5 * u;
      return { pos: st.toWorld(C.x + Math.cos(a) * 7.0, 3.4, C.z + 1 + Math.sin(a) * 7.0), look: st.toWorld(C.x, 1.0, C.z + 1.2) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0)), up = raise(u);
      // the innkeeper fills a cup at the tap between the toasts, waves it up at them
      const pour = up < 0.2;
      stream.visible = pour && Math.sin(t * 3) > -0.6;
      K.r.g.rotation.set(pour ? -0.9 : -2.6 * up, 0, -0.15);
      K.l.g.rotation.set(-0.4 - 2.2 * up, 0, 0.15);
      K.body.rotation.x = pour ? 0.18 : 0;
      ring.forEach(({ P, base, ph }) => {
        // a step in toward the barrel and the cup high at each toast, a sip in between
        P.root.position.copy(base).lerp(tmp.set(C.x, 0, C.z + 0.9), 0.18 * up);
        const sip = up < 0.1 && Math.sin(t * 1.3 + ph) > 0.7 ? 1 : 0;
        P.r.g.rotation.set(-0.9 - 1.9 * up - 1.0 * sip, 0, -0.1);
        P.l.g.rotation.set(-0.3 + 0.2 * Math.sin(t * 2 + ph) * (1 - up), 0, 0.15);
        P.root.position.y = 0.06 * up * Math.abs(Math.sin(t * 8 + ph));
      });
      crowd.forEach((P, i) => {
        const ph = t * 8 + i;
        P.r.g.rotation.set(-0.3 - 2.3 * up + 0.2 * Math.sin(ph), 0, -0.1);
        P.l.g.rotation.set(-0.25 - (i % 2 ? 2.2 * up : 0), 0, 0.1);
        P.root.position.y = 0.06 * up * Math.abs(Math.sin(ph));
      });
      for (const l of labels) l.pos.copy(l.P.root.position).setY(2.3).applyMatrix4(group.matrix);
    },
  };
}
