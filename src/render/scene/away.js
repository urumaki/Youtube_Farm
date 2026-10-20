// Villager scenes away from their croft, with their own camera and a hard cut in and out (like the guards
// on the castle walls): the fisherman out in a rowing boat on the river, and the night watch walking a
// street by lantern light at dusk. Same interface as the castle scenes: { group, cam, focus, labelPos,
// update(t, t0, t1), work? }.
import * as THREE from 'three';
import { RIVER_HALF_WIDTH, WATER_LEVEL, polyline } from '../../sim/world.js';
import { JOBS } from '../../sim/tiers.js';
import { boxGeo, cylGeo } from './kit.js';
import { rig, toolGeo } from './work.js';
import { person, stride, flameMaterial, flicker, ease, clamp01 } from './stories/common.js';

/** A small rowing boat, bow at +z. */
function rowboat(M) {
  const g = new THREE.Group();
  const add = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(boxGeo(0.9, 0.12, 2.6).translate(0, 0.06, -0.1), M.woodDark); // bottom
  for (const s of [-1, 1]) add(boxGeo(0.08, 0.5, 2.7).rotateZ(s * 0.25).translate(s * 0.55, 0.3, -0.1), M.wood); // sides, flared
  add(boxGeo(1.15, 0.5, 0.08).translate(0, 0.3, -1.42), M.wood); // stern
  for (const s of [-1, 1]) add(boxGeo(0.08, 0.5, 0.95).rotateY(s * 0.55).translate(s * 0.27, 0.3, 1.55), M.wood); // bow
  add(boxGeo(1.05, 0.06, 0.3).translate(0, 0.4, -0.3), M.woodDark); // the thwart he sits on
  for (const s of [-1, 1]) add(cylGeo(0.025, 0.025, 2.2, 6).rotateX(Math.PI / 2 - 0.08).translate(s * 0.5, 0.48, 0.2), M.wood); // oars shipped
  add(cylGeo(0.2, 0.16, 0.25, 10).translate(0.15, 0.24, 0.85), M.wood); // the catch basket
  return g;
}

/**
 * The fisherman in a boat on the river, near their house: casts, waits for a bite, pulls a fish out.
 * @param home  {x, z} of the villager's house
 */
