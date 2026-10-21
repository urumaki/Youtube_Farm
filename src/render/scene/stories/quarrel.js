// Two villagers quarrel in the market square (or at the well) over a runaway chicken, a goat or the
// last cabbage, while a small crowd watches. Comic, nobody gets hurt. The next quiet day (step 'peace')
// they make up: a handshake in the square, then arms up together while the crowd claps.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { person, stage, castTag } from './common.js';

const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d'];

function chicken(M) {
  const g = new THREE.Group();
  const white = M.clothIvory;
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); };
  add(new THREE.SphereGeometry(0.2, 10, 8).scale(1, 0.85, 1.3).translate(0, 0.32, 0), white);
  add(new THREE.SphereGeometry(0.11, 8, 6).translate(0, 0.52, 0.2), white);
  add(new THREE.BoxGeometry(0.04, 0.08, 0.1).translate(0, 0.64, 0.2), M.clothRed);
  add(new THREE.ConeGeometry(0.035, 0.09, 5).rotateX(Math.PI / 2).translate(0, 0.51, 0.33), M.gold);
  for (const x of [-0.06, 0.06]) add(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 4).translate(x, 0.1, 0), M.gold);
  return g;
}

function goat(M) {
  const g = new THREE.Group();
  const hide = M.people.clone();
  hide.color.set('#d8d0c0');
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); };
  add(new THREE.BoxGeometry(0.45, 0.42, 0.9).translate(0, 0.62, 0), hide);
  add(new THREE.BoxGeometry(0.26, 0.3, 0.36).translate(0, 0.9, 0.52), hide);
  for (const x of [-0.08, 0.08]) add(new THREE.ConeGeometry(0.03, 0.22, 5).rotateX(-0.5).translate(x, 1.12, 0.45), M.gear);
  for (const [x, z] of [[-0.16, -0.32], [0.16, -0.32], [-0.16, 0.32], [0.16, 0.32]]) add(new THREE.BoxGeometry(0.09, 0.42, 0.09).translate(x, 0.21, z), hide);
  return g;
}

export function buildQuarrel({ story, M, buildings, seed, lang }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  // the scene's centre on the square: away from the stalls, the market cross and the road's middle
  const C = st.square ? new THREE.Vector3(4, 0, 3) : new THREE.Vector3(0, 0, 4.5);
  const at = (x, z) => new THREE.Vector3(C.x + x, 0, C.z + z);
  const [ca, cb] = story.cast;
  const A = person(M, JOBS[ca.job]?.color || '#7a6a55');
  const B = person(M, JOBS[cb.job]?.color || '#7a6a55');
  A.root.position.copy(at(-0.8, 0)); A.root.rotation.y = Math.PI / 2;
  B.root.position.copy(at(0.8, 0)); B.root.rotation.y = -Math.PI / 2;
  group.add(A.root, B.root);
  // what they quarrel over
  let pet = null, petR = 1.7, petSpeed = 2.4;
  if (story.over === 'goat') { pet = goat(M); petR = 2.1; petSpeed = 0.9; }
  else if (story.over === 'chicken') pet = chicken(M);
  else {
    const cab = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), M.greens);
    cab.position.copy(at(0, 0.05)).setY(0.24);
    cab.castShadow = true;
    group.add(cab);
  }
  if (pet) group.add(pet);
  // the crowd on the far side (the camera looks from -z)
  const crowd = CROWD.map((c, i) => {
    const P = person(M, c);
    const a = Math.PI * (0.18 + (0.64 * i) / (CROWD.length - 1));
    const r = 3.1 + rand01(seed, 'qcrowd', i) * 0.6;
    P.root.position.copy(at(Math.cos(a) * r, Math.sin(a) * r));
    P.root.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); // facing the centre
    group.add(P.root);
    return P;
  });
  const peace = story.step === 'peace';
  if (peace) { A.root.position.copy(at(-0.45, 0)); B.root.position.copy(at(0.45, 0)); } // close enough to shake hands
  const labels = [castTag(ca, lang), castTag(cb, lang)];
  const head = new THREE.Vector3();
  const banner = peace ? (lang === 'it' ? 'Hanno fatto pace!' : 'Friends again!') : st.square ? (lang === 'it' ? 'Lite in piazza!' : 'A quarrel in the square!') : (lang === 'it' ? 'Lite al pozzo!' : 'A quarrel at the well!');
  return {
    group,
    labels,
    banner,
    focus: st.toWorld(C.x, 1.2, C.z),
    cam(u) {
      const a = -Math.PI / 2 + 0.5 - 0.8 * u;
      return { pos: st.toWorld(C.x + Math.cos(a) * 6.3, 2.2, C.z + Math.sin(a) * 6.3), look: st.toWorld(C.x, 1.15, C.z) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0);
      if (peace) {
        // a long handshake (the hands pumping up and down), then both arms up together
        [A, B].forEach((P, k) => {
          const shake = u < 0.55;
          P.body.rotation.x = shake ? 0.08 : -0.05;
          P.r.g.rotation.set(shake ? -1.15 + 0.18 * Math.sin(t * 12) : -2.7 + 0.2 * Math.sin(t * 8 + k), 0, shake ? 0.32 : -0.2);
          P.l.g.rotation.set(shake ? -0.15 : -2.7 + 0.2 * Math.sin(t * 8 + k + 1), 0, shake ? 0.1 : 0.2);
          P.root.position.y = shake ? 0 : 0.1 * Math.abs(Math.sin(t * 8 + k));
          P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
        });
      }
      // they take turns: the one speaking leans in and waves both arms, the other shakes a fist
      const turn = Math.floor((t - t0) / 1.05) % 2;
      if (!peace) [A, B].forEach((P, k) => {
        const talking = k === turn, ph = t * 7.5 + k;
        P.body.rotation.x = talking ? 0.2 + 0.05 * Math.sin(ph) : -0.06;
        P.r.g.rotation.set(talking ? -1.3 - 0.7 * Math.sin(ph) : -2.5 + 0.25 * Math.sin(t * 11), 0, talking ? -0.2 : 0);
        P.l.g.rotation.set(talking ? -0.9 - 0.6 * Math.sin(ph + 1.4) : -0.2, 0, talking ? 0.3 : 0.5);
        P.root.position.y = talking ? 0.04 * Math.abs(Math.sin(ph)) : 0;
        P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
      });
      if (pet) {
        const a = (t - t0) * petSpeed * (peace ? 0.25 : 1); // calm again
        pet.position.copy(at(Math.cos(a) * petR, Math.sin(a) * petR * 0.6));
        pet.rotation.y = -a + Math.PI; // running along the circle
        pet.position.y = story.over === 'chicken' ? 0.05 * Math.abs(Math.sin(t * 18)) : 0;
      }
      crowd.forEach((P, i) => {
        const cheer = peace ? u > 0.5 || i % 2 === 0 : (i + Math.floor(t * 0.8)) % 3 === 0;
        P.r.g.rotation.x = cheer ? -2.7 + 0.3 * Math.sin(t * 9 + i) : -0.15;
        P.l.g.rotation.x = cheer ? -0.5 : -0.15;
        P.root.position.y = cheer ? 0.06 * Math.abs(Math.sin(t * 9 + i)) : 0;
        P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
      });
      [A, B].forEach((P, k) => labels[k].pos.copy(head.copy(P.root.position).setY(2.1 + k * 0.45)).applyMatrix4(group.matrix));
    },
  };
}
