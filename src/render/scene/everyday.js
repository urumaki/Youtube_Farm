// More everyday shots (see ambient.js): a shepherd with the flock on the open grass, and washing day at the
// river. Same interface as the story scenes: { group, labels, banner, focus, cam(u), update(t, t0, t1) }.
import * as THREE from 'three';
import { JOBS } from '../../sim/tiers.js';
import { heightAt, RIVER_HALF_WIDTH, WATER_LEVEL } from '../../sim/world.js';
import { rand01 } from '../../sim/prng.js';
import { boxGeo, cylGeo } from './kit.js';
import { person } from './stories/common.js';

/** A sheep, facing +z; `head` nods down to graze. */
function sheep(M) {
  const g = new THREE.Group();
  const add = (geo, m, parent = g) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; parent.add(o); return o; };
  add(new THREE.SphereGeometry(0.36, 12, 9).scale(0.85, 0.75, 1.15).translate(0, 0.62, 0), M.clothIvory);
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0.38);
  g.add(head);
  add(boxGeo(0.17, 0.2, 0.3).translate(0, 0, 0.12), M.gear, head);
  for (const x of [-0.11, 0.11]) add(boxGeo(0.12, 0.04, 0.07).translate(x, 0.05, 0.02), M.gear, head);
  for (const [x, z] of [[-0.14, -0.22], [0.14, -0.22], [-0.14, 0.22], [0.14, 0.22]]) add(boxGeo(0.07, 0.36, 0.07).translate(x, 0.18, z), M.gear);
  return { g, head };
}

/** A shepherd with a crook watches the flock grazing on the open grass beyond the fields. */
export function buildPasture({ w, M, seed, hero, lang }) {
  // open grass just east of the farthest field lots (the lots themselves are bare earth)
  const far = [...w.fields].sort((a, b) => b.z * -1 - a.z * -1 || b.x - a.x).slice(0, 6).sort((a, b) => b.x - a.x)[0];
  if (!far) return null;
  const y = (x, z) => heightAt(w, x, z) + 0.02;
  const C = new THREE.Vector3(far.x + far.hw + 14, 0, far.z);
  C.y = y(C.x, C.z);
  const group = new THREE.Group();
  group.visible = false;
  const flock = Array.from({ length: 13 }, (_, i) => {
    const s = sheep(M);
    const a = rand01(seed, 'sheep-a', i) * Math.PI * 2, r = 1.2 + rand01(seed, 'sheep-r', i) * 4.2;
    group.add(s.g);
    return { ...s, x: C.x + Math.cos(a) * r, z: C.z + Math.sin(a) * r * 0.7, yaw: rand01(seed, 'sheep-y', i) * Math.PI * 2, ph: rand01(seed, 'sheep-p', i) * 10 };
  });
  const P = person(M, hero ? JOBS[hero.job]?.color || '#7a6a55' : '#7a6a55');
  const crook = new THREE.Group();
  crook.add(new THREE.Mesh(cylGeo(0.025, 0.025, 1.9, 6).translate(0, 0.35, 0.08), M.woodDark));
  crook.add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 5, 10, Math.PI * 1.2).rotateY(Math.PI / 2).translate(0, 1.38, 0.18), M.woodDark));
  P.r.hand.add(crook);
  group.add(P.root);
  const at = new THREE.Vector3(C.x - 3.2, 0, C.z - 1.2);
  at.y = y(at.x, at.z);
  P.root.position.copy(at);
  P.root.rotation.y = Math.atan2(C.x - at.x, C.z - at.z);
  const labels = hero ? [{ pos: at.clone().setY(at.y + 2.4), title: hero.name, sub: lang === 'it' ? 'Pastore' : 'Shepherd' }] : [];
  const focus = C.clone().add(new THREE.Vector3(-1.4, 0.8, -0.4));
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Le pecore al pascolo' : 'The flock at pasture',
    focus,
    cam(u) {
      const a = -2.4 + 0.5 * u;
      return { pos: focus.clone().add(new THREE.Vector3(Math.cos(a) * 8.5, 1.5, Math.sin(a) * 8.5)), look: focus };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      // the sheep amble a few steps, stop and graze; the shepherd leans on the crook and looks around
      for (const s of flock) {
        const c = (t + s.ph) / 4, k = c - Math.floor(c), walking = k < 0.3;
        const step = Math.floor(c) * 0.5 + (walking ? k / 0.3 : 1) * 0.5;
        const x = s.x + Math.sin(s.yaw) * step, z = s.z + Math.cos(s.yaw) * step;
        s.g.position.set(x, y(x, z), z);
        s.g.rotation.y = s.yaw;
        s.head.rotation.x = walking ? 0 : 0.7 + 0.1 * Math.sin(t * 3 + s.ph);
        s.g.position.y += walking ? 0.02 * Math.abs(Math.sin(t * 12)) : 0;
      }
      P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
      P.r.g.rotation.set(-0.45, 0, -0.1);
      P.l.g.rotation.set(-0.5, 0, 0.35);
      P.body.rotation.set(0.05, 0.35 * Math.sin(t * 0.6), 0);
    },
  };
}

/**
 * Washing day at the river: villagers bent over tubs scrubbing linen on the bank, another hanging it on a
 * line between two poles, a basket of washing. On the castle's side of the river, nearest the castle.
 */
