// The day's caravan: villagers named by commenters today walk into town along the east road, two
// abreast, each with their name above; one covered wagon full of their belongings per 50 people.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { polyline } from '../../sim/world.js';
import { rand01 } from '../../sim/prng.js';
import { JOBS } from '../../sim/tiers.js';
import { cylGeo, boxGeo } from './kit.js';

const SPEED = 1.35; // m/s
const ROW = 1.7; // m between rows
const flat = (g) => { const q = g.index ? g.toNonIndexed() : g; q.deleteAttribute('uv'); return q; };
const merged = (parts) => mergeGeometries(parts.map(flat));

function personParts() {
  const sleeve = (sx) => cylGeo(0.075, 0.095, 0.62, 8).rotateZ(sx * 0.16).translate(sx * 0.29, 1.12, 0);
  return {
    tunic: merged([cylGeo(0.19, 0.33, 0.9, 12).translate(0, 0.98, 0), new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.25, 0.5, 0.85).translate(0, 1.42, 0), sleeve(-1), sleeve(1)]),
    gear: merged([cylGeo(0.075, 0.085, 0.58, 6).translate(-0.09, 0.29, 0), cylGeo(0.075, 0.085, 0.58, 6).translate(0.09, 0.29, 0), cylGeo(0.235, 0.24, 0.07, 12).translate(0, 1.08, 0),
      cylGeo(0.215, 0.2, 0.09, 12).translate(0, 1.79, 0), new THREE.ConeGeometry(0.2, 0.26, 12).translate(0, 1.96, 0),
      new THREE.SphereGeometry(0.22, 10, 8).scale(1, 1.2, 0.7).translate(0, 1.25, -0.28)]), // bundle on the back
    skin: merged([new THREE.SphereGeometry(0.17, 12, 10).scale(1, 1.1, 1).translate(0, 1.66, 0), cylGeo(0.07, 0.08, 0.12, 8).translate(0, 1.5, 0),
      new THREE.SphereGeometry(0.06, 8, 6).translate(-0.33, 0.8, 0), new THREE.SphereGeometry(0.06, 8, 6).translate(0.33, 0.8, 0)]),
  };
}

