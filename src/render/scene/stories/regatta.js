// The regatta (owner 2026-10-27): three rowing boats race down the river past the dock, a named rower in each; the finish is
// the end of the pier, where a pennant flies and named villagers cheer. The winner (story.winner) crosses first and raises
// an arm. Seen from over the water beside the pier, looking up the river at the boats coming.
import * as THREE from 'three';
import { heightAt, WATER_LEVEL } from '../../../sim/world.js';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { rig } from '../work.js';
import { rowboat } from '../away.js';
import { person, castTag, ease, clamp01 } from './common.js';

const FINISH = 0.8; // the share of the shot when the winner crosses the line
const START = 42; // metres up the river

/** The dock's pier as a frame: the end of its deck, `out` over the river and `along` it toward open water. */
export function pierFrame(d, w) {
  const { origin: [ox, oz], dir: [dx, dz], reach } = d.pier;
  const o = d.toWorld([ox, 0.75, oz]);
  const out = d.toWorld([ox + dx, 0.75, oz + dz]).sub(o).normalize();
  let along = d.toWorld([ox + dz, 0.75, oz - dx]).sub(o).normalize();
  const end = o.clone().addScaledVector(out, reach - 0.6);
  const wet = (s) => [12, 24, 36].every((k) => { const p = end.clone().addScaledVector(out, 4).addScaledVector(along, s * k); return heightAt(w, p.x, p.z) < WATER_LEVEL - 0.3; });
  if (!wet(1) && wet(-1)) along = along.negate();
  const at = (a, b, y = o.y) => end.clone().addScaledVector(out, a).addScaledVector(along, b).setY(y);
  return { at, deckY: o.y, out, along };
}

export function buildRegatta({ story, w, M, buildings, seed, lang }) {
  const d = buildings.items.dock;
  if (!d?.pier) return null;
  const { at, deckY } = pierFrame(d, w);
  const group = new THREE.Group();
  group.visible = false;
  // the finish pennant on a pole at the end of the pier
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.2, 6), M.woodDark);
  pole.position.copy(at(-0.1, 0, deckY + 1.6));
  group.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6).translate(0.5, 0, 0), new THREE.MeshStandardMaterial({ color: '#b3202c', side: THREE.DoubleSide }));
  flag.position.copy(at(-0.1, 0, deckY + 2.85));
  group.add(flag);
  const labels = [];
  // the boats, one lane each out from the pier; the winner's pace brings it to the line at FINISH, the others a little behind
  const boats = (story.rowers || []).slice(0, 3).map((c, i) => {
    const boat = new THREE.Group();
    boat.add(rowboat(M));
    // each boat's colours: a band along both sides and a pennant at the stern
    const colour = new THREE.MeshStandardMaterial({ color: ['#b3202c', '#2a4f9a', '#d4a52a'][i], roughness: 0.7 });
    for (const sx of [-1, 1]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 2.2), colour); band.position.set(sx * 0.62, 0.42, -0.1); band.rotation.z = sx * 0.25; boat.add(band); }
    const pen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3).translate(0.25, 0, 0), new THREE.MeshStandardMaterial({ color: colour.color, side: THREE.DoubleSide }));
    pen.position.set(0, 1.25, -1.35);
    boat.add(pen);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.0, 5), M.woodDark);
    staff.position.set(0, 0.9, -1.38);
    boat.add(staff);
    group.add(boat);
    const R = rig(M, JOBS[c.job]?.color || '#7a6a55', { seated: true });
    R.root.position.set(0, -0.04, -0.3);
    R.root.rotation.y = Math.PI; // rowers face the stern
    boat.add(R.root);
    const tag = { ...castTag(c, lang), P: R, dy: 1.7 };
    labels.push(tag);
    const win = c.id === story.winner;
    const pace = win ? 1 : 0.9 - 0.06 * rand01(seed, 'regatta', i);
    return { boat, R, tag, win, pace, lane: 3.2 + i * 2.6, sub: tag.sub, ph: rand01(seed, 'regatta-ph', i) * 2 };
  });
  // the crowd at the end of the pier, facing up the river
  const crowd = (story.crowd || []).slice(0, 4).map((c, i) => {
    const P = person(M, JOBS[c.job]?.color || ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a'][i]);
    P.root.position.copy(at(-0.9 - (i % 2) * 1.1, -1.2 + Math.floor(i / 2) * 1.3));
    P.root.lookAt(at(4, 12, P.root.position.y));
    group.add(P.root);
    labels.push({ ...castTag(c, lang), P });
    return P;
  });
  const along = (b, u) => START * (1 - (u / FINISH) * b.pace); // a steady pace, on past the line
  return {
    group,
    labels,
    banner: lang === 'it' ? 'La regata!' : 'The regatta!',
    focus: at(4, 4, deckY + 0.6),
    cam(u) {
      // over the water beside the pier, behind the crowd: the boats come down the river toward the line
      const k = ease(clamp01(u / FINISH));
      return { pos: at(-0.5, -15 + 2 * k, deckY + 4.2), look: at(2.8, 20 - 18 * k, WATER_LEVEL + 0.8) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0)), over = u >= FINISH;
      flag.rotation.y = 0.3 * Math.sin(t * 6);
      for (const b of boats) {
        const s = along(b, u);
        const p = at(b.lane, s, WATER_LEVEL + 0.03 * Math.sin(t * 2 + b.ph)), q = at(b.lane, s - 1, WATER_LEVEL);
        b.boat.position.copy(p);
        b.boat.rotation.set(0, Math.atan2(q.x - p.x, q.z - p.z), 0.03 * Math.sin(t * 3 + b.ph));
        const crossed = b.win && over;
        if (!crossed) {
          const r = Math.sin((t - t0) * 6.5 + b.ph); // hard strokes
          b.R.r.g.rotation.set(-1.2 + 0.55 * r, 0, -0.3); b.R.l.g.rotation.set(-1.2 + 0.55 * r, 0, 0.3); b.R.body.rotation.x = -0.2 * r;
        } else {
          b.R.r.g.rotation.set(-2.8 + 0.2 * Math.sin(t * 8), 0, -0.4); b.R.l.g.rotation.set(-0.5, 0, 0.2); b.R.body.rotation.x = 0;
        }
        b.tag.sub = crossed ? (lang === 'it' ? 'Vince!' : 'Winner!') : b.sub;
      }
      crowd.forEach((P, i) => {
        const ph = t * 7 + i;
        P.r.g.rotation.set(-2.6 - 0.3 * Math.sin(ph), 0, -0.3);
        P.l.g.rotation.set(over || i % 2 ? -2.5 - 0.3 * Math.cos(ph) : -0.3, 0, 0.2);
      });
      group.updateMatrixWorld(true);
      for (const l of labels) l.pos.copy(l.P.root.getWorldPosition(l.pos)).setY(l.pos.y + (l.dy ?? 2.3));
    },
  };
}
