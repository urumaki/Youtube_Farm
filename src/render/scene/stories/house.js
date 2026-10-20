// Stories at one house: a fire put out by a bucket chain of neighbours (nobody gets hurt), and the next
// day the carpenters rebuilding it. House-local frame: x along the street, z toward the croft (the front
// door faces -z), y up from the house's floor.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { FLOOR_H } from '../houseKit.js';
import { toolGeo } from '../work.js';
import { person, flameMaterial, flicker, castTag, clamp01 } from './common.js';

const NEIGHBOURS = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#7b6a43'];

function houseStage(houses, id) {
  const sh = houses.shapes.get(id);
  if (!sh) return null;
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(sh.matrix);
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(sh.matrix);
  const wallH = sh.floors * FLOOR_H;
  return { sh, group, toWorld, W: sh.W, D: sh.D, wallH, roofH: sh.D * 0.5 };
}

/** High over the street, above the roofs across it, looking down at the roof and the people in front. */
function streetCam(st, u) {
  return { pos: st.toWorld(st.W / 2 + 4 - 6 * u, st.wallH + 7, -st.D / 2 - 17), look: st.toWorld(1, st.wallH * 0.75, -st.D / 2) };
}

function particles(n, color, size, opacity) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false }));
  pts.frustumCulled = false;
  return pts;
}