/** Covered wagon with cargo, pulled by an ox. Faces +z (the ox in front). */
function wagon(M, seed, k) {
  const g = new THREE.Group();
  const add = (geo, mat, parent = g) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  add(boxGeo(1.7, 0.5, 3.6).translate(0, 1.05, 0), M.wood);
  add(boxGeo(1.8, 0.1, 3.7).translate(0, 0.8, 0), M.woodDark);
  // canvas cover on hoops, open at the back so the cargo shows
  const cover = new THREE.CylinderGeometry(0.95, 0.95, 3.1, 18, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
  add(cover.translate(0, 1.3, 0.15), M.clothIvory);
  for (const z of [-1.35, 0, 1.35]) add(new THREE.TorusGeometry(0.97, 0.04, 6, 16, Math.PI).translate(0, 1.3, z), M.woodDark);
  // cargo: barrels, sacks, a chest
  add(cylGeo(0.3, 0.3, 0.6, 10).translate(-0.45, 1.6, -1.45), M.wood);
  add(cylGeo(0.3, 0.3, 0.6, 10).translate(0.4, 1.6, -1.2), M.wood);
  add(new THREE.SphereGeometry(0.3, 10, 8).scale(1, 0.8, 1).translate(0.05, 1.55, -1.65), M.hay);
  add(boxGeo(0.7, 0.45, 0.5).translate(-0.2, 1.5, -0.6), M.woodDark);
  // wheels turn with the distance travelled
  const wheels = [];
  for (const [x, z] of [[-0.95, -1.15], [0.95, -1.15], [-0.95, 1.15], [0.95, 1.15]]) {
    const w = new THREE.Group();
    w.position.set(x, 0.6, z);
    add(cylGeo(0.6, 0.6, 0.12, 14).rotateZ(Math.PI / 2), M.woodDark, w);
    add(cylGeo(0.12, 0.12, 0.2, 8).rotateZ(Math.PI / 2), M.iron, w);
    for (let s = 0; s < 4; s++) add(boxGeo(0.06, 1.05, 0.06).rotateX((s * Math.PI) / 4), M.wood, w);
    g.add(w);
    wheels.push(w);
  }
  add(boxGeo(0.12, 0.12, 2.2).translate(0, 0.85, 2.9), M.woodDark); // tongue
  // the ox
  const ox = new THREE.Group();
  ox.position.set(0, 0, 4.4);
  g.add(ox);
  const hide = M.people.clone();
  hide.color.set(rand01(seed, 'ox', k) < 0.5 ? '#6e4a2e' : '#8a7058');
  add(boxGeo(0.9, 0.9, 2.0).translate(0, 1.25, 0), hide, ox);
  add(boxGeo(0.55, 0.55, 0.6).translate(0, 1.4, 1.2), hide, ox);
  add(merged([new THREE.ConeGeometry(0.06, 0.4, 6).rotateZ(1.2).translate(-0.35, 1.75, 1.15), new THREE.ConeGeometry(0.06, 0.4, 6).rotateZ(-1.2).translate(0.35, 1.75, 1.15)]), M.clothIvory, ox);
  const legs = [];
  for (const [x, z] of [[-0.3, -0.7], [0.3, -0.7], [-0.3, 0.7], [0.3, 0.7]]) {
    const l = new THREE.Group();
    l.position.set(x, 0.85, z);
    add(boxGeo(0.18, 0.85, 0.18).translate(0, -0.42, 0), hide, l);
    ox.add(l);
    legs.push(l);
  }
  return { g, wheels, legs };
}

/**
 * @param named [{ name, job }] villagers named today, in arrival order
 * @returns {{ group, labels, head, update(t, t0, t1) }} or null when nobody arrives
 */
export function buildCaravan({ w, named, M, seed, yFn }) {
  if (!named.length) return null;
  const road = w.roads.find((r) => r.id === 'east') || w.roads[0];
  const pl = polyline(road.pts);
  const people = named.slice(0, 40);
  const nWagons = Math.ceil(named.length / 50);
  const group = new THREE.Group();
  group.visible = false;
  const parts = personParts();
  const tunics = people.map((p) => { const m = M.people.clone(); m.color.set(JOBS[p.job]?.color || '#7a6a55'); return m; });
  const figures = people.map((p, i) => {
    const f = new THREE.Group();
    for (const [geo, mat] of [[parts.tunic, tunics[i]], [parts.gear, M.gear], [parts.skin, M.skin]]) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; f.add(m); }
    group.add(f);
    return f;
  });
  const wagons = Array.from({ length: nWagons }, (_, k) => { const wg = wagon(M, seed, k); group.add(wg.g); return wg; });
  const rows = Math.ceil(people.length / 2);
  // the column's head walks from s0 + span toward the market; wagons follow the people
  const span = 14;
  const s0 = Math.min(pl.total - 40, 70);
  const labels = people.map((p) => ({ pos: new THREE.Vector3(), title: p.name, sub: JOBS[p.job]?.label || p.job }));
  const P = new THREE.Vector3(), head = { pos: new THREE.Vector3(), dir: 0 };
  const place = (obj, s, lateral) => {
    const [x, z, ang] = pl.at(Math.max(0, Math.min(pl.total, s)));
    const nx = -Math.sin(ang), nz = Math.cos(ang);
    P.set(x + nx * lateral, 0, z + nz * lateral);
    P.y = yFn(P.x, P.z);
    if (obj) {
      obj.position.copy(P);
      obj.rotation.y = -ang - Math.PI / 2; // walking toward decreasing s (into town)
    }
    return ang;
  };
  return {
    group,
    labels,
    head,
    /** Pure: where the head of the column is at time t (for the camera). */
    headAt(t, t0) {
      const sHead = s0 + span - (t - t0 + 1.5) * SPEED;
      const [x, z, ang] = pl.at(Math.max(0, Math.min(pl.total, sHead - 1)));
      return { pos: new THREE.Vector3(x, yFn(x, z), z), dir: ang + Math.PI };
    },
    count: named.length,
    wagons: nWagons,
    update(t, t0, t1) {
      group.visible = t >= t0 - 1.5 && t <= t1 + 0.5;
      if (!group.visible) return;
      const walked = (t - t0 + 1.5) * SPEED;
      const sHead = s0 + span - walked;
      people.forEach((p, i) => {
        const row = Math.floor(i / 2), side = i % 2 ? 1 : -1;
        const s = sHead + row * ROW + rand01(seed, 'car', i) * 0.4;
        place(figures[i], s, side * 0.75);
        figures[i].position.y += Math.abs(Math.sin(t * 7 + i)) * 0.05;
        labels[i].pos.copy(figures[i].position).add(new THREE.Vector3(0, 2.3 + (i % 2) * 0.55, 0)); // stagger the pair
      });
      wagons.forEach((wg, k) => {
        const s = sHead + rows * ROW + 3.2 + k * 8.5;
        place(wg.g, s, 0);
        wg.wheels.forEach((wh) => { wh.rotation.x = -(walked / 0.6); });
        wg.legs.forEach((l, j) => { l.rotation.x = 0.35 * Math.sin(t * 5 + (j % 2 ? Math.PI : 0) + (j > 1 ? Math.PI : 0)); });
      });
      const ang = place(null, sHead - 1, 0);
      head.pos.copy(P);
      head.dir = ang + Math.PI; // direction of travel
    },
  };
}
