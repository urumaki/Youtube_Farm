// An archery contest in the market square: three archers (named villagers, archers and guards first)
// shoot side by side at straw targets while the crowd watches; at the end the winner raises the bow and
// gets a golden rosette pinned on. Over two quiet days: the heats (step 'heats', no winner yet), then the
// final with the same three archers.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { buildWorkScene } from '../work.js';
import { person, stage, castTag, ease, clamp01 } from './common.js';

const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d', '#56606e'];
const WIN = 0.7; // the share of the shot before the winner is cheered (the final only)
const AIM = Math.atan2(-Math.cos(1.3), Math.sin(1.3)); // the archer scene shoots along this heading (work.js, 'butts')
const TO_CAMERA = 2.3; // yaw (in the archer's frame) that faces the camera behind the line

export function buildArchery({ story, M, buildings, seed, lang }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  // shooting toward +x of the square, the archers in a row across it
  const X0 = st.square ? -3 : -1.5, Z0 = st.square ? -2.5 : 2.5, GAP = 2.3;
  const face = Math.PI / 2 - AIM;
  const archers = [0, 1, 2].map((k) => {
    const c = story.cast[k] || null;
    const anchor = st.toWorld(X0, 0, Z0 + k * GAP);
    const ws = buildWorkScene({ job: 'fletcher', variant: 'shoot', anchor, face, M, seed, id: 9300 + k, color: c ? JOBS[c.job]?.color : null });
    return { ws, c };
  });
  const scene = new THREE.Group(); // in world coordinates (the work scenes are placed in the world)
  scene.visible = false;
  for (const a of archers) scene.add(a.ws.group);
  // spectators beside the last lane, watching the archers
  const crowd = CROWD.map((col, i) => {
    const P = person(M, col);
    P.root.position.set(X0 - 1.5 + (i % 4) * 1.0 + rand01(seed, 'arch', i) * 0.3, 0, Z0 + 3 * GAP + 0.6 + Math.floor(i / 4) * 0.9);
    P.root.rotation.y = Math.PI + 0.3; // facing the line
    group.add(P.root);
    return P;
  });
  // the winner's rosette, pinned on at the end
  const rosette = new THREE.Group();
  rosette.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 14).rotateX(Math.PI / 2), M.gold));
  rosette.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.01).translate(-0.04, -0.14, 0).rotateZ(0.2), M.clothRed));
  rosette.add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.01).translate(0.04, -0.14, 0).rotateZ(-0.2), M.clothRed));
  rosette.position.set(0.12, 0.72, 0.2);
  rosette.visible = false;
  archers[0].ws.rig.body.add(rosette);
  const heats = story.step === 'heats';
  const winSub = lang === 'it' ? 'Vincitore!' : 'Winner!';
  const labels = archers.map(({ c }, k) => (c ? { ...castTag(c, lang), k } : null)).filter(Boolean);
  for (const l of labels) l.sub0 = l.sub;
  const focusW = st.toWorld(X0 + 1.4, 1.1, Z0 + GAP);
  return {
    group: (() => { const g = new THREE.Group(); g.add(group, scene); return g; })(),
    labels,
    banner: heats ? (lang === 'it' ? 'Gara con l’arco: le qualificazioni' : 'Archery contest: the heats')
      : story.step === 'final' ? (lang === 'it' ? 'Gara con l’arco: la finale!' : 'Archery contest: the final!')
        : lang === 'it' ? 'Gara di tiro con l’arco!' : 'Archery contest!',
    focus: focusW,
    work: { strikeTimes: (a, b) => archers[0].ws.strikeTimes(a, b), sound: 'straw' },
    cam(u) {
      // behind and beside the line of archers, the targets in view, slowly moving along
      return { pos: st.toWorld(X0 - 5.2 + 1.0 * u, 2.6, Z0 - 4.6 + 0.6 * u), look: st.toWorld(X0 + 1.0, 1.1, Z0 + GAP * 1.1) };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      group.visible = scene.visible = on;
      if (!on) return;
      const won = !heats && clamp01((t - t0) / (t1 - t0) - WIN) > 0;
      archers.forEach(({ ws }, k) => {
        ws.update(t + k * 0.7); // not in step
        if (k === 0 && won) {
          // the winner turns to the crowd and raises the bow
          const P = ws.rig, lift = ease(clamp01(((t - t0) / (t1 - t0) - WIN) / 0.08));
          P.body.rotation.set(0, 1.3 * (1 - lift), 0);
          P.root.rotation.y = TO_CAMERA * lift; // turns round to the crowd and the camera
          P.l.g.rotation.set(-2.8 * lift, 0, -1.52 * (1 - lift));
          P.r.g.rotation.set(-2.4 * lift, 0, -1.5 * (1 - lift));
          P.root.position.y = 0.1 * lift * Math.abs(Math.sin(t * 8));
        }
      });
      rosette.visible = won;
      crowd.forEach((P, i) => {
        const ph = t * 8 + i;
        P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
        P.r.g.rotation.set(won ? -2.7 + 0.3 * Math.sin(ph) : -0.25, 0, -0.1);
        P.l.g.rotation.set(won && i % 2 ? -2.5 : -0.2, 0, 0.1);
        P.root.position.y = won ? 0.07 * Math.abs(Math.sin(ph)) : 0;
      });
      for (const l of labels) {
        const a = archers[l.k];
        l.pos.copy(a.ws.labelPos);
        l.sub = l.k === 0 && won ? winSub : l.sub0;
      }
    },
  };
}
