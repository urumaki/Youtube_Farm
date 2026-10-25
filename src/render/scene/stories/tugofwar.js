// Tug of war (owner 2026-10-25): named guards against named farmers over a mud puddle in the market square. Both sides
// lean back and heave, the rope sways one way and the other; late in the shot the losing side is dragged in and its
// front two sit down in the mud (nobody hurt), the winners throw their arms up. The side that wins is the simulation's.
import * as THREE from 'three';
import { JOBS } from '../../../sim/tiers.js';
import { cylGeo, boxGeo } from '../kit.js';
import { person, stride, stage, castTag, ease, clamp01 } from './common.js';

const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d'];
const WIN = 0.66; // the share of the shot when one side gives way

export function buildTugOfWar({ story, M, buildings, seed, lang }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const C = st.square ? new THREE.Vector3(3, 0, 2) : new THREE.Vector3(0, 0, 4.5);
  const mud = new THREE.Mesh(new THREE.CircleGeometry(1.25, 28).rotateX(-Math.PI / 2).scale(1, 1, 0.7), new THREE.MeshStandardMaterial({ color: '#5a3a1e', roughness: 0.6 }));
  mud.position.set(C.x, 0.09, C.z); // above the square's paving
  mud.receiveShadow = true;
  group.add(mud);
  const rope = new THREE.Mesh(cylGeo(0.035, 0.035, 9, 8).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b89a64', roughness: 0.9 }));
  rope.castShadow = true;
  group.add(rope);
  const rag = new THREE.Mesh(boxGeo(0.08, 0.3, 0.12), M.clothRed);
  group.add(rag);
  // guards on -x pulling toward -x, farmers on +x; front one 1.6 m from the middle, then 0.8 m apart
  const side = (cast, s, color) => cast.slice(0, 4).map((c, k) => {
    const P = person(M, JOBS[c?.job]?.color || color);
    group.add(P.root);
    return { P, c, s, d: 1.6 + 0.8 * k, k };
  });
  const guardsWin = story.winner === 'guards';
  const team = [...side(story.guards || [], -1, JOBS.guard.color), ...side(story.farmers || [], 1, JOBS.farmer.color)];
  const labels = team.filter((m) => m.c).map((m) => ({ ...castTag(m.c, lang), P: m.P }));
  const crowd = CROWD.map((col, i) => {
    const P = person(M, col);
    P.root.position.set(C.x - 3.6 + i * 1.45, 0, C.z + 2.6 + (i % 2) * 0.6);
    P.root.rotation.y = Math.PI;
    group.add(P.root);
    return P;
  });
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Tiro alla fune: guardie contro contadini!' : 'Tug of war: guards against farmers!',
    focus: st.toWorld(C.x, 1.0, C.z),
    cam(u) {
      // three-quarters on, so the line of pullers runs across the narrow frame on a slant
      const a = -Math.PI / 2 - 0.62 + 0.18 * u, r = 6.2 - 0.5 * ease(u);
      return { pos: st.toWorld(C.x + Math.cos(a) * r, 3.3, C.z + Math.sin(a) * r), look: st.toWorld(C.x, 0.9, C.z + 0.6) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0)), over = ease(clamp01((u - WIN) / 0.14));
      // the rope's shift along x: a sway, then the losers dragged 1.4 m toward the winners
      const win = guardsWin ? -1 : 1;
      const shift = 0.25 * Math.sin((t - t0) * 2.3) * (1 - over) + win * 1.4 * over;
      rope.position.set(C.x + shift, 1.02, C.z);
      rag.position.set(C.x + shift, 0.9, C.z);
      for (const { P, s, d, k } of team) {
        const losing = s !== win, fallen = losing && k < 2 && over > 0.5;
        const x = C.x + shift + s * d;
        P.root.position.set(x, 0, C.z + (k % 2 ? 0.18 : -0.18));
        P.root.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2; // facing the middle
        P.r.g.rotation.set(-1.45, 0, -0.15); P.l.g.rotation.set(-1.45, 0, 0.15);
        if (fallen) {
          // sat down in the mud, legs out, arms flung up
          P.root.position.y = -0.38;
          P.body.rotation.x = -0.35;
          P.legs[0].rotation.x = P.legs[1].rotation.x = -1.3;
          P.r.g.rotation.set(-2.6, 0, -0.4); P.l.g.rotation.set(-2.6, 0, 0.4);
        } else if (!losing && over > 0.5) {
          P.body.rotation.x = 0;
          P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
          P.r.g.rotation.set(-2.8 + 0.2 * Math.sin(t * 9 + k), 0, -0.2); P.l.g.rotation.set(-2.7, 0, 0.2);
          P.root.position.y = 0.1 * Math.abs(Math.sin(t * 9 + k));
        } else {
          // leaning back on the rope, digging the heels in; the losers stumble forward as they go
          P.body.rotation.x = losing && over > 0 ? 0.25 : -0.42 + 0.06 * Math.sin(t * 4.6 + k);
          stride(P, (t - t0) * (losing && over > 0 ? 10 : 2.3) + k, losing && over > 0 ? 0.5 : 0.18, { arms: false });
        }
      }
      crowd.forEach((P, i) => {
        const ph = t * 8 + i;
        P.r.g.rotation.set(-1.8 - 0.8 * Math.abs(Math.sin(ph)), 0, -0.2);
        P.l.g.rotation.set(over > 0.5 && i % 2 ? -2.6 : -0.3, 0, 0.2);
      });
      for (const l of labels) l.pos.copy(l.P.root.position).setY(Math.max(0, l.P.root.position.y) + 2.3).applyMatrix4(group.matrix);
    },
  };
}
