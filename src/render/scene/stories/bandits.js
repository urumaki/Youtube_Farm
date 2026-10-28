// Bandits with torches come down the mill track at dusk; the guards (with the named heroes in front)
// run out to meet them and the bandits flee, dropping their sack. Nobody gets hurt.
import * as THREE from 'three';
import { polyline } from '../../../sim/world.js';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { toolGeo } from '../work.js';
import { person, stride, torch, flicker, castTag, clamp01, ease } from './common.js';

const RAGS = ['#3b3026', '#2e2a2a', '#4a3b2a', '#3a3328', '#2f2b33', '#45382c', '#353029'];
const GUARD = '#7a1f2b';

export function buildBandits({ story, w, M, seed, yFn }) {
  const track = w.tracks.find((r) => r.id === 'mill') || w.roads[0];
  const pl = polyline(track.pts);
  const sM = Math.min(55, pl.total * 0.4); // where they meet, among the fields
  const group = new THREE.Group();
  group.visible = false;
  const hood = new THREE.ConeGeometry(0.25, 0.55, 10).translate(0, 1.15, -0.02);
  const hoodMat = M.people.clone();
  hoodMat.color.set('#1d1a17');
  const bandits = Array.from({ length: story.bandits || 6 }, (_, i) => {
    const P = person(M, RAGS[i % RAGS.length]);
    const h = new THREE.Mesh(hood, hoodMat); h.castShadow = true; P.body.add(h);
    if (i % 2 === 0) P.flame = torch(M, P.r.hand);
    else { const club = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.75, 6).translate(0, -0.25, 0.08), M.woodDark); club.castShadow = true; P.r.hand.add(club); }
    P.lat = (i / Math.max(1, (story.bandits || 6) - 1) - 0.5) * 4.6;
    P.lag = rand01(seed, 'band', i) * 2.2;
    group.add(P.root);
    return P;
  });
  // the first bandit carries the loot and drops it when they turn tail
  const sack = toolGeo('sack', M);
  bandits[0].l.hand.add(sack);
  const dropped = toolGeo('sack', M);
  dropped.visible = false;
  group.add(dropped);
  const heroes = (story.cast || []).map((c) => ({ c, P: person(M, JOBS[c.job]?.color || GUARD) }));
  // the guards on the ends of the line: named guards when there are some (owner 2026-10-25), in the guards' blue
  const guards = Array.from({ length: story.guards || 2 }, (_, i) => ({ c: null, g: story.guardCast?.[i] || null, P: person(M, GUARD) }));
  const defenders = [...heroes, ...guards];
  defenders.forEach((d, i) => {
    const sword = ['knight', 'warrior', 'cavalier'].includes(d.c?.job);
    d.P.r.hand.add(toolGeo(sword ? 'sword' : 'spear', M));
    // the heroes in the middle of the line, the guards on its ends
    const k = d.c ? i : i - heroes.length;
    d.lat = d.c ? (heroes.length > 1 ? (k ? 0.65 : -0.65) : 0) : (k % 2 ? 1 : -1) * (1.9 + Math.floor(k / 2) * 1.2);
    d.lead = d.c ? 0.8 : 0; // the heroes run in front
    group.add(d.P.root);
  });
  // torchlight that travels with the bandits, and a cool moonlight fill so everybody stays readable
  const light = new THREE.PointLight('#ff9a4a', 120, 30, 2);
  group.add(light);
  const moon = new THREE.HemisphereLight('#9fb4d8', '#2a2418', 1.1);
  group.add(moon);
  const labels = heroes.map((h) => castTag(h.c, 'Hero of the day'));
  const guardTags = guards.filter((d) => d.g).map((d) => ({ d, tag: castTag(d.g) }));
  labels.push(...guardTags.map((x) => x.tag));
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
    banner: 'Bandits attack!',
    phase: 0.75, // at dusk (the timeline's own value for night stories is replaced by this one)
    focus: M0.clone().setY(M0.y + 1),
    cam(u) {
      // behind the defenders, along the track (the track is free of trees): the bandits run at the camera
      const pos = M0.clone().addScaledVector(tan, -9 + 1.5 * u).addScaledVector(nrm, 1.6);
      pos.y = yFn(pos.x, pos.z) + 3.3;
      return { pos, look: M0.clone().addScaledVector(tan, 3 + 1.5 * u).setY(M0.y + 0.9) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      light.visible = moon.visible = group.visible;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0);
      const turned = u > 0.58;
      let cx = 0, cz = 0;
      bandits.forEach((B, i) => {
        let s, amp;
        if (u < 0.42) { s = sM + 13 + B.lag - (11.2 + B.lag) * (u / 0.42); amp = 0.8; }
        else if (!turned) { s = sM + 1.8 + 0.5 * ease((u - 0.42) / 0.16); amp = 0.15; }
        else { s = sM + 2.3 + (u - 0.58) * 34; amp = 0.9; }
        place(B.root, s, B.lat, turned);
        stride(B, s * 3.2 + i, amp, { arms: false });
        B.r.g.rotation.x = B.flame ? -2.1 : turned ? -2.9 : -1.2 - 0.9 * Math.abs(Math.sin(t * 6 + i)); // torch high, clubs waving
        B.l.g.rotation.x = !turned && u > 0.42 ? -2.6 : -0.5 + 0.5 * Math.sin(s * 3.2); // hands up in fright
        if (B.flame) flicker(B.flame, t, i);
        cx += B.root.position.x; cz += B.root.position.z;
      });
      sack.visible = !turned;
      if (turned && !dropped.visible) {
        dropped.visible = true;
        place(dropped, sM + 2.3, bandits[0].lat, false);
        dropped.position.y += 0.25;
      }
      if (!turned) dropped.visible = false;
      defenders.forEach((d, i) => {
        let s, amp;
        if (u < 0.42) { s = sM - 11 + 9.2 * (u / 0.42) + d.lead; amp = 0.8; }
        else if (u < 0.6) { s = sM - 1.8 + d.lead; amp = 0; }
        else { s = sM - 1.8 + d.lead + 2.5 * ease((u - 0.6) / 0.3); amp = u < 0.9 ? 0.4 : 0; }
        place(d.P.root, s, d.lat, true);
        stride(d.P, s * 3 + i, amp, { arms: false });
        const cheer = u > 0.78;
        d.P.r.g.rotation.x = cheer ? -2.9 + 0.2 * Math.sin(t * 10 + i) : u > 0.42 ? -1.5 : -0.6;
        d.P.l.g.rotation.x = cheer ? -2.6 : -0.4;
      });
      light.position.set(cx / bandits.length, M0.y + 2.6, cz / bandits.length);
      heroes.forEach((h, k) => labels[k].pos.copy(h.P.root.position).add(new THREE.Vector3(0, 2.3 + k * 0.5, 0)));
      guardTags.forEach(({ d, tag }) => tag.pos.copy(d.P.root.position).add(new THREE.Vector3(0, 2.3, 0)));
    },
  };
}
