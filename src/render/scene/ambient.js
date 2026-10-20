// Everyday shots that fill the video when there is time: a guard patrolling the castle wall walk, or
// farmers hoeing in the fields. Same interface as the story scenes: { group, labels, banner, cam, update }.
import * as THREE from 'three';
import { JOBS } from '../../sim/tiers.js';
import { heightAt } from '../../sim/world.js';
import { ROYAL } from './textures.js';
import { toolGeo, buildWorkScene } from './work.js';
import { person, stride, castTag } from './stories/common.js';

const SPEED = 1.1;

/** A guard walking along the north wall walk, the camera ahead of them looking back. */
export function buildPatrol({ castle, M, hero, lang }) {
  const walk = castle.guardWalks[0];
  const a = new THREE.Vector3(...walk.a), b = new THREE.Vector3(...walk.b);
  const dir = b.clone().sub(a).normalize();
  const len = a.distanceTo(b);
  const group = new THREE.Group();
  group.visible = false;
  const P = person(M, hero ? JOBS[hero.job]?.color || ROYAL.blue : ROYAL.blue);
  P.r.hand.add(toolGeo('spear', M));
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.18, 0), M.iron);
  helm.castShadow = true;
  P.body.add(helm);
  group.add(P.root);
  const labels = hero ? [castTag(hero, lang, lang === 'it' ? 'Di ronda' : 'On patrol')] : [];
  const at = (u) => a.clone().addScaledVector(dir, len * (0.25 + 0.3 * u));
  // the courtyard side of the north wall is +z
  const inside = new THREE.Vector3(0, 0, 1);
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Ronda sulle mura' : 'Watch on the walls',
    focus: at(0.5).setY(a.y + 1.2),
    cam(u) {
      const g = at(u);
      return { pos: g.clone().addScaledVector(dir, 5.2).addScaledVector(inside, 2.2).setY(a.y + 2.4), look: g.clone().addScaledVector(inside, -0.6).setY(a.y + 1.1) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 && t <= t1;
      if (!group.visible) return;
      const u = (t - t0) / (t1 - t0);
      const g = at(u);
      P.root.position.copy(g);
      P.root.rotation.y = Math.atan2(dir.x, dir.z);
      stride(P, (t - t0) * SPEED * 3.4, 0.45, { arms: false });
      P.r.g.rotation.set(-0.35, 0, 0); // spear upright at the shoulder
      P.l.g.rotation.x = 0.3 * Math.sin((t - t0) * SPEED * 3.4);
      if (labels[0]) labels[0].pos.copy(g).setY(a.y + 2.4);
    },
  };
}

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
