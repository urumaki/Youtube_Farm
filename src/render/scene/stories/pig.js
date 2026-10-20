// A pig got loose and runs wild through the market square, the farmer (a named villager when there is one)
// chasing it in figure-eights while the crowd laughs; at the end the farmer dives, catches it and holds it
// up. Comic, nobody gets hurt.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { person, stride, stage, castTag, ease, clamp01 } from './common.js';

const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d', '#56606e', '#b5476b'];
const CATCH = 0.72; // the share of the shot spent chasing

export function pigModel(M) {
  const g = new THREE.Group();
  const pink = M.people.clone();
  pink.color.set('#e8a5a0');
  const add = (geo, m, parent = g) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; parent.add(o); return o; };
  add(new THREE.SphereGeometry(0.34, 14, 10).scale(0.85, 0.8, 1.35).translate(0, 0.42, 0), pink);
  add(new THREE.SphereGeometry(0.2, 12, 8).translate(0, 0.5, 0.45), pink);
  add(cylGeo(0.09, 0.1, 0.1, 10).rotateX(Math.PI / 2).translate(0, 0.46, 0.66), pink); // snout
  for (const x of [-0.035, 0.035]) add(cylGeo(0.015, 0.015, 0.02, 6).rotateX(Math.PI / 2).translate(x, 0.47, 0.715), M.gear);
  for (const x of [-0.12, 0.12]) add(new THREE.ConeGeometry(0.07, 0.14, 4).rotateX(0.5).translate(x, 0.68, 0.42), pink); // ears
  add(new THREE.TorusGeometry(0.05, 0.015, 5, 10, Math.PI * 1.6).translate(0, 0.52, -0.47), pink); // curly tail
  const legs = [];
  for (const [x, z] of [[-0.14, -0.25], [0.14, -0.25], [-0.14, 0.25], [0.14, 0.25]]) {
    const l = new THREE.Group();
    l.position.set(x, 0.3, z);
    add(boxGeo(0.09, 0.3, 0.09).translate(0, -0.15, 0), pink, l);
    g.add(l);
    legs.push(l);
  }
  return { g, legs };
}

