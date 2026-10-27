// A merchant ship at the harbor (owner 2026-10-27), three days. 'arrive': she sails in along the quay and comes alongside
// the end of the middle pier, the named villagers on the pier waving. 'unload': moored there, named porters carry crates
// and sacks down the gangplank and along the pier to a pile on the quay. 'leave': she sails out again, the crowd waving.
// In the harbor lot's frame (harbor in buildings.js): x along the quay, +z out over the water, the piers at x -24, 0, 24.
import * as THREE from 'three';
import { WATER_LEVEL } from '../../../sim/world.js';
import { JOBS } from '../../../sim/tiers.js';
import { FROM_IT, SHIPS_IT } from '../../../sim/stories.js';
import { Builder, boxGeo, cylGeo } from '../kit.js';
import { person, stride, castTag, ease, clamp01 } from './common.js';

const BERTH = new THREE.Vector3(0, 0, 28.0); // off the end of the middle pier (its deck ends at z 25.5, 0.73 up)
const DECK = 0.73;
const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d'];

/**
 * A cog: bow at +x, high sided, the deck 3.1 m over the water (level with the harbor's piers), one mast with a square sail.
 * Returns { g, sail, flag }.
 */
export function cog(M) {
  const b = new Builder();
  const D = 3.1; // the deck over the water
  b.add('woodDark', boxGeo(10, D + 0.8, 4.4), 0, (D - 0.8) / 2, 0); // the hull, 0.8 m under the water
  b.add('woodDark', boxGeo(3.1, D + 0.8, 3.1), 5.0, (D - 0.8) / 2, 0, Math.PI / 4); // the bow, pointed
  for (const y of [0.9, 2.0]) b.add('wood', boxGeo(12.4, 0.16, 4.5), 0.6, y, 0); // the strakes along the side
  b.add('wood', boxGeo(10.6, 0.12, 4.2), 0, D + 0.02, 0); // the deck
  for (const s of [-1, 1]) b.add('wood', boxGeo(10.2, 0.6, 0.14), 0, D + 0.3, s * 2.2); // the bulwarks
  b.add('woodDark', boxGeo(3.2, 1.8, 4.5), -4.0, D + 0.9, 0); // the stern castle
  b.add('wood', boxGeo(3.4, 0.4, 4.7), -4.0, D + 2.0, 0);
  b.add('woodDark', boxGeo(2.0, 1.2, 3.3), 5.2, D + 0.6, 0); // the forecastle
  b.add('woodDark', cylGeo(0.18, 0.22, 12, 8), 0.4, D + 6, 0); // the mast
  b.add('wood', cylGeo(0.09, 0.09, 6.8, 6).rotateX(Math.PI / 2), 0.55, D + 10.4, 0); // the yard
  b.add('woodDark', cylGeo(0.07, 0.1, 3.2, 6).rotateZ(-1.2), 7.2, D + 1.4, 0); // the bowsprit
  for (const [x, z] of [[-2.2, -0.9], [-2.2, 0.9], [5.6, 1.2]]) b.add('wood', cylGeo(0.36, 0.32, 0.8, 10), x, D + 0.42, z); // barrels on deck
  b.add('wood', boxGeo(1.0, 0.7, 1.0), -1.6, D + 0.37, -1.0); // a crate
  const g = b.build(M);
  // the sail hangs from the yard; scale.y furls it
  const sail = new THREE.Group();
  sail.position.set(0.75, D + 10.3, 0);
  const cloth = new THREE.Mesh(boxGeo(0.06, 5.6, 6.2).translate(0, -2.8, 0), M.clothIvory);
  const stripe = new THREE.Mesh(boxGeo(0.07, 1.3, 6.22).translate(0, -2.8, 0), M.clothRed);
  for (const m of [cloth, stripe]) { m.castShadow = true; sail.add(m); }
  g.add(sail);
  const flag = new THREE.Mesh(boxGeo(1.2, 0.7, 0.04).translate(-0.6, 0, 0), M.clothRed);
  flag.position.set(0.4, D + 11.8, 0);
  g.add(flag);
  return { g, sail, flag };
}

