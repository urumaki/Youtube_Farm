// Wolves come out of the western forest at night along the sawmill track; villagers with torches (named
// heroes in front) wave them off, the pack howls once and runs back into the trees. Nobody gets hurt.
import * as THREE from 'three';
import { polyline } from '../../../sim/world.js';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { person, stride, torch, flicker, castTag, clamp01, ease } from './common.js';

const FOLK = ['#7a5b3a', '#5f6f7a', '#8a6d4f', '#6f7d4a'];

/** A grey wolf facing +z, legs on pivots, eyes that catch the torchlight. */
function wolf(M, seed, k) {
  const g = new THREE.Group();
  const fur = M.people.clone();
  fur.color.set(['#6d6a66', '#5a5753', '#7c7770', '#4f4c49'][k % 4]);
  const add = (geo, mat, parent = g) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };
  add(new THREE.BoxGeometry(0.42, 0.42, 1.1).translate(0, 0.72, 0), fur);
  const head = new THREE.Group();
  head.position.set(0, 0.92, 0.6);
  g.add(head);
  add(new THREE.BoxGeometry(0.34, 0.32, 0.36).translate(0, 0, 0.1), fur, head);
  add(new THREE.BoxGeometry(0.18, 0.16, 0.3).translate(0, -0.06, 0.4), fur, head);
  for (const x of [-0.1, 0.1]) add(new THREE.ConeGeometry(0.06, 0.18, 4).translate(x, 0.22, 0.02), fur, head);
  const eye = new THREE.MeshBasicMaterial({ color: '#ffd84a' });
  for (const x of [-0.09, 0.09]) add(new THREE.SphereGeometry(0.03, 6, 5).translate(x, 0.05, 0.28), eye, head);
  const tail = add(new THREE.CylinderGeometry(0.05, 0.09, 0.6, 6).rotateX(-1.0).translate(0, 0.78, -0.75), fur);
  const legs = [];
  for (const [x, z] of [[-0.14, 0.4], [0.14, 0.4], [-0.14, -0.4], [0.14, -0.4]]) {
    const l = new THREE.Group();
    l.position.set(x, 0.55, z);
    add(new THREE.BoxGeometry(0.11, 0.55, 0.11).translate(0, -0.27, 0), fur, l);
    g.add(l);
    legs.push(l);
  }
  g.scale.setScalar(0.95 + rand01(seed, 'wolf', k) * 0.2);
  return { g, head, tail, legs };
}