export function buildFire({ story, M, houses, seed, lang }) {
  const st = houseStage(houses, story.house);
  if (!st) return null;
  const { group, W, D, wallH, roofH } = st;
  group.visible = false;
  // flames on the front slope of the roof and in two windows; the roof surface is found by casting a ray
  // down onto the town's houses (roof shapes vary)
  houses.group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const roofAt = (x, z) => {
    ray.set(st.toWorld(x, 40, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(houses.group, true)[0];
    return hit ? hit.point.y - st.sh.base - 0.25 : wallH + roofH * (1 - Math.abs(z) / (D / 2));
  };
  const roofY = roofAt(0, 0);
  const spots = [[-W * 0.25, roofAt(-W * 0.25, -D * 0.15), -D * 0.15, 2.0], [W * 0.12, roofAt(W * 0.12, -D * 0.05), -D * 0.05, 2.4], [W * 0.33, roofAt(W * 0.33, -D * 0.25), -D * 0.25, 1.7],
    [-W * 0.25, 1.5, -D / 2 - 0.05, 0.6], [W * 0.22, 1.5, -D / 2 - 0.05, 0.55]];
  const flames = [];
  spots.forEach(([x, y, z, s], i) => {
    for (const [c, r, h] of [['#ff6a1a', 0.55, 1.6], ['#ffb347', 0.38, 1.15], ['#ffe08a', 0.2, 0.75]]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(r * s, h * s, 9).translate(0, (h * s) / 2, 0), flameMaterial(c));
      f.position.set(x + (c === '#ffb347' ? 0.15 : 0), y, z);
      f.userData = { k: i * 3 + flames.length % 3, base: s };
      group.add(f);
      flames.push(f);
    }
  });
  const glow = new THREE.PointLight('#ff7a2a', 90, 26, 2);
  glow.position.set(0, roofY, -D / 2 - 1.5);
  group.add(glow);
  // smoke over the roof, dark while it burns and pale when the fire is out
  const smoke = particles(140, '#3a3633', 1.5, 0.4);
  group.add(smoke);
  // the bucket chain: from a trough along the street to the front of the house
  const lineZ = -D / 2 - 2.6, x0 = W / 2 + 3.2;
  const trough = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.9).translate(0, 0.3, 0), M.wood);
  trough.position.set(x0 + 1.3, 0, lineZ);
  group.add(trough);
  const water = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.7), new THREE.MeshStandardMaterial({ color: '#46707f', roughness: 0.15 }));
  water.position.set(x0 + 1.3, 0.55, lineZ);
  group.add(water);
  const cast = story.cast || [];
  const chain = Array.from({ length: 6 }, (_, i) => {
    const c = i < cast.length ? cast[i] : null;
    const P = person(M, c ? JOBS[c.job]?.color || '#7a6a55' : NEIGHBOURS[i]);
    // the heroes throw the water, at the house end of the line
    const x = c ? -W * 0.15 + i * 1.1 : x0 - (5 - i) * 1.0;
    P.root.position.set(x, 0, c ? lineZ + 0.9 : lineZ);
    P.root.rotation.y = c ? Math.PI : Math.PI / 2; // throwers face the house, the chain faces along the street
    group.add(P.root);
    return { P, c, x };
  });
  const throwers = chain.filter((m) => m.c);
  if (!throwers.length) { // no named villagers: the first two neighbours throw
    chain.slice(0, 2).forEach((m, i) => { m.x = -W * 0.15 + i * 1.1; m.P.root.position.set(m.x, 0, lineZ + 0.9); m.P.root.rotation.y = Math.PI; throwers.push(m); });
  }
  const passers = chain.filter((m) => !throwers.includes(m));
  for (const m of [...throwers, ...passers]) m.P.r.hand.add(toolGeo('bucket', M));
  const splash = particles(60, '#cfe6f2', 0.12, 0.85);
  group.add(splash);
  const labels = throwers.filter((m) => m.c).map((m) => ({ m, ...castTag(m.c, lang, lang === 'it' ? 'Eroe del giorno' : 'Hero of the day') }));
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Al fuoco!' : 'Fire!',
    focus: st.toWorld(0, wallH, 0),
    cam: (u) => streetCam(st, u),
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      glow.visible = group.visible;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      const fire = 1 - 0.92 * clamp01((u - 0.3) / 0.6); // the buckets win
      for (const f of flames) { flicker(f, t, f.userData.k); f.scale.multiplyScalar(Math.max(0.05, fire)); f.visible = fire > 0.06; }
      glow.intensity = 90 * fire * (1 + 0.15 * Math.sin(t * 19));
      const sp = smoke.geometry.attributes.position.array;
      for (let i = 0; i < 140; i++) {
        const r = (q) => rand01(seed, 'smoke', i, q);
        const age = ((t * 0.6 + r(0)) % 1);
        sp[i * 3] = (r(1) - 0.5) * W * 0.7 + age * 2.5;
        sp[i * 3 + 1] = roofY + 0.8 + age * 9;
        sp[i * 3 + 2] = (r(2) - 0.5) * D * 0.5 + age * 1.2;
      }
      smoke.geometry.attributes.position.needsUpdate = true;
      smoke.material.color.set(fire > 0.4 ? '#3a3633' : '#9a9590');
      // buckets pass along the line (arms swing from one side to the other)
      passers.forEach(({ P }, i) => {
        const ph = t * 4.2 + i * 1.3;
        P.r.g.rotation.set(-0.9 - 0.4 * Math.sin(ph), 0, 0.6 * Math.sin(ph));
        P.l.g.rotation.set(-0.9 - 0.4 * Math.sin(ph), 0, 0.6 * Math.sin(ph));
        P.body.rotation.y = 0.5 * Math.sin(ph);
        P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
      });
      // the throwers swing the bucket up at the fire
      const arr = splash.geometry.attributes.position.array;
      throwers.forEach(({ P }, k) => {
        const c = (t * 0.9 + k * 0.5) % 1;
        const a = c < 0.6 ? -0.4 - 0.5 * (c / 0.6) : -0.9 - 1.6 * Math.sin(((c - 0.6) / 0.4) * Math.PI);
        P.r.g.rotation.set(a, 0, -0.2); P.l.g.rotation.set(a, 0, 0.2);
        P.body.rotation.x = c > 0.6 ? -0.15 : 0.1;
        P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
        for (let i = 0; i < 30; i++) {
          const j = (k * 30 + i) * 3, age = c - 0.75;
          if (age < 0 || fire < 0.08) { arr[j] = arr[j + 1] = arr[j + 2] = 1e4; continue; }
          const r = (q) => rand01(seed, 'spl', k, i, q);
          arr[j] = P.root.position.x + (r(0) - 0.5) * 0.8;
          arr[j + 1] = 1.6 + age * 7 * (0.6 + r(1)) - 9 * age * age;
          arr[j + 2] = P.root.position.z - 0.5 - age * 7 * (0.6 + r(2) * 0.6);
        }
      });
      splash.geometry.attributes.position.needsUpdate = true;
      for (const lb of labels) lb.pos.copy(tmp.copy(lb.m.P.root.position).setY(2.3 + 0.45 * labels.indexOf(lb))).applyMatrix4(group.matrix);
    },
  };
}

