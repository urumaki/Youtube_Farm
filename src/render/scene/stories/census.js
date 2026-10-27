// The census (owner 2026-10-27): at a table in front of the Counting House the clerk (a named reeve, tax collector or teacher
// when there is one) writes in a great ledger while named villagers queue up and step forward one by one; the title counts
// up to the kingdom's number (1 subscriber = 1 villager). In the Counting House lot's frame: the door and the street at +z.
import * as THREE from 'three';
import { JOBS } from '../../../sim/tiers.js';
import { boxGeo, cylGeo } from '../kit.js';
import { rig } from '../work.js';
import { person, stride, castTag, ease, clamp01 } from './common.js';

const TABLE = new THREE.Vector3(-1.8, 0, 2.3);
const STEP = 1.15; // seconds between villagers at the table
const GAP = 0.95; // between villagers in the queue

export function buildCensus({ story, M, buildings, yFn, lang }) {
  const item = buildings.items.counting_house;
  if (!item) return null;
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(item.group.matrix);
  group.visible = false;
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrix);
  const gy = (x, z) => { const p = toWorld(x, 0, z); return Math.max(0.05, yFn(p.x, p.z) - item.base); };
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  const y0 = gy(TABLE.x, TABLE.z);
  // the table with its cloth, the open ledger, an inkwell; the clerk's stool behind it, against the house
  add(boxGeo(1.8, 0.08, 0.9), M.wood, TABLE.x, y0 + 0.78, TABLE.z);
  for (const [x, z] of [[-0.8, -0.38], [0.8, -0.38], [-0.8, 0.38], [0.8, 0.38]]) add(boxGeo(0.08, 0.78, 0.08), M.woodDark, TABLE.x + x, y0 + 0.39, TABLE.z + z);
  add(boxGeo(1.9, 0.5, 0.02), M.clothRed, TABLE.x, y0 + 0.58, TABLE.z + 0.46);
  add(boxGeo(0.9, 0.06, 0.6), M.clothIvory, TABLE.x, y0 + 0.85, TABLE.z);
  add(boxGeo(0.04, 0.07, 0.6), M.woodDark, TABLE.x, y0 + 0.86, TABLE.z); // the ledger's spine
  add(cylGeo(0.05, 0.06, 0.08, 8), M.iron, TABLE.x + 0.65, y0 + 0.86, TABLE.z - 0.15);
  add(boxGeo(0.45, 0.45, 0.45), M.woodDark, TABLE.x, y0 + 0.22, TABLE.z - 0.75);
  const clerkC = story.clerk || null;
  const C = rig(M, JOBS[clerkC?.job]?.color || JOBS.taxcollector?.color || '#4a4a6a', { seated: true });
  C.root.position.set(TABLE.x, y0, TABLE.z - 0.75);
  group.add(C.root);
  const quill = new THREE.Mesh(cylGeo(0.008, 0.02, 0.32, 5).translate(0, 0.12, 0.05).rotateX(0.5), M.clothIvory);
  C.r.hand.add(quill);
  const labels = clerkC ? [{ ...castTag(clerkC, lang, lang === 'it' ? 'Lo scrivano' : 'The clerk'), P: C, dy: 1.9 }] : [];
  // the queue along the front of the house, toward +x: the first at the table, the others behind; one by one they step up,
  // say their name and walk off toward the street
  const queue = story.cast.filter((c) => c.id !== clerkC?.id).slice(0, 5).map((c, i) => {
    const P = person(M, JOBS[c.job]?.color || ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d'][i]);
    group.add(P.root);
    labels.push({ ...castTag(c, lang), P });
    return { P, i };
  });
  const spot = (k) => new THREE.Vector3(TABLE.x + 0.15 + Math.max(0, k) * GAP, 0, TABLE.z + 0.95 + Math.max(0, k) * 0.12); // k-th in line
  const count = story.count || 0;
  const fmt = (n) => n.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US');
  let T0 = 0, T1 = 1;
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Il censimento' : 'The census',
    // the title counts up the villagers, the last second at the kingdom's number
    bannerAt(t, t0, t1) {
      const n = Math.round(count * ease(clamp01((t - t0) / Math.max(0.1, t1 - t0 - 1.0))));
      return lang === 'it' ? `Censimento: ${fmt(n)} abitanti` : `Census: ${fmt(n)} villagers`;
    },
    focus: toWorld(TABLE.x + 1.2, y0 + 1.2, TABLE.z + 1),
    setWindow(t0, t1) { T0 = t0; T1 = t1; },
    cam(u) {
      const k = ease(u);
      return { pos: toWorld(TABLE.x + 5.4 - 1.2 * k, y0 + 3.0, TABLE.z + 9.0 - 1.4 * k), look: toWorld(TABLE.x + 1.0, y0 + 1.0, TABLE.z + 0.6) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const s = (t - t0) / STEP; // how many have been counted
      const served = Math.floor(s), f = s - served;
      // the clerk writes: the quill hand scratching across the page, a glance up at each new villager
      C.r.g.rotation.set(-0.9 + 0.08 * Math.sin(t * 9), 0.15 * Math.sin(t * 3), -0.1);
      C.l.g.rotation.set(-0.75, 0, 0.15);
      C.body.rotation.x = f < 0.25 ? -0.05 : 0.25;
      for (const { P, i } of queue) {
        const k = i - served; // the place in line now (0 at the table, negative: done)
        let p, ry = -Math.PI / 2, walk = 0;
        if (k > 0) { // moving up one place at the start of each turn
          const m = ease(clamp01(f / 0.35));
          p = spot(k).lerp(spot(k - 1), k - 1 >= 0 ? m : 0);
          if (k === 1) p = spot(1).lerp(spot(0), m);
          walk = f < 0.35 ? 0.4 : 0;
        } else if (k === 0) {
          p = spot(0); ry = -Math.PI / 2 - 0.5; // at the table, turned to the clerk
        } else { // counted: off along the street past the table, away from the camera
          const away = (s - i - 1) * 1.6;
          p = spot(0).add(new THREE.Vector3(-away, 0, 0.8 + 0.15 * away));
          ry = -Math.PI / 2 + 0.15; walk = 0.45;
          if (away > 6) { P.root.visible = false; continue; }
        }
        P.root.visible = true;
        P.root.position.set(p.x, gy(p.x, p.z), p.z);
        P.root.rotation.y = ry;
        stride(P, (t - t0) * 7 + i, walk, { arms: true });
        if (k === 0) { P.r.g.rotation.set(-0.9 - 0.3 * Math.sin(t * 6), 0, -0.2); P.l.g.rotation.set(-0.2, 0, 0.1); } // telling their name
      }
      for (const l of labels) {
        if (!l.P.root.visible) { l.pos.set(0, -1e4, 0); continue; } // gone down the street: no tag
        l.pos.copy(l.P.root.position).setY(l.P.root.position.y + (l.dy ?? 2.3)).applyMatrix4(group.matrix);
      }
    },
  };
}
