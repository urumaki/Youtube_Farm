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

/** The bank of the river closest to home: where the water ends, the directions along it and to land. */
function riverBank(w, home, heightAt) {
  let bi = 0, bd = Infinity;
  w.riverPts.forEach((p, i) => { const d = Math.hypot(p[0] - home.x, p[1] - home.z); if (d < bd) { bd = d; bi = i; } });
  const i0 = Math.min(bi, w.riverPts.length - 2);
  const p = w.riverPts[i0], q = w.riverPts[i0 + 1];
  const along = new THREE.Vector3(q[0] - p[0], 0, q[1] - p[1]).normalize();
  const toLand = new THREE.Vector3(-along.z, 0, along.x);
  if (toLand.x * (home.x - p[0]) + toLand.z * (home.z - p[1]) < 0) toLand.negate();
  const at = (d) => new THREE.Vector3(p[0] + toLand.x * d, 0, p[1] + toLand.z * d);
  // the waterline, and the point inland where the ground reaches the jetty's deck
  let edge = RIVER_HALF_WIDTH * 0.6;
  while (edge < RIVER_HALF_WIDTH * 2.5 && heightAt(at(edge).x, at(edge).z) < WATER_LEVEL + 0.05) edge += 0.25;
  const deckY = WATER_LEVEL + 0.55;
  let land = edge;
  while (land < edge + 6 && heightAt(at(land).x, at(land).z) < deckY - 0.1) land += 0.25;
  return { along, toLand, at, edge, land, deckY };
}

