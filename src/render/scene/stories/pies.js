// The pie eating contest (owner 2026-10-27): in the tavern three named villagers sit side by side at the far table, a stack
// of pies in front of each; they eat as fast as they can while the drinkers watch, and the first to clear the stack throws
// up their arms (story.winner), the other two slumped over the last pie. Inside the tavern (tavern.js), its own lamps.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { cylGeo } from '../kit.js';
import { rig } from '../work.js';
import { buildTavernInterior, TABLES } from '../tavern.js';
import { castTag, ease, clamp01 } from './common.js';

const F = 0.3; // the tavern's floor above its lot (tavern.js)
const T = 2; // the contest table (TABLES[2]), its far bench facing the door corner
const PIES = 6;
const DONE = 0.82; // when the winner's last pie is gone

export function buildPies({ story, M, buildings, seed, lang }) {
  const item = buildings.items.tavern;
  if (!item) return null;
  const tav = buildTavernInterior({ item, M, seed, freeTable: T });
  const room = tav.group, group = new THREE.Group();
  const toWorld = (v) => v.clone().applyMatrix4(item.group.matrix);
  const [tx, tz] = TABLES[T];
  const crust = new THREE.MeshStandardMaterial({ color: '#c98a3e', roughness: 0.8 });
  const filling = new THREE.MeshStandardMaterial({ color: '#7a2b33', roughness: 0.6 });
  const pie = () => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(cylGeo(0.15, 0.13, 0.06, 14), crust), b = new THREE.Mesh(cylGeo(0.12, 0.12, 0.062, 14), filling);
    g.add(a, b);
    return g;
  };
  const labels = [];
  const eaters = story.cast.slice(0, 3).map((c, i) => {
    const x = tx - 0.55 + i * 0.55, z = tz + 0.78;
    const P = rig(M, JOBS[c.job]?.color || '#7a6a55', { seated: true });
    P.root.position.set(x, F, z);
    P.root.rotation.y = Math.PI; // facing the room and the door corner
    room.add(P.root);
    // the stack in front of them, and the bite in hand
    const stack = Array.from({ length: PIES }, (_, k) => { const p = pie(); p.position.set(x, F + 0.86 + k * 0.065, tz + 0.2); room.add(p); return p; });
    const bite = pie();
    bite.scale.set(0.5, 1, 0.5);
    bite.position.set(0, -0.05, 0.1);
    P.r.hand.add(bite);
    const tag = { ...castTag(c, lang), P };
    labels.push(tag);
    // how fast they eat: the winner clears the stack at DONE, the others get through four or five
    const win = c.id === story.winner;
    const rate = win ? PIES / DONE : (PIES - 1 - (rand01(seed, 'pies', i) < 0.5 ? 1 : 0)) / DONE;
    return { P, stack, bite, tag, win, rate, ph: rand01(seed, 'pies-ph', i) * 3, sub: tag.sub };
  });
  let T0 = 0, T1 = 1;
  const tmp = new THREE.Vector3();
  const from = new THREE.Vector3(tx + 0.3, 2.2, tz - 3.3), to = new THREE.Vector3(tx + 0.1, 2.0, tz - 2.6);
  return {
    group,
    labels,
    interior: true,
    banner: lang === 'it' ? 'Gara di torte!' : 'Pie eating contest!',
    focus: toWorld(new THREE.Vector3(tx, 1.1, tz + 0.5)),
    setWindow(t0, t1) { T0 = t0; T1 = t1; },
    cam(u) {
      return { pos: toWorld(from.clone().lerp(to, ease(u))), look: toWorld(new THREE.Vector3(tx, F + 1.05, tz + 0.6)), fov: 62 };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      tav.update(t, on);
      if (!on) return;
      const u = clamp01((t - t0) / (t1 - t0)), over = u >= DONE;
      for (const e of eaters) {
        const eaten = Math.min(PIES, Math.floor(e.rate * Math.min(u, DONE)));
        e.stack.forEach((p, k) => { p.visible = k < PIES - eaten; });
        const { P } = e;
        if (!over) {
          // a bite: the hand up to the mouth and down to the stack, fast; leaning in over the table
          const c = Math.sin((t - t0) * 9 + e.ph);
          P.r.g.rotation.set(-1.3 - 0.9 * Math.max(0, c), 0, -0.25);
          P.l.g.rotation.set(-1.1, 0, 0.25);
          P.body.rotation.set(0.28 + 0.06 * c, 0, 0);
          e.bite.visible = true;
        } else if (e.win) {
          // done: both arms up, the crowd's champion
          P.r.g.rotation.set(-2.9 + 0.2 * Math.sin(t * 9), 0, -0.4); P.l.g.rotation.set(-2.9 + 0.2 * Math.cos(t * 9), 0, 0.4);
          P.body.rotation.set(-0.15, 0, 0);
          e.bite.visible = false;
          e.tag.sub = lang === 'it' ? 'Vince!' : 'Winner!';
        } else {
          // too full: slumped forward over the last pie
          P.r.g.rotation.set(-0.9, 0, -0.2); P.l.g.rotation.set(-0.9, 0, 0.2);
          P.body.rotation.set(0.55, 0, 0.08 * Math.sin(t * 2));
          e.bite.visible = false;
        }
        if (!over) e.tag.sub = e.sub;
      }
      labels.forEach((l, i) => l.pos.copy(toWorld(tmp.copy(l.P.root.position).setY(F + 1.85 + (i % 2) * 0.4)))); // staggered: three names side by side
    },
  };
}