export function buildBoat({ w, M, hero, home, heightAt }) {
  // the stretch of river closest to home, the boat a few metres out from that bank
  let bi = 0, bd = Infinity;
  w.riverPts.forEach((p, i) => { const d = Math.hypot(p[0] - home.x, p[1] - home.z); if (d < bd) { bd = d; bi = i; } });
  const p = w.riverPts[bi], q = w.riverPts[Math.min(w.riverPts.length - 1, bi + 1)];
  const along = new THREE.Vector3(q[0] - p[0], 0, q[1] - p[1]).normalize();
  let toLand = new THREE.Vector3(-along.z, 0, along.x);
  if (toLand.x * (home.x - p[0]) + toLand.z * (home.z - p[1]) < 0) toLand.negate();
  const at = new THREE.Vector3(p[0], WATER_LEVEL, p[1]).addScaledVector(toLand, RIVER_HALF_WIDTH * 0.35);
  const group = new THREE.Group();
  group.visible = false;
  const boat = new THREE.Group();
  boat.position.copy(at);
  boat.rotation.y = Math.atan2(along.x, along.z); // bow downstream, the land on one side
  group.add(boat);
  boat.add(rowboat(M));
  // the fisherman sits facing the land side, the rod out over the water on the other side
  const P = rig(M, JOBS[hero.job]?.color || JOBS.fisherman.color, { seated: true });
  P.root.position.set(0, 0.43 - 0.47, -0.3); // hips on the thwart
  boat.add(P.root);
  // the rod: from the hands out and up over the stern side; the line hangs to a float
  const rod = new THREE.Group();
  rod.position.set(0.12, 0.55, 0.35);
  P.body.add(rod);
  rod.add(Object.assign(new THREE.Mesh(cylGeo(0.012, 0.028, 2.6, 6).translate(0, 1.3, 0), M.woodDark), { castShadow: true }));
  const tip = new THREE.Object3D();
  tip.position.y = 2.6;
  rod.add(tip);
  const float = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M.clothRed);
  group.add(float);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#e9e4d6' }));
  line.frustumCulled = false;
  group.add(line);
  const fish = toolGeo('fish', M);
  fish.visible = false;
  group.add(fish);
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.2, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#dfeaf0', transparent: true, depthWrite: false }));
  group.add(ripple);
  const labelPos = new THREE.Vector3();
  const water = at.clone().addScaledVector(toLand, -2.6).addScaledVector(along, 1.2); // where the float lies
  water.y = WATER_LEVEL + 0.03;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const focus = at.clone().add(new THREE.Vector3(0, 0.9, 0)).addScaledVector(toLand, -0.8);
  // he sits turned toward the float
  boat.updateMatrixWorld(true);
  const wl = boat.worldToLocal(water.clone());
  P.root.rotation.y = Math.atan2(wl.x, wl.z + 0.3);
  // the camera on the bank, low, looking out at the boat with the far bank behind
  const camBase = at.clone().addScaledVector(toLand, 6.5).addScaledVector(along, -2.5);
  camBase.y = Math.max(heightAt(camBase.x, camBase.z), WATER_LEVEL) + 1.4;
  return {
    group,
    labelPos,
    focus,
    cam(u) {
      const pos = camBase.clone().addScaledVector(along, 1.6 * u).addScaledVector(toLand, -0.8 * ease(u));
      return { pos, look: focus.clone().addScaledVector(toLand, -0.3).setY(WATER_LEVEL + 0.8) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.1 && t <= t1 + 0.1;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      // the boat rocks on the water
      boat.position.y = at.y + 0.04 * Math.sin(t * 1.7);
      boat.rotation.z = 0.04 * Math.sin(t * 1.3);
      boat.rotation.x = 0.02 * Math.sin(t * 1.1 + 1);
      // waiting, a bite (the float dips), then a strike: the rod comes up and the fish flies out
      const BITE = 0.45, STRIKE = 0.6;
      const yank = ease(clamp01((u - STRIKE) / 0.08));
      P.body.rotation.set(-0.1 - 0.15 * yank, 0, 0);
      rod.rotation.set(1.05 - 0.75 * yank, 0, 0); // out over the water, raised at the strike
      P.r.g.rotation.set(-1.0 - 0.6 * yank, 0, -0.35); P.l.g.rotation.set(-0.85 - 0.6 * yank, 0, 0.3);
      boat.updateMatrixWorld(true);
      const tipW = tip.getWorldPosition(tmp);
      const dip = u > BITE && u < STRIKE ? 0.06 * Math.abs(Math.sin(t * 14)) : 0;
      if (u < STRIKE) {
        float.position.copy(water).setY(water.y + 0.02 * Math.sin(t * 2) - dip);
        fish.visible = false;
      } else {
        // the fish swings up on the line toward the boat
        const k = ease(clamp01((u - STRIKE) / 0.2));
        float.position.copy(water).lerp(tmp2.copy(tipW).setY(tipW.y - 0.6), k);
        fish.visible = true;
        fish.position.copy(float.position).setY(float.position.y - 0.05);
        fish.rotation.set(0, 0, 0.3 * Math.sin(t * 18));
      }
      const lp = line.geometry.attributes.position;
      lp.setXYZ(0, tipW.x, tipW.y, tipW.z); lp.setXYZ(1, float.position.x, float.position.y, float.position.z);
      lp.needsUpdate = true;
      // rings spread from the float
      const r = ((t * 0.8) % 1);
      ripple.position.copy(water);
      ripple.scale.setScalar(1 + 5 * r);
      ripple.material.opacity = u < STRIKE ? 0.6 * (1 - r) : 0;
      P.root.getWorldPosition(labelPos);
      labelPos.y += 1.9;
    },
  };
}