export function buildWolves({ story, w, M, seed, yFn, lang }) {
  const track = w.tracks.find((r) => r.id === 'saw') || w.roads[0];
  const pl = polyline(track.pts);
  const sM = pl.total * 0.45; // where they meet, at the forest edge by the sawmill track
  const group = new THREE.Group();
  group.visible = false;
  const wolves = Array.from({ length: story.wolves || 5 }, (_, k) => {
    const W = wolf(M, seed, k);
    W.lat = (k / Math.max(1, (story.wolves || 5) - 1) - 0.5) * 5;
    W.lag = rand01(seed, 'wlag', k) * 2.5;
    group.add(W.g);
    return W;
  });
  const heroes = (story.cast || []).map((c) => ({ c, P: person(M, JOBS[c.job]?.color || FOLK[0]) }));
  const folk = Array.from({ length: Math.max(2, 4 - heroes.length) }, (_, i) => ({ c: null, P: person(M, FOLK[i % FOLK.length]) }));
  const people = [...heroes, ...folk];
  people.forEach((d, i) => {
    d.flame = torch(M, d.P.r.hand);
    const k = d.c ? i : i - heroes.length;
    d.lat = d.c ? (heroes.length > 1 ? (k ? 0.7 : -0.7) : 0) : (k % 2 ? 1 : -1) * (1.9 + Math.floor(k / 2) * 1.2);
    d.lead = d.c ? 0.7 : 0;
    group.add(d.P.root);
  });
  const torchLight = new THREE.PointLight('#ffa65a', 110, 28, 2);
  const moon = new THREE.HemisphereLight('#8fa6d6', '#1c1a16', 1.0);
  group.add(torchLight, moon);
  const labels = heroes.map((h) => castTag(h.c, lang, lang === 'it' ? 'Eroe del giorno' : 'Hero of the day'));
  const P = new THREE.Vector3();
  const place = (obj, s, lateral, back) => {
    const [x, z, ang] = pl.at(Math.max(0, Math.min(pl.total, s)));
    P.set(x - Math.sin(ang) * lateral, 0, z + Math.cos(ang) * lateral);
    P.y = yFn(P.x, P.z);
    if (obj) { obj.position.copy(P); obj.rotation.y = -ang - Math.PI / 2 + (back ? Math.PI : 0); }
    return ang;
  };
  const meet = place(null, sM, 0);
  const M0 = P.clone(), tan = new THREE.Vector3(Math.cos(meet), 0, Math.sin(meet)), nrm = new THREE.Vector3(-Math.sin(meet), 0, Math.cos(meet));
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Lupi nella notte!' : 'Wolves in the night!',
    phase: 0.8,
    focus: M0.clone().setY(M0.y + 1),
    cam(u) {
      // behind the villagers, along the track: the pack comes out of the dark toward the camera
      const pos = M0.clone().addScaledVector(tan, -12 + 2 * u).addScaledVector(nrm, 1.4);
      pos.y = yFn(pos.x, pos.z) + 3.8;
      return { pos, look: M0.clone().addScaledVector(tan, 3.5 + 1.5 * u).setY(M0.y + 0.4) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      torchLight.visible = moon.visible = group.visible;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      const fled = u > 0.6;
      // the wolves walk this way (they come toward lower s), stop and howl, then run back to the trees
      wolves.forEach((W, k) => {
        let s, trot;
        if (u < 0.4) { s = sM + 14 + W.lag - (10.5 + W.lag) * (u / 0.4); trot = 1; }
        else if (!fled) { s = sM + 3.5 + 0.3 * ease((u - 0.4) / 0.2); trot = 0; }
        else { s = sM + 3.8 + (u - 0.6) * 30; trot = 1.6; }
        place(W.g, s, W.lat, fled);
        const ph = s * 4 + k;
        W.legs.forEach((l, j) => { l.rotation.x = trot * 0.5 * Math.sin(ph + (j === 0 || j === 3 ? 0 : Math.PI)); });
        W.g.position.y += trot * 0.04 * Math.abs(Math.sin(ph));
        // the leader lifts its head and howls while the pack stands
        const howl = !fled && u > 0.42 && k === Math.floor(wolves.length / 2);
        W.head.rotation.x = howl ? -0.9 : 0.1 * Math.sin(t * 3 + k);
        W.tail.rotation.x = fled ? 0.5 : 0;
      });
      let cx = 0, cz = 0;
      people.forEach((d, i) => {
        let s, amp;
        if (u < 0.4) { s = sM - 6.5 + 4.5 * (u / 0.4) + d.lead; amp = 0.5; }
        else { s = sM - 2 + d.lead + 0.8 * ease((u - 0.4) / 0.4); amp = 0; }
        place(d.P.root, s, d.lat, true);
        stride(d.P, s * 3 + i, amp, { arms: false });
        // torches high and waving once the wolves stand in front of them
        d.P.r.g.rotation.x = u > 0.38 ? -2.6 + 0.35 * Math.sin(t * 8 + i) : -1.4;
        d.P.l.g.rotation.x = -0.4;
        flicker(d.flame, t, i);
        cx += d.P.root.position.x; cz += d.P.root.position.z;
      });
      torchLight.position.set(cx / people.length, M0.y + 2.8, cz / people.length);
      heroes.forEach((h, k) => labels[k].pos.copy(h.P.root.position).add(new THREE.Vector3(0, 2.3 + k * 0.5, 0)));
    },
  };
}
