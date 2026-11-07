// A new Noble's manor (owner 2026-11-07, story 'noble', step 'manor'; the throne room comes first, throne.js): the camera
// starts on the sign by the garden gate, "NOBLE" and the name under it (buildings.js `manor`), and pulls back to show the
// manor, the new Noble waving at the gate and the neighbours cheering in the street. Lot frame: the street in front (+z),
// the gate at z 4.3, the sign at (2.6, 1.5, 4.65) facing the street.
import * as THREE from 'three';
import { JOBS } from '../../../sim/tiers.js';
import { nobles } from '../../../sim/stories.js';
import { person, stride, castTag, ease, clamp01 } from './common.js';

const FOLK = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d'];
const SIGN = new THREE.Vector3(2.6, 1.5, 4.65);

export function buildManor({ story, state, M, buildings }) {
  const lot = nobles(state).find((n) => n.id === story.hero?.id)?.lot;
  const it = lot && buildings.items[lot];
  if (!it) return null;
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(it.group.matrix);
  group.matrixWorld.copy(group.matrix);
  group.visible = false;
  const at = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrix);
  // the Noble at the gate, the neighbours in the street (the named ones of the throne room first)
  const N = person(M, JOBS[story.hero.job]?.color || '#7b3f8c');
  group.add(N.root);
  const folk = [...(story.crowd || []).slice(0, 4), null, null].map((c, i) => {
    const P = person(M, c ? JOBS[c.job]?.color || FOLK[i] : FOLK[i]);
    group.add(P.root);
    // to either side of the gate, never between the camera and the sign
    const [x, z] = [[-1.8, 6.4], [5.2, 6.6], [-3.0, 7.1], [6.1, 7.6], [-2.2, 8.1], [-4.0, 6.2]][i];
    P.root.position.set(x, 0, z);
    P.root.rotation.y = Math.atan2(-x * 0.3, -1);
    return { P, i };
  });
  const tag = { ...castTag(story.hero, 'Noble'), hidden: true };
  const labels = [tag];
  return {
    group, labels, banner: "The Noble's manor", low: true,
    focus: at(0, 2.5, 0),
    cam(u) {
      // on the sign, then back and up to the whole manor with the Noble at the gate
      const k = ease(clamp01((u - 0.3) / 0.6));
      const pos = new THREE.Vector3(2.6, 1.55, 8.4).lerp(new THREE.Vector3(6.0, 4.6, 20.5), k);
      const look = SIGN.clone().lerp(new THREE.Vector3(0.6, 3.6, -1), k);
      return { pos: at(pos.x, pos.y, pos.z), look: at(look.x, look.y, look.z) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t < t1;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0);
      // the Noble steps out of the gate and waves to the street
      const out = ease(clamp01((u - 0.2) / 0.3));
      N.root.position.set(0, 0, 3.6 + 1.6 * out);
      N.root.rotation.y = 0;
      N.legs[0].rotation.x = N.legs[1].rotation.x = 0;
      if (out > 0 && out < 1) stride(N, u * 30, 0.4);
      N.r.g.rotation.set(out >= 1 ? -2.7 : -0.2, 0, out >= 1 ? -0.4 + 0.35 * Math.sin(t * 9) : 0);
      N.l.g.rotation.set(-0.2, 0, 0);
      for (const { P, i } of folk) {
        const ph = t * 8 + i * 1.3;
        P.r.g.rotation.set(-2.6 + 0.3 * Math.sin(ph), 0, -0.2);
        P.l.g.rotation.set(i % 2 ? -2.5 : -0.3, 0, 0.2);
        P.root.position.y = 0.06 * Math.abs(Math.sin(ph));
      }
      tag.hidden = u < 0.55; // the sign alone first
      tag.pos.copy(N.root.position).setY(2.35).applyMatrix4(group.matrix);
    },
  };
}