export function buildRebuild({ story, M, houses, seed, lang }) {
  const st = houseStage(houses, story.house);
  if (!st) return null;
  const { group, W, D, wallH } = st;
  group.visible = false;
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  // scaffolding along the front, a plank on it, a cart of fresh timber and a sawhorse
  const fz = -D / 2 - 1.1;
  for (let x = -W / 2; x <= W / 2 + 0.01; x += W / 3) for (const z of [fz, -D / 2 - 0.15]) add(new THREE.CylinderGeometry(0.08, 0.08, wallH + 1.5, 6), M.wood, x, (wallH + 1.5) / 2, z);
  add(new THREE.BoxGeometry(W + 0.6, 0.1, 1.0), M.wood, 0, 2.6, fz + 0.45);
  add(new THREE.BoxGeometry(W + 0.6, 0.08, 0.08), M.woodDark, 0, 3.6, fz);
  for (let i = 0; i < 6; i++) add(new THREE.BoxGeometry(3.2, 0.12, 0.3), M.wood, W / 2 + 4.2, 0.5 + Math.floor(i / 3) * 0.13, -D / 2 - 4 + (i % 3) * 0.32);
  add(new THREE.BoxGeometry(0.2, 0.7, 1.6), M.woodDark, W / 2 + 4.2, 0.35, -D / 2 - 3.7);
  add(new THREE.BoxGeometry(1.4, 0.08, 0.3), M.wood, -W / 2 - 2.5, 0.8, -D / 2 - 3);
  for (const x of [-0.55, 0.55]) add(new THREE.BoxGeometry(0.08, 0.8, 0.5), M.woodDark, -W / 2 - 2.5 + x, 0.4, -D / 2 - 3);
  // the crew: one on the scaffold hammering at the wall, one at the sawhorse, one carrying a plank
  const cast = story.cast || [];
  const spots = [[-W * 0.2, 2.65, fz + 0.45, 0], [-W / 2 - 2.5, 0, -D / 2 - 2.35, Math.PI], [W * 0.25, 2.65, fz + 0.45, 0]];
  const crew = spots.map(([x, y, z, ry], i) => {
    const c = cast[i] || null;
    const P = person(M, c ? JOBS[c.job]?.color || '#9c6b3c' : JOBS.carpenter.color);
    P.root.position.set(x, y, z);
    P.root.rotation.y = ry;
    P.r.hand.add(toolGeo('hammer', M));
    group.add(P.root);
    return { P, c };
  });
  const labels = crew.filter((m) => m.c).map((m) => ({ m, ...castTag(m.c, lang) }));
  const tmp = new THREE.Vector3();
  const offset = (i) => rand01(seed, 'reb', i) * 0.6;
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Si ricostruisce la casa' : 'Rebuilding the house',
    focus: st.toWorld(0, wallH, 0),
    cam: (u) => streetCam(st, u),
    strikePeriod: 0.6,
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      if (!group.visible) return;
      crew.forEach(({ P }, i) => {
        const c = ((t + offset(i)) / 0.6) % 1;
        const a = c < 0.6 ? -1.0 - 0.9 * (c / 0.6) : -1.9 + 0.9 * ((c - 0.6) / 0.4) ** 2;
        P.r.g.rotation.set(a, 0, 0);
        P.l.g.rotation.set(-1.0, 0, 0.2);
        P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
      });
      for (const lb of labels) lb.pos.copy(tmp.copy(lb.m.P.root.position).add(new THREE.Vector3(0, 2.3, 0))).applyMatrix4(group.matrix);
    },
  };
}
