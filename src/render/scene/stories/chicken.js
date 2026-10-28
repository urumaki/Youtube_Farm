// A hen loose in the tavern (owner 2026-10-25): it runs a figure-eight between the tables, flapping, with named villagers
// chasing it, arms out, while the drinkers laugh; at the end it flutters up onto the candle chandelier, out of reach, the
// chasers left grabbing at the air below. Inside the tavern (tavern.js, its own lamps), seen from high in the door corner.
import * as THREE from 'three';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { buildTavernInterior } from '../tavern.js';
import { person, stride, castTag, ease, clamp01 } from './common.js';

const F = 0.3; // the tavern's floor above its lot (tavern.js)
const FLY = 0.72; // the share of the shot spent running about, then it flies up
const PERCH = new THREE.Vector3(0.02, 2.66, 0.8); // on the chandelier's ring, between two candles (tavern.js)

function hen(M) {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: 0.8 });
  const add = (geo, m, parent = g) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; parent.add(o); return o; };
  add(new THREE.SphereGeometry(0.17, 12, 10).scale(1, 0.9, 1.25).translate(0, 0.3, 0), white);
  add(new THREE.SphereGeometry(0.09, 10, 8).translate(0, 0.48, 0.17), white);
  add(boxGeo(0.03, 0.07, 0.08).translate(0, 0.58, 0.17), M.clothRed); // the comb
  add(new THREE.ConeGeometry(0.03, 0.07, 4).rotateX(Math.PI / 2).translate(0, 0.47, 0.28), M.gold); // the beak
  add(new THREE.ConeGeometry(0.1, 0.18, 5).rotateX(-0.9).translate(0, 0.42, -0.2), white); // the tail
  for (const x of [-0.05, 0.05]) add(cylGeo(0.012, 0.012, 0.16, 4).translate(x, 0.08, 0), M.gold);
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Group();
    w.position.set(s * 0.15, 0.34, 0);
    add(new THREE.SphereGeometry(0.1, 8, 6).scale(0.3, 0.7, 1.2).translate(s * 0.04, -0.03, 0), white, w);
    g.add(w);
    return w;
  });
  return { g, wings };
}

export function buildChicken({ story, M, buildings, seed }) {
  const item = buildings.items.tavern;
  if (!item) return null;
  // the tavern as on a tavern day, its anonymous drinkers at the tables
  // (it lives inside the tavern building; `group` is only what main.js adds to the scene)
  const tav = buildTavernInterior({ item, M, seed });
  const room = tav.group, group = new THREE.Group();
  const toWorld = (v) => v.clone().applyMatrix4(item.group.matrix);
  const H = hen(M);
  H.g.scale.setScalar(1.5); // big enough to see from the corner
  room.add(H.g);
  // the run: a figure-eight in the aisle between the two rows of tables
  const path = (k) => new THREE.Vector3(-0.4 + Math.sin(k) * 2.5, F, 0.6 + Math.sin(2 * k) * 0.42);
  const heading = (k) => { const a = path(k), b = path(k + 0.02); return Math.atan2(b.x - a.x, b.z - a.z); };
  const chasers = story.cast.slice(0, 3).map((c, i) => {
    const P = person(M, JOBS[c.job]?.color || '#7a6a55');
    room.add(P.root);
    return { P, c, lag: 0.55 + i * 0.5 };
  });
  const labels = chasers.map(({ P, c }) => ({ ...castTag(c), P }));
  let T0 = 0, T1 = 1;
  const kAt = (t) => 0.4 + (t - T0) * 1.7;
  const tmp = new THREE.Vector3();
  const camFrom = new THREE.Vector3(-5.4, 3.15, -3.5), camTo = new THREE.Vector3(-4.6, 3.05, -3.55);
  return {
    group,
    labels,
    interior: true,
    banner: 'A hen in the tavern!',
    focus: toWorld(new THREE.Vector3(-0.4, 1.0, 0.6)),
    setWindow(t0, t1) { T0 = t0; T1 = t1; },
    cam(u) {
      const k = ease(u);
      const look = new THREE.Vector3(-0.4, 0.6, 0.6).lerp(PERCH.clone().setY(1.8), ease(clamp01((u - FLY) / 0.2)) * 0.7);
      return { pos: toWorld(camFrom.clone().lerp(camTo, k)), look: toWorld(look), fov: 70 };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      tav.update(t, on);
      if (!on) return;
      const tf = t0 + (t1 - t0) * FLY, flying = t > tf;
      const k = kAt(Math.min(t, tf));
      // the hen: a quick trot with its wings flapping; then up in an arc to the window and out
      if (!flying) {
        H.g.position.copy(path(k));
        H.g.position.y += 0.04 * Math.abs(Math.sin(t * 24));
        H.g.rotation.set(0, heading(k), 0);
      } else {
        const f = ease(clamp01((t - tf) / ((t1 - t0) * 0.22)));
        const from = path(k);
        H.g.position.copy(from).lerp(PERCH, f);
        H.g.position.y += Math.sin(Math.PI * f) * 0.5;
        H.g.rotation.set(f < 1 ? -0.4 : 0, f < 1 ? Math.atan2(PERCH.x - from.x, PERCH.z - from.z) : -2.4, 0);
      }
      const perched = flying && t - tf > (t1 - t0) * 0.22;
      H.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (perched ? 0.1 : 0.3 + 0.9 * Math.abs(Math.sin(t * (flying ? 30 : 18)))); });
      // the chasers behind it on the same path, arms out; at the window they stop and grab at the air
      chasers.forEach(({ P, lag }, i) => {
        const kc = k - lag;
        P.root.position.copy(path(kc)).setY(F);
        P.root.rotation.y = flying ? Math.atan2(PERCH.x - P.root.position.x, PERCH.z - P.root.position.z) : heading(kc);
        P.body.rotation.x = flying ? -0.1 : 0.3;
        if (!flying) {
          stride(P, (t - t0) * 12 + i, 0.6, { arms: false });
          P.r.g.rotation.set(-1.5 + 0.3 * Math.sin(t * 12 + i), 0, -0.25); P.l.g.rotation.set(-1.5 - 0.3 * Math.sin(t * 12 + i), 0, 0.25);
        } else {
          P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
          P.r.g.rotation.set(-2.8 + 0.3 * Math.sin(t * 10 + i), 0, -0.3); P.l.g.rotation.set(-2.6, 0, 0.3);
        }
      });
      for (const l of labels) l.pos.copy(toWorld(tmp.copy(l.P.root.position).setY(F + 2.3)));
    },
  };
}
