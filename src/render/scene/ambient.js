// Everyday shots that fill the video when there is time: guards on the castle walls (wallwatch.js), guards
// sparring in the courtyard (drills.js), farmers hoeing in the fields, or many farmers in a wheat field. Same interface as the story scenes: { group, labels, banner, cam, update }.
import * as THREE from 'three';
import { heightAt } from '../../sim/world.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rand01 } from '../../sim/prng.js';
import { buildWorkScene, rig } from './work.js';
import { cylGeo, boxGeo } from './kit.js';
import { castTag } from './stories/common.js';

/**
 * Many farmers at work in a wheat field together (owner 2026-10-22). Summer and autumn: the harvest, three
 * reapers with scythes in a staggered line at the edge of the ripe wheat, two binding sheaves on the
 * stubble behind them, one loading the sheaves onto a cart, stooks standing to dry. Spring: young green
 * wheat, farmers hoeing between the rows and sowing the last strip. Not in winter.
 */
export function buildWheat({ w, M, seed, hero, month }) {
  // a big field near the castle
  const f = [...w.fields].sort((p, q) => Math.hypot(p.x, p.z) - p.hw * p.hd * 0.4 - (Math.hypot(q.x, q.z) - q.hw * q.hd * 0.4))[0];
  if (!f) return null;
  const harvest = month >= 7 && month <= 11;
  const c = Math.cos(f.rot), s = Math.sin(f.rot);
  // field coordinates (lx along its length, lz across) to the world; the ground under each thing
  const at = (lx, lz, dy = 0) => { const x = f.x + c * lx - s * lz, z = f.z + s * lx + c * lz; return new THREE.Vector3(x, heightAt(w, x, z) + 0.03 + dy, z); };
  const face = (a) => -f.rot + a; // a = 0 faces the field's +lz
  const group = new THREE.Group();
  group.visible = false;
  const add = (geo, m, pos, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.copy(pos); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; group.add(o); return o; };
  const edge = -0.5; // the standing wheat on lz < edge, the worked strip on lz > edge
  // the wheat: one instanced stalk with its ear, ripe and tall at harvest, green and short in spring
  const tall = harvest ? 0.95 : 0.35;
  const stalk = mergeGeometries([cylGeo(0.012, 0.016, 1, 3).translate(0, 0.5, 0), new THREE.SphereGeometry(0.03, 4, 3).scale(harvest ? 1 : 0.5, harvest ? 2.6 : 1, harvest ? 1 : 0.5).translate(0, 1.02, 0)]);
  const wheatMat = harvest ? M.hay : new THREE.MeshStandardMaterial({ color: '#6f9a3c', roughness: 0.9 });
  const spots = [];
  for (let lx = -f.hw + 0.3; lx < f.hw - 0.3; lx += 0.2) for (let lz = -f.hd + 0.3; lz < f.hd - 0.3; lz += 0.24) {
    if (harvest && lz > edge + 0.12 * Math.sin(lx * 1.3)) continue;
    spots.push([lx + 0.08 * Math.sin(lz * 9 + lx * 3), lz + 0.06 * Math.cos(lx * 7)]);
  }
  const wheat = new THREE.InstancedMesh(stalk, wheatMat, spots.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  spots.forEach(([lx, lz], i) => {
    const h = tall * (0.85 + 0.25 * rand01(seed, 'wheat', i));
    m4.compose(at(lx, lz, -0.03), q.setFromEuler(e.set(0.08 * Math.sin(i), 0, 0.08 * Math.cos(i * 1.7))), v.set(1, h, 1));
    wheat.setMatrixAt(i, m4);
  });
  wheat.castShadow = true; wheat.receiveShadow = true;
  group.add(wheat);
  const crew = [];
  const people = [];
  // a sheaf: straw bound at the waist, the ears flaring at the top and the cut ends at the bottom
  const straw = new THREE.MeshStandardMaterial({ color: '#d8b65c', roughness: 0.95 });
  const sheafGeo = new THREE.LatheGeometry([[0.001, 0], [0.11, 0], [0.1, 0.25], [0.085, 0.45], [0.11, 0.6], [0.18, 0.82], [0.13, 0.95], [0.001, 0.99]].map(([r, y]) => new THREE.Vector2(r, y)), 9);
  const band = new THREE.MeshStandardMaterial({ color: '#8a6a32', roughness: 0.9 });
  const person = (job, variant, lx, lz, a, id) => {
    const ws = buildWorkScene({ job, variant, anchor: at(lx, lz), face: face(a), M, seed, id, bare: true });
    group.add(ws.group);
    crew.push(ws);
    return ws;
  };
  if (harvest) {
    // the reapers face the wheat, each a little behind the one before
    [[-5.5, 0.4], [-2.2, 1.2], [1.1, 2.0]].forEach(([lx, lz], i) => person(hero?.job === 'peasant' && i === 0 ? 'peasant' : 'farmer', 'scythe', lx, edge + lz, Math.PI + 0.25, 9001 + i));
    // the cut wheat lying in swaths behind them
    // cut sheaves lying behind the reapers, waiting to be bound
    for (const [lx, lz] of [[-7, 1.9], [-5.6, 2.1], [-3.4, 2.7], [-2, 2.9], [0.2, 3.5], [1.6, 3.7]]) {
      const lying = add(sheafGeo, straw, at(lx, edge + lz, 0.13), face(Math.PI / 2 + 0.3 * Math.sin(lx)));
      lying.rotateX(Math.PI / 2);
    }
    // stooks: sheaves leaning together to dry
    for (const [lx, lz] of [[-7.5, 5.2], [-4.5, 5.6], [-1.5, 5.0], [3.5, 5.4], [6.4, 4.8]]) {
      if (Math.abs(lz) > f.hd - 0.6) continue;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const sh = add(sheafGeo, straw, at(lx + Math.cos(a) * 0.24, Math.min(lz, f.hd - 0.8) + Math.sin(a) * 0.24, -0.04), 0);
        sh.rotation.set(-Math.sin(a) * 0.28, 0, Math.cos(a) * 0.28); // leaning in on each other
        sh.add(new THREE.Mesh(cylGeo(0.085, 0.085, 0.05, 9).translate(0, 0.45, 0), band));
      }
    }
    // two binders bending over the swaths, a sheaf in their arms
    for (const [lx, lz, a, ph] of [[-4.2, 2.6, 0.6, 0], [-0.6, 3.4, -0.4, 1.7]]) {
      const P = rig(M, ['#8b6b3e', '#6f7d4a'][people.length]);
      P.root.position.copy(at(lx, edge + lz)); P.root.rotation.y = face(a);
      const sheaf = new THREE.Mesh(sheafGeo, straw); sheaf.scale.setScalar(0.8); sheaf.rotation.x = 0.5; sheaf.position.set(-0.08, -0.32, -0.17); P.r.hand.add(sheaf); // gripped at the band
      group.add(P.root);
      people.push({ P, ph, kind: 'bind' });
    }
    // a hay cart on the stubble, half full, and a farmer heaving sheaves up onto it
    const cartAt = at(5.6, Math.min(edge + 3.4, f.hd - 1.5));
    const cart = new THREE.Group();
    cart.position.copy(cartAt); cart.rotation.y = face(Math.PI / 2);
    const cadd = (geo, m, x, y, z, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.z = rz; o.castShadow = true; cart.add(o); return o; };
    cadd(boxGeo(1.4, 0.12, 2.4), M.wood, 0, 0.75, 0);
    for (const sd of [-1, 1]) {
      cadd(boxGeo(0.08, 0.5, 2.4), M.woodDark, sd * 0.7, 1.0, 0);
      cadd(cylGeo(0.5, 0.5, 0.1, 12).rotateZ(Math.PI / 2), M.woodDark, sd * 0.78, 0.5, -0.2);
      cadd(boxGeo(0.07, 0.07, 1.8), M.woodDark, sd * 0.35, 0.62, 1.9, 0);
    }
    for (let k = 0; k < 9; k++) cadd(sheafGeo.clone().translate(0, -0.49, 0).rotateX(Math.PI / 2), straw, -0.45 + (k % 3) * 0.45, 1.0 + Math.floor(k / 3) * 0.24, -0.6 + (k % 2) * 0.5);
    group.add(cart);
    const L = rig(M, '#7a5a3a');
    L.root.position.copy(at(4.0, Math.min(edge + 3.4, f.hd - 1.5))); L.root.rotation.y = face(Math.PI / 2);
    const lifted = new THREE.Mesh(sheafGeo, straw); lifted.scale.setScalar(0.8); lifted.position.set(-0.08, -0.36, 0); L.r.hand.add(lifted);
    group.add(L.root);
    people.push({ P: L, ph: 0.6, kind: 'load', sheaf: lifted });
  } else {
    // spring: hoeing between the green rows, one sowing the last strip
    [[-6, 0.8, 'hoe'], [-3, 1.6, 'hoe'], [0, 0.9, 'sow'], [3, 1.8, 'hoe'], [6, 1.0, 'sow']].forEach(([lx, lz, vr], i) =>
      person(i === 0 && hero?.job === 'peasant' ? 'peasant' : 'farmer', vr === 'sow' ? 'sow' : null, lx, edge + lz, vr === 'sow' ? 0.3 : Math.PI + 0.2 * (i % 2 ? 1 : -1), 9001 + i));
  }
  const lead = crew[0];
  const labels = hero ? [{ pos: lead.labelPos.clone(), title: hero.name, sub: castTag(hero).sub }] : [];
  const focus = at(-1, edge + 2.4, 0.9);
  // the camera beyond the end of the line of reapers, looking along it: the whole crew one behind the
  // other, the cart at the back; it drifts in a little
  const camAt = (u) => at(-f.hw - 4.5 + 2 * u, edge + 6.5 - 1.5 * u, 3.6);
  return {
    group,
    labels,
    work: lead,
    banner: harvest ? 'Harvest time' : 'Work in the fields',
    focus,
    cam(u) {
      return { pos: camAt(u), look: focus.clone().add(new THREE.Vector3(0, -0.3, 0)) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      for (const ws of crew) ws.update(t);
      for (const { P, ph, kind, sheaf } of people) {
        const k = 0.5 + 0.5 * Math.sin(t * 2.2 + ph);
        if (kind === 'bind') {
          // bent over, gathering the stalks into the sheaf and twisting the band round it
          P.body.rotation.set(0.55 + 0.25 * k, 0, 0);
          P.r.g.rotation.set(-0.7 - 0.3 * k, 0, -0.25); P.l.g.rotation.set(-0.9 + 0.3 * k, 0, 0.25);
        } else {
          // bend down for a sheaf, heave it up over the side of the cart
          const up = Math.max(0, Math.sin(t * 1.8 + ph));
          P.body.rotation.set(0.5 * (1 - up), 0, 0);
          P.r.g.rotation.set(-0.6 - 2.0 * up, 0, -0.2); P.l.g.rotation.set(-0.6 - 2.0 * up, 0, 0.2);
          sheaf.visible = up > 0.05 || Math.sin(t * 1.8 + ph) > -0.2;
        }
      }
    },
  };
}

/** Two farmers hoeing in the field closest to the castle. */
export function buildFields({ w, M, seed, hero }) {
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
  const labels = hero ? [{ pos: farmer.labelPos.clone(), title: hero.name, sub: castTag(hero).sub }] : [];
  const focus = farmer.focus.clone().lerp(helper.focus, 0.35);
  return {
    group,
    labels,
    work: farmer,
    banner: 'Work in the fields',
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