export function buildShip({ story, M, buildings, seed, lang }) {
  const item = buildings.items.harbor;
  if (!item) return null;
  const step = story.step || 'arrive';
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(item.group.matrix);
  group.visible = false;
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrix);
  const wl = WATER_LEVEL - item.base; // the water in the lot's frame
  const ship = cog(M);
  ship.g.rotation.y = Math.PI; // bow toward -x: she comes in from +x along the quay and leaves the same way, on to -x
  group.add(ship.g);
  // where she is along the quay at u (0..1 of the shot)
  const xAt = step === 'arrive' ? (u) => 34 * (1 - ease(Math.min(1, u / 0.8))) : step === 'leave' ? (u) => -30 * ease(clamp01((u - 0.15) / 0.85)) ** 1.4 : () => 0;
  const labels = [];
  const people = [];
  if (step === 'unload') {
    // the gangplank from the pier's end up to the deck, the pile growing on the pier near the quay
    const plank = new THREE.Mesh(boxGeo(1.0, 0.08, 2.4), M.wood);
    plank.position.set(1.5, (DECK + wl + 3.14) / 2, 25.7);
    plank.rotation.x = -Math.atan2(wl + 3.14 - DECK, 2.2);
    plank.castShadow = true;
    group.add(plank);
    story.cast.slice(0, 4).forEach((c, i) => {
      const P = person(M, JOBS[c.job]?.color || CROWD[i]);
      group.add(P.root);
      const load = new THREE.Mesh(i % 2 ? new THREE.SphereGeometry(0.32, 10, 8).scale(1.1, 0.8, 0.8) : boxGeo(0.6, 0.45, 0.5), i % 2 ? M.hay : M.wood);
      load.position.set(0, 1.62, 0.12);
      load.castShadow = true;
      P.body.add(load);
      labels.push({ ...castTag(c, lang), P });
      people.push({ P, load, i });
    });
    for (let k = 0; k < 6; k++) { // the pile on the pier by the quay
      const m = new THREE.Mesh(k % 3 === 2 ? new THREE.SphereGeometry(0.34, 10, 8).scale(1.1, 0.8, 0.8) : boxGeo(0.62, 0.48, 0.52), k % 3 === 2 ? M.hay : M.wood);
      m.position.set(-1.3 + (k % 3) * 0.66, DECK + 0.25 + Math.floor(k / 3) * 0.5, 13.2);
      m.castShadow = true;
      group.add(m);
    }
  } else {
    // the crowd at the end of the pier, waving
    story.cast.slice(0, 6).forEach((c, i) => {
      const P = person(M, JOBS[c.job]?.color || CROWD[i]);
      P.root.position.set(-1.5 + (i % 3) * 1.5, DECK, 24.6 - Math.floor(i / 3) * 1.5);
      P.root.rotation.y = step === 'arrive' ? 0.5 : -0.4; // toward where she comes from or goes
      group.add(P.root);
      labels.push({ ...castTag(c, lang), P });
      people.push({ P, i });
    });
  }
  // the ship's own tag: her name and her port
  const from = lang === 'it' ? FROM_IT[story.from] || '' : `from ${story.from}`;
  const shipTag = { pos: new THREE.Vector3(), title: lang === 'it' ? SHIPS_IT[story.name] || story.name : story.name, sub: from };
  labels.push(shipTag);
  const banner = step === 'unload' ? (lang === 'it' ? 'Si scarica la nave!' : 'Unloading the ship!')
    : step === 'leave' ? (lang === 'it' ? 'La nave riparte' : 'The ship sets sail') : lang === 'it' ? 'Arriva una nave!' : 'A ship comes in!';
  // the walk of a porter: down the plank, along the pier to the pile, back with empty hands
  const PLANK_TOP = new THREE.Vector3(1.5, wl + 3.14, 27.2), PLANK_FOOT = new THREE.Vector3(1.5, DECK, 24.4), PILE = new THREE.Vector3(0.6, DECK, 14.2);
  const porter = (k) => {
    const c = ((k % 1) + 1) % 1; // 0..1 round trip
    const legs = [[PLANK_TOP, PLANK_FOOT, 0.18], [PLANK_FOOT, PILE, 0.4], [PILE, PLANK_FOOT, 0.3], [PLANK_FOOT, PLANK_TOP, 0.12]];
    let acc = 0;
    for (const [k, [a, b, d]] of legs.entries()) {
      if (c <= acc + d || k === legs.length - 1) return { p: a.clone().lerp(b, clamp01((c - acc) / d)), dir: b.clone().sub(a), loaded: k < 2 };
      acc += d;
    }
  };
  // the harbor's own ships moored off the piers (life.js) are in her way: off the water for this shot
  const inv = item.group.matrix.clone().invert();
  const moored = () => (buildings.boats || []).filter((bt) => bt.mesh && bt.pos.clone().applyMatrix4(inv).z > 15 && Math.abs(bt.pos.clone().applyMatrix4(inv).x) < 45);
  let hidden = null;
  return {
    group,
    labels,
    banner,
    focus: toWorld(0, 3, 24),
    cam(u) {
      if (step === 'unload') return { pos: toWorld(6.5 - 1.5 * u, 4.4, 9.5 + 1.5 * u), look: toWorld(0, 2.6, 24.5) };
      // from the quay, off to the side the ship comes from (or goes to): the crowd at the end of the pier, the ship following
      const x = xAt(u), side = step === 'leave' ? 1 : -1;
      return { pos: toWorld(side * 12, 6.5, 8.5), look: toWorld(0.6 * x + side * -1, 4.0, 27) };
    },
    update(t, t0, t1) {
      group.visible = t >= t0 - 0.2 && t <= t1 + 0.2;
      hidden ??= moored();
      for (const bt of hidden) bt.mesh.visible = !group.visible;
      if (!group.visible) return;
      const u = clamp01((t - t0) / (t1 - t0));
      const x = xAt(u);
      ship.g.position.set(BERTH.x + x, wl + 0.06 * Math.sin(t * 1.3), BERTH.z);
      ship.g.rotation.z = 0.015 * Math.sin(t * 1.1); // rolling a little (the bow is at -x)
      // the sail: set while she moves, furled at the quay
      const set = step === 'arrive' ? 1 - ease(clamp01((u - 0.75) / 0.2)) : step === 'leave' ? ease(clamp01(u / 0.25)) : 0;
      ship.sail.scale.y = Math.max(0.12, set);
      ship.sail.rotation.z = 0.08 * set;
      ship.flag.rotation.y = 0.25 * Math.sin(t * 5);
      if (step === 'unload') {
        for (const { P, load, i } of people) {
          const { p, dir, loaded } = porter((t - t0) / 5.5 + i * 0.25);
          P.root.position.copy(p).add(new THREE.Vector3(i % 2 ? -0.35 : 0.35, 0, 0));
          P.root.rotation.y = Math.atan2(dir.x, dir.z);
          stride(P, (t - t0) * 8 + i, 0.5, { arms: false });
          load.visible = loaded;
          // both hands up holding the load on the shoulders, or swinging when empty
          if (loaded) { P.r.g.rotation.set(-2.7, 0, -0.3); P.l.g.rotation.set(-2.7, 0, 0.3); } else { P.r.g.rotation.set(0.4 * Math.sin((t - t0) * 8 + i), 0, -0.1); P.l.g.rotation.set(-0.4 * Math.sin((t - t0) * 8 + i), 0, 0.1); }
        }
      } else {
        for (const { P, i } of people) {
          const ph = t * 6 + i * 1.3;
          P.r.g.rotation.set(-2.7 + 0.3 * Math.sin(ph), 0, -0.4 + 0.3 * Math.sin(ph));
          P.l.g.rotation.set(i % 2 ? -2.5 : -0.2, 0, 0.2);
        }
      }
      for (const l of labels) if (l.P) l.pos.copy(l.P.root.position).setY(l.P.root.position.y + 2.3).applyMatrix4(group.matrix);
      shipTag.pos.copy(ship.g.position).setY(ship.g.position.y + 16.2).applyMatrix4(group.matrix);
    },
  };
}
