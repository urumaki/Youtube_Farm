// The big catch (owner 2026-10-25), two quiet days in the market square. 'catch': two villagers carry a huge fish hung
// from a pole on their shoulders into the square, the fisherman (a named one when there is one) striding beside it,
// waving; the crowd gathers and gasps. 'roast': the fish turns on a spit over a fire, the fisherman at the crank, the
// newest named villagers round it with their bowls, eating.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { cylGeo } from '../kit.js';
import { toolGeo } from '../work.js';
import { person, stride, stage, castTag, bonfire, ease, clamp01 } from './common.js';

const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d', '#56606e'];
const ARRIVE = 0.55; // the share of the shot the carriers walk in

/** A fish about 2.2 m long along +x, belly down, centred on its middle. */
function hugeFish(M, roast = false) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: roast ? '#b07a3a' : '#8fa6b4', roughness: roast ? 0.7 : 0.35, metalness: roast ? 0 : 0.25 });
  const add = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; g.add(m); return m; };
  add(new THREE.SphereGeometry(1, 18, 12).scale(0.95, 0.34, 0.24), skin);
  add(new THREE.ConeGeometry(0.34, 0.5, 4).rotateZ(-Math.PI / 2).scale(1, 1, 0.25).translate(-1.1, 0, 0), skin); // the tail: narrow at the body, wide at the end
  add(new THREE.ConeGeometry(0.14, 0.3, 3).translate(0.1, 0.38, 0), skin); // the back fin
  for (const z of [-0.2, 0.2]) add(new THREE.SphereGeometry(0.05, 8, 6).translate(0.72, 0.08, z), M.gear); // eyes
  return g;
}