/** The night watch: a guard walks a street near their house at dusk, a lantern held up, a spear. */
export function buildNightWatch({ w, M, hero, home, heightAt }) {
  // the street closest to home
  let best = null;
  for (const road of w.roads) {
    const pl = polyline(road.pts);
    for (let s = 0; s < pl.total; s += 4) {
      const [x, z] = pl.at(s), d = Math.hypot(x - home.x, z - home.z);
      if (!best || d < best.d) best = { d, s, pl };
    }
  }
  const { pl } = best;
  const s0 = Math.max(4, Math.min(pl.total - 12, best.s - 4));
  const place = (s, lateral = 0) => {
    const [x, z, ang] = pl.at(s);
    const v = new THREE.Vector3(x - Math.sin(ang) * lateral, 0, z + Math.cos(ang) * lateral);
    v.y = heightAt(v.x, v.z) + 0.03;
    return { v, ang };
  };
  const group = new THREE.Group();
  group.visible = false;
  const P = person(M, JOBS[hero.job]?.color || JOBS.guard.color);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.18, 0), M.iron);
  helm.castShadow = true;
  P.body.add(helm);
  P.r.hand.add(toolGeo('spear', M));
  // the lantern hangs from the raised left hand: an iron frame, a candle flame, warm light
  const lantern = new THREE.Group();
  lantern.position.set(0, -0.2, 0.06);
  P.l.hand.add(lantern);
  lantern.add(new THREE.Mesh(boxGeo(0.16, 0.22, 0.16).translate(0, -0.12, 0), new THREE.MeshBasicMaterial({ color: '#ffd38a', transparent: true, opacity: 0.55 })));
  for (const [x, z] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) lantern.add(new THREE.Mesh(boxGeo(0.02, 0.24, 0.02).translate(x, -0.12, z), M.iron));
  lantern.add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.08, 4).rotateY(Math.PI / 4).translate(0, 0.03, 0), M.iron));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6).translate(0, -0.12, 0), flameMaterial('#ffb347'));
  lantern.add(flame);
  const light = new THREE.PointLight('#ffb867', 0, 9, 1.8);
  light.position.set(0, -0.12, 0);
  lantern.add(light);
  light.visible = false;
  group.add(P.root);
  const labelPos = new THREE.Vector3();
  const SPEED = 1.0;
  const at = (t, t0) => s0 + (t - t0) * SPEED;
  let T0 = 0, T1 = 1;
  const tmp = new THREE.Vector3();
  return {
    group,
    labelPos,
    phase: 1, // dusk, windows lit
    focus: place(s0 + 2).v.add(new THREE.Vector3(0, 1.2, 0)),
    setWindow(t0, t1) { T0 = t0; T1 = t1; },
    cam(u) {
      // ahead of the guard and a little to the side, looking back down the street
      const s = at(T0 + u * (T1 - T0), T0);
      const { v: g } = place(s), { v: ahead } = place(s + 4.6, 1.4);
      return { pos: ahead.clone().setY(ahead.y + 1.9), look: g.clone().setY(g.y + 1.25) };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.1 && t <= t1 + 0.1;
      group.visible = on;
      light.visible = on;
      if (!on) return;
      const s = at(t, t0);
      const { v, ang } = place(s, 0.6);
      P.root.position.copy(v);
      P.root.rotation.y = Math.PI / 2 - ang; // walking toward larger s
      stride(P, (t - t0) * 3.6, 0.42, { arms: false });
      P.r.g.rotation.set(-0.35, 0, 0); // spear upright
      P.l.g.rotation.set(-1.1 + 0.05 * Math.sin(t * 3.6), 0, 0.15); // lantern held out in front
      lantern.rotation.x = 1.1; // hangs straight down whatever the arm does
      flicker(flame, t, 1);
      light.intensity = 6 * (1 + 0.08 * Math.sin(t * 13) + 0.05 * Math.sin(t * 31));
      P.root.getWorldPosition(tmp);
      labelPos.copy(tmp).setY(tmp.y + 2.45);
    },
  };
}