export function buildLaundry({ w, M, hero, lang }) {
  let bi = 0, bd = Infinity;
  w.riverPts.forEach((p, i) => { const d = Math.hypot(p[0], p[1]); if (d < bd) { bd = d; bi = i; } });
  const p = w.riverPts[bi], q = w.riverPts[Math.min(w.riverPts.length - 1, bi + 1)];
  const along = new THREE.Vector3(q[0] - p[0], 0, q[1] - p[1]).normalize();
  const toLand = new THREE.Vector3(-along.z, 0, along.x);
  if (toLand.x * -p[0] + toLand.z * -p[1] < 0) toLand.negate();
  // the first dry ground beyond the water's edge (the water surface reaches under the low bank)
  const o = new THREE.Vector3();
  for (let d = RIVER_HALF_WIDTH * 0.6; d < RIVER_HALF_WIDTH + 40; d += 0.4) {
    o.set(p[0], 0, p[1]).addScaledVector(toLand, d);
    o.y = heightAt(w, o.x, o.z);
    if (o.y > WATER_LEVEL + 0.2) break;
  }
  const frame = new THREE.Group(); // +z toward the river, x along the bank
  frame.position.copy(o).addScaledVector(toLand, 1.2);
  frame.rotation.y = Math.atan2(-toLand.x, -toLand.z);
  frame.updateMatrixWorld(true);
  const ground = (x, z) => { const v = frame.localToWorld(new THREE.Vector3(x, 0, z)); v.y = heightAt(w, v.x, v.z) + 0.02; return v; };
  const group = new THREE.Group();
  group.visible = false;
  const put = (mesh, x, z, dy = 0) => { mesh.position.copy(ground(x, z)); mesh.position.y += dy; mesh.rotation.y = frame.rotation.y; mesh.castShadow = true; group.add(mesh); return mesh; };
  // two tubs with suds, a basket, the washing line with linen
  for (const x of [-1.3, 0.9]) {
    put(new THREE.Mesh(cylGeo(0.42, 0.36, 0.42, 14), M.wood), x, 0.5, 0.21);
    put(new THREE.Mesh(cylGeo(0.4, 0.4, 0.05, 14), M.clothIvory), x, 0.5, 0.4);
  }
  put(new THREE.Mesh(cylGeo(0.32, 0.26, 0.32, 10), M.wood), 2.3, -0.8, 0.16);
  put(new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8).scale(1, 0.5, 1), M.clothIvory), 2.3, -0.8, 0.33);
  const L0 = -2.6, L1 = 1.2, LZ = -2.2;
  for (const x of [L0, L1]) put(new THREE.Mesh(cylGeo(0.04, 0.05, 1.9, 6), M.woodDark), x, LZ, 0.95);
  const a = ground(L0, LZ), b = ground(L1, LZ);
  a.y += 1.8; b.y += 1.8;
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: '#d8cfb8' })));
  const sheets = ['#f1ece0', '#b5476b', '#e9e3d2', '#3f6b8a', '#e3b23c'].map((c, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.75).translate(0, -0.37, 0), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide, roughness: 0.9 }));
    m.position.copy(a).lerp(b, 0.12 + i * 0.19);
    m.rotation.y = frame.rotation.y;
    m.castShadow = true;
    group.add(m);
    return m;
  });
  // two bend over the tubs, scrubbing; the third hangs the washing (the named villager scrubs at the first tub)
  const washers = [hero ? JOBS[hero.job]?.color || '#8a7a5c' : '#9b5a3c', '#5f7a8a', '#7a5b7d'].map((c, i) => {
    const P = person(M, c);
    P.root.position.copy(i < 2 ? ground([-1.3, 0.9][i], -0.05) : ground(-0.4, LZ + 0.45));
    P.root.rotation.y = frame.rotation.y + (i < 2 ? 0 : Math.PI);
    if (i < 2) { const cloth = new THREE.Mesh(boxGeo(0.3, 0.04, 0.22), M.clothIvory); cloth.position.set(-0.3, 0, 0.1); P.r.hand.add(cloth); }
    group.add(P.root);
    return P;
  });
  const labels = hero ? [{ pos: washers[0].root.position.clone().setY(washers[0].root.position.y + 2.2), title: hero.name, sub: lang === 'it' ? 'Bucato al fiume' : 'Washing day' }] : [];
  const focus = ground(-0.3, -0.6).add(new THREE.Vector3(0, 0.9, 0));
  return {
    group,
    labels,
    banner: lang === 'it' ? 'Giorno di bucato' : 'Washing day',
    focus,
    cam(u) {
      // from along the bank, the river on one side and the washing line on the other
      const pos = frame.localToWorld(new THREE.Vector3(4.6 - 1.0 * u, 0, -5.2 + 0.4 * u));
      pos.y = Math.max(focus.y + 1.7, heightAt(w, pos.x, pos.z) + 1.6); // above the rising bank
      return { pos, look: focus };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      if (!group.visible) return;
      washers.forEach((P, i) => {
        P.legs[0].rotation.x = P.legs[1].rotation.x = 0;
        if (i < 2) {
          const s = Math.sin(t * 7 + i * 2);
          P.body.rotation.set(0.75, 0, 0);
          P.r.g.rotation.set(-0.7 + 0.25 * s, 0, -0.25); P.l.g.rotation.set(-0.7 - 0.25 * s, 0, 0.25);
        } else {
          const s = Math.sin(t * 1.6);
          P.body.rotation.set(-0.05, 0, 0);
          P.r.g.rotation.set(-2.6 + 0.2 * s, 0, -0.15); P.l.g.rotation.set(-2.4 - 0.2 * s, 0, 0.15);
        }
      });
      sheets.forEach((m, i) => { m.rotation.x = 0.12 + 0.1 * Math.sin(t * 2.3 + i * 1.1); }); // flapping in the breeze
    },
  };
}