export function buildPig({ story, M, buildings, seed, lang }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const C = st.square ? new THREE.Vector3(3, 0, 2) : new THREE.Vector3(0, 0, 4.5);
  const RX = st.square ? 3.4 : 2.8, RZ = st.square ? 2.0 : 1.6;
  // a figure-eight across the square; `k` is how far along it is (radians)
  const path = (k) => new THREE.Vector3(C.x + Math.sin(k) * RX, 0, C.z + Math.sin(2 * k) * RZ);
  const heading = (k) => { const a = path(k), b = path(k + 0.02); return Math.atan2(b.x - a.x, b.z - a.z); };
  const pig = pigModel(M);
  group.add(pig.g);
  const chaser = story.cast[0];
  const F = person(M, JOBS[chaser?.job]?.color || JOBS.farmer.color);
  group.add(F.root);
  // the crowd on the far side (the camera looks from -z), laughing and pointing
  const crowd = CROWD.map((c, i) => {
    const P = person(M, c);
    const a = Math.PI * (0.12 + (0.76 * i) / (CROWD.length - 1));
    const r = RX + 2.4 + rand01(seed, 'pigcrowd', i) * 0.8;
    P.root.position.set(C.x + Math.cos(a) * r, 0, C.z + Math.sin(a) * (RZ + 3.2));
    P.root.rotation.y = Math.atan2(C.x - P.root.position.x, C.z - P.root.position.z);
    group.add(P.root);
    return P;
  });
  const labels = chaser ? [castTag(chaser, lang)] : [];
  const tmp = new THREE.Vector3();
  // where the chase is at time t (the pig ahead, the farmer gaining on it until the catch)
  const chase = (t, t0, t1) => {
    const tc = (t1 - t0) * CATCH;
    const run = Math.min(t - t0, tc);
    return { tc, caught: t - t0 >= tc, kPig: run * 1.25 + 0.6, kF: run * 1.25 + 0.6 - 0.75 + 0.35 * ease(clamp01((t - t0) / tc)) };
  };
  let T0 = 0, T1 = 1;
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Il maiale è scappato!' : 'The pig got loose!',
    focus: st.toWorld(C.x, 1.0, C.z),
    setWindow(t0, t1) { T0 = t0; T1 = t1; },
    cam(u) {
      // following the chase from the near side, a little behind the action so both are in frame
      const c = chase(T0 + u * (T1 - T0), T0, T1);
      const mid = path(c.kPig - 0.1).lerp(path(c.caught ? c.kPig - 0.12 : c.kF), 0.5);
      const a = -Math.PI / 2 + 0.25 - 0.4 * u;
      return { pos: st.toWorld(mid.x * 0.6 + C.x * 0.4 + Math.cos(a) * 7.5, 2.0, mid.z * 0.6 + C.z * 0.4 + Math.sin(a) * 7.5), look: st.toWorld(mid.x, 1.0, mid.z) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const { tc, caught, kPig, kF } = chase(t, t0, t1);
      // the pig: trotting fast, legs flicking; once caught, in the farmer's arms
      if (!caught) {
        pig.g.position.copy(path(kPig));
        pig.g.rotation.set(0, heading(kPig), 0);
        pig.g.position.y = 0.05 * Math.abs(Math.sin(t * 22));
        pig.legs.forEach((l, j) => { l.rotation.x = 0.7 * Math.sin(t * 22 + (j === 0 || j === 3 ? 0 : Math.PI)); });
      }
      // the farmer runs behind, arms out; dives at the catch, then stands and lifts the pig high
      const fp = path(caught ? kPig - 0.12 : kF);
      F.root.position.copy(fp);
      F.root.rotation.y = caught ? heading(kPig - 0.12) : heading(kF);
      F.body.rotation.set(0, 0, 0);
      if (!caught) {
        stride(F, (t - t0) * 13, 0.7, { arms: false });
        F.r.g.rotation.set(-1.4 + 0.3 * Math.sin(t * 13), 0, -0.2); F.l.g.rotation.set(-1.4 - 0.3 * Math.sin(t * 13), 0, 0.2);
        F.body.rotation.x = 0.25;
      } else {
        const lift = ease(clamp01((t - t0 - tc) / 0.6));
        F.legs[0].rotation.x = F.legs[1].rotation.x = 0;
        F.r.g.rotation.set(-1.2 - 1.6 * lift, 0, -0.2); F.l.g.rotation.set(-1.2 - 1.6 * lift, 0, 0.2);
        F.body.rotation.x = 0.35 * (1 - lift) - 0.08 * lift;
        F.root.updateMatrixWorld(true);
        // held between the hands: in front of the chest, then above the head
        pig.g.position.copy(F.root.position).add(tmp.set(0, 0, 0.45 - 0.35 * lift).applyAxisAngle(new THREE.Vector3(0, 1, 0), F.root.rotation.y));
        pig.g.position.y = 0.9 + 1.25 * lift;
        pig.g.rotation.set(0, F.root.rotation.y + Math.PI / 2, 0);
        pig.legs.forEach((l, j) => { l.rotation.x = 0.8 * Math.sin(t * 26 + j); }); // still kicking
      }
      // the crowd laughs (bobbing), points at the pig, cheers at the catch
      crowd.forEach((P, i) => {
        const ph = t * 9 + i * 1.3;
        P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
        if (caught) { P.r.g.rotation.set(-2.7 + 0.3 * Math.sin(ph), 0, -0.2); P.l.g.rotation.set(-2.5 + 0.3 * Math.sin(ph + 1), 0, 0.2); }
        else { P.r.g.rotation.set(i % 2 ? -1.5 : -0.4, 0, 0); P.l.g.rotation.set(-0.5 + 0.15 * Math.sin(ph), 0, 0.3); }
        P.body.rotation.x = caught ? -0.05 : 0.15 * Math.abs(Math.sin(ph)); // doubled up laughing
        P.root.position.y = caught ? 0.08 * Math.abs(Math.sin(ph)) : 0;
      });
      if (labels[0]) labels[0].pos.copy(F.root.position).setY(2.3).applyMatrix4(group.matrix);
    },
  };
}
