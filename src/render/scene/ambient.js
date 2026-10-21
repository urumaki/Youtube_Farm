// Everyday shots that fill the video when there is time: guards on the castle walls (wallwatch.js), guards
// sparring in the courtyard (drills.js), or farmers hoeing in the fields. Same interface as the story scenes: { group, labels, banner, cam, update }.
import * as THREE from 'three';
import { heightAt } from '../../sim/world.js';
import { buildWorkScene } from './work.js';
import { castTag } from './stories/common.js';

/** Two farmers hoeing in the field closest to the castle. */
export function buildFields({ w, M, seed, hero, lang }) {
  const f = [...w.fields].sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z))[0];
  if (!f) return null;
  const y = (x, z) => heightAt(w, x, z) + 0.03;
  const anchor = new THREE.Vector3(f.x, 0, f.z);
  anchor.y = y(anchor.x, anchor.z);
  const face = -f.rot;
  const farmer = buildWorkScene({ job: hero?.job === 'peasant' ? 'peasant' : 'farmer', anchor, face, M, seed, id: 9001 });
  const side = new THREE.Vector3(Math.cos(f.rot), 0, Math.sin(f.rot));
  const a2 = anchor.clone().addScaledVector(side, 3.2);
  a2.y = y(a2.x, a2.z);
  const helper = buildWorkScene({ job: 'peasant', anchor: a2, face: face + 0.4, M, seed, id: 9002 });
  const group = new THREE.Group();
  group.add(farmer.group, helper.group);
  group.visible = false;
  const labels = hero ? [{ pos: farmer.labelPos.clone(), title: hero.name, sub: castTag(hero, lang).sub }] : [];
  const focus = farmer.focus.clone().lerp(helper.focus, 0.35);
  return {
    group,
    labels,
    work: farmer,
    banner: lang === 'it' ? 'Al lavoro nei campi' : 'Work in the fields',
    focus,
    cam(u) {
      const ang = face + 0.9 - 0.7 * u;
      return { pos: focus.clone().add(new THREE.Vector3(Math.sin(ang) * 7.5, 1.6, Math.cos(ang) * 7.5)), look: focus.clone().add(new THREE.Vector3(0, -0.1, 0)) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      farmer.update(t);
      helper.update(t);
    },
  };
}