/** A plank jetty from the bank out over the water; local +z points out over the river. */
function jetty(M, length) {
  const g = new THREE.Group();
  const add = (geo, m) => { const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  for (let i = 0; i < Math.round(length / 0.32); i++) add(boxGeo(1.5, 0.08, 0.28).translate(0, -0.04, 0.16 + i * 0.32), i % 3 ? M.wood : M.woodDark);
  for (const s of [-1, 1]) add(boxGeo(0.1, 0.12, length).translate(s * 0.62, -0.14, length / 2), M.woodDark); // the stringers
  for (let z = 0.4; z < length; z += 1.6) for (const s of [-1, 1]) add(cylGeo(0.09, 0.1, 2.6, 6).translate(s * 0.7, -1.25, z), M.woodDark); // posts
  for (const s of [-1, 1]) add(cylGeo(0.09, 0.1, 3.1, 6).translate(s * 0.7, -1.1, length - 0.12), M.woodDark); // the end posts stand up a little
  add(cylGeo(0.2, 0.16, 0.25, 10).translate(-0.45, 0.125, length - 1.3), M.wood); // the catch basket
  return g;
}

/**
 * The fisherman on a jetty at the river bank near their house (owner 2026-10-22: fishing is on the river):
 * 'rod' casts a line, waits for a bite and pulls a fish out; 'net' throws a round net and hauls it in.
 * @param home  {x, z} of the villager's house
 */
export function buildRiverbank({ w, M, hero, home, heightAt, mode = 'rod', guest = null }) {
  const B = riverBank(w, home, heightAt);
  const reach = B.land - B.edge + 2.6; // from the dry bank out to 2.6 m over the water
  const base = B.at(B.land).setY(B.deckY);
  const out = B.toLand.clone().negate();
  const group = new THREE.Group();
  group.visible = false;
  const pier = jetty(M, reach + 0.4);
  pier.position.copy(base).addScaledVector(B.toLand, 0.4);
  pier.rotation.y = Math.atan2(out.x, out.z);
  group.add(pier);
  const P = rig(M, JOBS[hero.job]?.color || JOBS.fisherman.color);
  P.root.position.set(0.15, 0, reach - 0.2);
  pier.add(P.root);
  // a villager visiting the fisherman (saved days planned before the fishing moved to the river) stands
  // on the jetty behind him, watching, and cheers at the catch
  const G = guest ? rig(M, JOBS[guest.job]?.color || '#7a6a55') : null;
  if (G) { G.root.position.set(mode === 'rod' ? -0.6 : 0.55, 0, reach - (mode === 'rod' ? 0.75 : 1.1)); G.root.rotation.y = mode === 'rod' ? 0.3 : -0.3; pier.add(G.root); }
  const water = base.clone().addScaledVector(out, reach + (mode === 'net' ? 2.6 : 3.2)).addScaledVector(B.along, mode === 'net' ? 0.6 : 0.9);
  water.y = WATER_LEVEL + 0.03;
  pier.updateMatrixWorld(true);
  const wl = pier.worldToLocal(water.clone());
  P.root.rotation.y = Math.atan2(wl.x - P.root.position.x, wl.z - P.root.position.z);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#e9e4d6' }));
  line.frustumCulled = false;
  group.add(line);
  const setLine = (a, b) => {
    const lp = line.geometry.attributes.position;
    lp.setXYZ(0, a.x, a.y, a.z); lp.setXYZ(1, b.x, b.y, b.z);
    lp.needsUpdate = true;
  };
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.2, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#dfeaf0', transparent: true, depthWrite: false }));
  ripple.position.copy(water);
  group.add(ripple);
  const fish = [0, 1].map(() => { const f = toolGeo('fish', M); f.visible = false; group.add(f); return f; });
  const lerp = THREE.MathUtils.lerp;
  let pose;
  if (mode === 'rod') {
    const rod = new THREE.Group();
    rod.position.set(0.12, 0.5, 0.42);
    P.body.add(rod);
    rod.add(Object.assign(new THREE.Mesh(cylGeo(0.012, 0.03, 3, 6).translate(0, 1.5, 0), M.woodDark), { castShadow: true }));
    const tip = new THREE.Object3D();
    tip.position.y = 3;
    rod.add(tip);
    const float = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M.clothRed);
    group.add(float);
    const CAST = 0.27, LAND = 0.38, BITE = 0.55, STRIKE = 0.68;
    pose = (t, u) => {
      // ready, the rod back over the shoulder, the cast, the wait, the bite, the strike
      const r = u < 0.08 ? 0.6 : u < 0.2 ? lerp(0.6, -0.35, ease((u - 0.08) / 0.12)) : u < CAST ? lerp(-0.35, 1.0, ((u - 0.2) / 0.07) ** 2)
        : u < STRIKE ? 1.0 : lerp(1.0, 0.15, ease(clamp01((u - STRIKE) / 0.1)));
      const up = 1 - clamp01(r);
      rod.rotation.set(r, 0, 0);
      P.body.rotation.set(0.05 + 0.1 * clamp01(r), 0, 0);
      P.r.g.rotation.set(-1.0 - 0.5 * up, 0, -0.3); P.l.g.rotation.set(-0.85 - 0.5 * up, 0, 0.3);
      group.updateMatrixWorld(true);
      const tipW = tip.getWorldPosition(tmp);
      if (u < CAST) {
        float.position.copy(tipW).setY(tipW.y - 0.5); // dangling from the tip
      } else if (u < LAND) {
        const k = (u - CAST) / (LAND - CAST);
        float.position.copy(tipW).lerp(water, k).setY(lerp(tipW.y - 0.3, water.y, k) + 2.2 * k * (1 - k));
      } else if (u < STRIKE) {
        const dip = u > BITE ? 0.07 * Math.abs(Math.sin(t * 14)) : 0;
        float.position.copy(water).setY(water.y + 0.02 * Math.sin(t * 2) - dip);
      } else {
        // the fish comes up out of the water and swings on the line
        const k = ease(clamp01((u - STRIKE) / 0.16));
        float.position.copy(water).lerp(tmp2.copy(tipW).setY(tipW.y - 0.9), k);
        float.position.x += 0.15 * Math.sin(t * 5) * k;
      }
      fish[0].visible = u >= STRIKE;
      fish[0].position.copy(float.position).setY(float.position.y - 0.05);
      fish[0].rotation.set(0, 0, 0.35 * Math.sin(t * 18));
      setLine(tipW, float.position);
      const rr = (t * 0.8) % 1;
      ripple.scale.setScalar(1 + 5 * rr);
      ripple.material.opacity = u > LAND && u < STRIKE + 0.05 ? 0.6 * (1 - rr) : 0;
    };
  } else {
    // a round casting net: a flat cone of mesh, the rope tied at its top
    const net = new THREE.Mesh(new THREE.ConeGeometry(1, 0.6, 18, 3, true).translate(0, -0.3, 0),
      new THREE.MeshBasicMaterial({ color: '#efe8d8', wireframe: true, transparent: true }));
    group.add(net);
    const bundle = toolGeo('net', M);
    P.r.hand.add(bundle);
    const THROW = 0.22, LAND = 0.36, HAUL = 0.56;
    const handW = new THREE.Vector3();
    pose = (t, u) => {
      // wind up to the side, throw, let it sink, haul it in hand over hand
      const twist = u < THROW - 0.08 ? lerp(0, 0.7, ease(u / (THROW - 0.08))) : u < THROW + 0.04 ? lerp(0.7, -0.45, ease((u - THROW + 0.08) / 0.12))
        : u < HAUL ? lerp(-0.45, 0, ease(clamp01((u - THROW - 0.04) / 0.15))) : 0;
      P.body.rotation.set(u > HAUL ? 0.25 : 0.1, twist, 0);
      const swing = clamp01((u - THROW + 0.08) / 0.12);
      if (u < THROW + 0.04) {
        P.r.g.rotation.set(lerp(-0.6, -1.5, swing), 0, -0.5 + 0.4 * swing);
        P.l.g.rotation.set(-0.7, 0, 0.4);
      } else if (u < HAUL) {
        P.r.g.rotation.set(-1.2, 0, -0.2); P.l.g.rotation.set(-1.0, 0, 0.2);
      } else {
        const s = Math.sin(t * 7);
        P.r.g.rotation.set(-1.0 - 0.45 * s, 0, -0.15); P.l.g.rotation.set(-1.0 + 0.45 * s, 0, 0.15);
      }
      bundle.visible = u < THROW;
      group.updateMatrixWorld(true);
      P.r.hand.getWorldPosition(handW);
      net.material.opacity = 0.9;
      if (u < THROW) {
        net.visible = false;
      } else if (u < LAND) {
        const k = (u - THROW) / (LAND - THROW);
        net.visible = true;
        net.position.copy(handW).lerp(water, k).setY(lerp(handW.y, water.y + 0.3, k) + 2.0 * k * (1 - k));
        net.scale.set(lerp(0.2, 1.3, ease(k)), lerp(0.6, 0.25, k), lerp(0.2, 1.3, ease(k)));
        net.rotation.y = k * 1.5;
      } else if (u < HAUL) {
        const k = (u - LAND) / (HAUL - LAND);
        net.position.copy(water).setY(water.y + 0.3 - 0.25 * k);
        net.scale.set(1.3, 0.25, 1.3);
        net.material.opacity = 0.9 - 0.5 * k;
      } else {
        // pulled in: the net closes into a bag and comes up out of the water under the jetty's end
        const k = ease(clamp01((u - HAUL) / 0.36));
        const end = handW.clone().addScaledVector(out, 0.5).setY(handW.y - 0.25);
        net.position.copy(water).lerp(end, k).setY(lerp(water.y + 0.05, end.y, k ** 2));
        net.scale.set(lerp(1.3, 0.32, k), lerp(0.25, 1.1, k), lerp(1.3, 0.32, k));
        net.material.opacity = lerp(0.4, 0.95, k);
      }
      fish.forEach((f, i) => {
        f.visible = u > HAUL + 0.2;
        f.position.copy(net.position).add(tmp2.set(0.08 * (i ? 1 : -1), -0.35 * net.scale.y - 0.15, 0));
        f.rotation.set(0, i * 1.4, 0.4 * Math.sin(t * 16 + i * 2));
      });
      setLine(handW, net.visible ? net.position : handW);
      const rr = (t * 0.8) % 1;
      ripple.scale.setScalar(1.5 + 4 * rr);
      ripple.material.opacity = u > LAND && u < HAUL + 0.1 ? 0.6 * (1 - rr) : 0;
    };
  }
  const labelPos = new THREE.Vector3(), labelPos2 = new THREE.Vector3();
  const CATCH = mode === 'rod' ? 0.7 : 0.8;
  const stand = pier.localToWorld(new THREE.Vector3(0.15, 0, reach - 0.2));
  const focus = stand.clone().lerp(water, 0.35).setY(B.deckY + 0.9);
  // with a guest, frame the two of them: the focus moves toward the guest, the camera steps back
  if (G) focus.lerp(G.root.getWorldPosition(new THREE.Vector3()).setY(B.deckY + 0.9), 0.55);
  // the camera low over the water, turned back toward the fisherman with the bank behind him (the bank
  // itself has houses and roofs that would stand in front of a camera on land)
  const side = mode === 'net' ? -1 : 1; // the float lies a little downstream, the camera is on the other side
  const camBase = stand.clone().addScaledVector(out, G ? 8 : 6.5).addScaledVector(B.along, -4.5 * side);
  camBase.y = WATER_LEVEL + 1.7;
  return {
    group,
    labelPos,
    labelPos2: G ? labelPos2 : null,
    focus,
    cam(u) {
      const pos = camBase.clone().addScaledVector(B.along, 1.2 * side * ease(u)).addScaledVector(out, -0.8 * u);
      return { pos, look: focus };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.1 && t <= t1 + 0.1;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      pose(t, u);
      P.root.getWorldPosition(labelPos);
      labelPos.y += 1.95;
      if (G) {
        const cheer = u > CATCH ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
        G.r.g.rotation.set(u > CATCH ? -2.6 - 0.3 * cheer : -0.1, 0, u > CATCH ? -0.2 : -0.1);
        G.l.g.rotation.set(-0.1, 0, 0.1);
        G.root.getWorldPosition(labelPos2);
        labelPos2.y += 2.15;
      }
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