export function buildBigFish({ story, M, buildings, seed, lang }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const roast = story.step === 'roast';
  const C = st.square ? new THREE.Vector3(3, 0, 2) : new THREE.Vector3(0, 0, 4.5);
  const [fisher, ...rest] = story.cast;
  const F = person(M, JOBS[fisher?.job]?.color || JOBS.fisherman.color);
  group.add(F.root);
  const fish = hugeFish(M, roast);
  group.add(fish);
  const labels = fisher ? [{ ...castTag(fisher, lang), P: F }] : [];
  let carriers = [], guests = [], fire = null, spit = null;
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; group.add(m); return m; };
  if (!roast) {
    // the pole on two shoulders, the fish hanging under it by two ropes
    carriers = [0, 1].map((i) => {
      const c = rest[i] || null, P = person(M, c ? JOBS[c.job]?.color || CROWD[i] : CROWD[i]);
      group.add(P.root);
      if (c) labels.push({ ...castTag(c, lang), P });
      return P;
    });
    spit = new THREE.Group();
    const pole = new THREE.Mesh(cylGeo(0.05, 0.05, 3.4, 8).rotateZ(Math.PI / 2), M.woodDark);
    pole.castShadow = true;
    spit.add(pole);
    for (const x of [-0.6, 0.6]) { const rope = new THREE.Mesh(cylGeo(0.012, 0.012, 0.35, 4).translate(0, -0.17, 0), M.rope || M.woodDark); rope.position.x = x; spit.add(rope); }
    group.add(spit);
  } else {
    // the fire, two forked posts and the spit through the fish; the guests round it with bowls
    fire = bonfire(group, M, C.clone().add(new THREE.Vector3(0, 0, 1)), 25);
    for (const x of [-1.5, 1.5]) add(cylGeo(0.05, 0.06, 1.6, 6), M.woodDark, C.x + x, 0.8, C.z + 1);
    add(cylGeo(0.04, 0.04, 3.4, 6).rotateZ(Math.PI / 2), M.iron, C.x, 1.55, C.z + 1);
    fish.position.set(C.x, 1.55, C.z + 1);
    F.root.position.set(C.x + 2.0, 0, C.z + 1.15);
    F.root.rotation.y = -Math.PI / 2;
    guests = rest.slice(0, 5).map((c, i) => {
      const a = (i - 2) * 0.5, P = person(M, JOBS[c.job]?.color || CROWD[i]); // on the far side of the fire, facing the camera
      P.root.position.set(C.x + Math.sin(a) * 2.4, 0, C.z + 1 + Math.cos(a) * 2.2);
      P.root.rotation.y = Math.atan2(C.x - P.root.position.x, C.z + 1 - P.root.position.z);
      P.r.hand.add(toolGeo('bowl', M));
      group.add(P.root);
      labels.push({ ...castTag(c, lang), P });
      return { P, ph: rand01(seed, 'fishbowl', i) * 6 };
    });
  }
  // onlookers on the far side
  const crowd = CROWD.slice(0, roast ? 4 : 7).map((col, i) => {
    const P = person(M, col);
    P.root.position.set(C.x - 3 + i * (roast ? 2 : 1.0), 0, C.z + 3.6 + (i % 2) * 0.6);
    P.root.rotation.y = Math.PI;
    group.add(P.root);
    return P;
  });
  // the walk in: from the near left across to the middle of the square, along +x
  const walk = (u) => C.clone().add(new THREE.Vector3(-5.5 + 5.5 * ease(Math.min(1, u / ARRIVE)), 0, 0.4));
  return {
    group,
    labels,
    banner: roast ? (lang === 'it' ? 'Pesce arrosto per tutti!' : 'Roast fish for everyone!') : lang === 'it' ? 'Che pesca!' : 'What a catch!',
    focus: st.toWorld(C.x, 1.2, C.z + 0.6),
    cam(u) {
      if (roast) {
        const a = -Math.PI / 2 - 0.3 + 0.45 * u;
        return { pos: st.toWorld(C.x + Math.cos(a) * 5.6, 2.9, C.z + 1 + Math.sin(a) * 5.6), look: st.toWorld(C.x, 1.25, C.z + 1.4) };
      }
      const p = walk(u);
      return { pos: st.toWorld(p.x + 0.5, 3.0, C.z - 6.6), look: st.toWorld(p.x + 0.5, 1.1, C.z + 0.4) }; // square on: the fisherman, the fish and both carriers
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (fire) fire.update(t, group.visible);
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0)), here = u >= ARRIVE;
      if (!roast) {
        const p = walk(u), go = here ? 0 : 0.5;
        carriers.forEach((P, i) => {
          P.root.position.copy(p).add(new THREE.Vector3(i ? -1.4 : 1.4, 0, 0));
          P.root.rotation.y = Math.PI / 2;
          stride(P, (t - t0) * 9 + i * Math.PI, go, { arms: false });
          // one hand up on the pole at the shoulder
          P.r.g.rotation.set(-2.6, 0, -0.35); P.l.g.rotation.set(here ? -0.3 : 0.2 * Math.sin(t * 9), 0, 0.1);
        });
        const bob = here ? 0 : 0.04 * Math.sin(t * 18);
        spit.position.copy(p).setY(1.62 + bob);
        fish.position.copy(p).setY(1.62 + bob - 0.62);
        fish.rotation.z = here ? 0.04 * Math.sin(t * 2) : 0.08 * Math.sin(t * 9);
        // the fisherman walks ahead of it, then turns to the crowd, arms wide
        F.root.position.copy(p).add(new THREE.Vector3(2.4, 0, -0.6)); // leading the way, the fish behind him in full view
        F.root.rotation.y = here ? Math.PI : Math.PI / 2;
        stride(F, (t - t0) * 9, go, { arms: !here });
        if (here) { F.r.g.rotation.set(-1.0, 0, -1.2); F.l.g.rotation.set(-1.0, 0, 1.2); }
      } else {
        fish.rotation.x = t * 1.6; // turning on the spit
        F.r.g.rotation.set(-1.3 + 0.35 * Math.sin(t * 1.6), 0, -0.2); F.l.g.rotation.set(-0.3, 0, 0.1);
        guests.forEach(({ P, ph }) => {
          // a spoonful now and then
          const bite = Math.max(0, Math.sin(t * 1.7 + ph)) ** 6;
          P.r.g.rotation.set(-1.0 - 1.1 * bite, 0, -0.1);
          P.l.g.rotation.set(-0.9, 0, 0.3);
        });
      }
      crowd.forEach((P, i) => {
        const ph = t * 7 + i, wow = roast || here;
        P.r.g.rotation.set(wow ? -1.6 - 0.8 * Math.abs(Math.sin(ph)) : -0.3, 0, -0.2);
        P.l.g.rotation.set(wow && i % 2 ? -2.4 : -0.3, 0, 0.2);
      });
      for (const l of labels) l.pos.copy(l.P.root.position).setY(l.P.root.position.y + 2.3).applyMatrix4(group.matrix);
    },
  };
}
