// The tavern interior: a warm room inside the tavern building with a bar, barkeepers, tables full of
// drinking villagers, a fireplace and a candle chandelier. Named villagers sit in the most visible
// seats and get name tags. Everything is in the tavern lot's local frame (x along the 13 m front,
// z across the 9 m depth, y up from the foundation) and is a pure function of t.
import * as THREE from 'three';
import { rand01 } from '../../sim/prng.js';
import { JOBS } from '../../sim/tiers.js';
import { Builder, boxGeo, cylGeo } from './kit.js';
import { rig, toolGeo } from './work.js';

const F = 0.3; // floor top above the lot level (above the neighbouring bakery's pad)
const HX = 6.3, HZ = 4.3, CEIL = 3.5; // inner half sizes and ceiling height
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const PATRON_COLORS = ['#7b3b2a', '#3f5a7a', '#5d6b35', '#8a6a3a', '#6a4a6e', '#9a8a6a', '#4a6a64', '#a0522d', '#56606e', '#7a5a4a'];

// tables (centre x, z); a bench on each long side, two seats per bench
const TABLES = [[-2.2, -1.2], [1.2, -1.0], [-1.0, 2.2], [1.8, 2.4]];
const BAR_X = 3.5;

/**
 * @param item     buildings.items.tavern (its group carries the lot transform)
 * @param patrons  [{ name, job }] named villagers drinking at the tables
 * @param keepers  [{ name, job }] named innkeepers/brewers behind the bar (up to 2)
 */
export function buildTavernInterior({ item, M, seed, patrons = [], keepers = [] }) {
  const group = new THREE.Group();
  item.group.add(group);
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(item.group.matrix);
  const mats = {
    ...M,
    daylight: new THREE.MeshBasicMaterial({ color: '#dfe8ef' }),
    candle: new THREE.MeshStandardMaterial({ color: '#efe3c4', roughness: 0.6 }),
    bottleG: new THREE.MeshStandardMaterial({ color: '#2f5a3a', roughness: 0.15, metalness: 0.1 }),
    bottleB: new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.15, metalness: 0.1 }),
  };

  // ---------------------------------------------------------------- the room
  const b = new Builder();
  b.add('woodDark', boxGeo(2 * HX, F, 2 * HZ, 2), 0, F / 2, 0); // plank floor (thick: the bakery's foundation pad pokes into the room)
  b.add('plaster', boxGeo(2 * HX, 0.15, 2 * HZ), 0, CEIL + 0.07, 0); // ceiling
  for (let x = -5; x <= 5; x += 2.5) b.add('woodDark', boxGeo(0.28, 0.3, 2 * HZ), x, CEIL - 0.15, 0); // ceiling beams
  // walls: plaster above a dark wood wainscot, timber posts
  for (const s of [-1, 1]) {
    b.add('plaster', boxGeo(2 * HX, CEIL, 0.1), 0, CEIL / 2, s * (HZ + 0.05));
    b.add('plaster', boxGeo(0.1, CEIL, 2 * HZ), s * (HX + 0.05), CEIL / 2, 0);
    b.add('wood', boxGeo(2 * HX, 1.0, 0.06), 0, F + 0.5, s * (HZ - 0.02));
    b.add('wood', boxGeo(0.06, 1.0, 2 * HZ), s * (HX - 0.02), F + 0.5, 0);
    for (let x = -HX + 0.15; x <= HX; x += 2.1) b.add('woodDark', boxGeo(0.22, CEIL, 0.12), x, CEIL / 2, s * (HZ - 0.04));
    for (let z = -HZ + 0.15; z <= HZ; z += 2.1) b.add('woodDark', boxGeo(0.12, CEIL, 0.22), s * (HX - 0.04), CEIL / 2, z);
  }
  // front wall: three windows with daylight (they match the outside windows) and the door
  for (const x of [-5, 0, 5]) {
    b.add('daylight', boxGeo(1.0, 1.3, 0.04), x, 2.2, -HZ + 0.02);
    b.add('woodDark', boxGeo(1.2, 0.1, 0.12), x, 2.2 - 0.7, -HZ + 0.05); b.add('woodDark', boxGeo(1.2, 0.1, 0.12), x, 2.2 + 0.7, -HZ + 0.05);
    b.add('woodDark', boxGeo(0.08, 1.3, 0.1), x, 2.2, -HZ + 0.05);
  }
  b.add('woodDark', boxGeo(1.5, 2.5, 0.12), 1.5, F + 1.25, -HZ + 0.06);
  // a royal banner on the back wall
  b.add('cloth', new THREE.PlaneGeometry(1.4, 2.0).rotateY(Math.PI), -0.6, 2.2, HZ - 0.08);

  // fireplace on the front face of the chimney stack (the stack stands at x -4.5, z 1.5 in the building)
  const fx = -4.5, fz = 0.9 - 0.02;
  b.add('stoneDark', boxGeo(1.6, 1.2, 0.3), fx, F + 0.6, fz - 0.15);
  b.add('iron', boxGeo(0.9, 0.75, 0.32), fx, F + 0.47, fz - 0.14); // dark firebox
  b.add('woodDark', boxGeo(1.9, 0.14, 0.45), fx, F + 1.25, fz - 0.2); // mantel
  for (let i = 0; i < 3; i++) b.add('wood', cylGeo(0.07, 0.07, 0.6, 6).rotateZ(Math.PI / 2), fx + (i - 1) * 0.05, F + 0.18 + i * 0.07, fz - 0.25 - i * 0.04);
  b.add('ember', boxGeo(0.6, 0.06, 0.25), fx, F + 0.14, fz - 0.25);
  for (const x of [-0.5, 0.5]) b.add('iron', cylGeo(0.06, 0.07, 0.22, 8), fx + x, F + 1.43, fz - 0.2); // pots on the mantel

  // the bar: a long counter across the room, shelves and barrels behind it
  b.add('woodDark', boxGeo(0.7, 1.05, 6.2), BAR_X, F + 0.52, 0);
  b.add('wood', boxGeo(0.9, 0.08, 6.4), BAR_X - 0.05, F + 1.09, 0);
  for (const z of [-0.5, 2.6]) { // tap barrels on the counter, clear of the barkeepers seen from the door
    b.add('wood', cylGeo(0.3, 0.3, 0.6, 12).rotateZ(Math.PI / 2), BAR_X + 0.1, F + 1.43, z);
    b.add('iron', cylGeo(0.035, 0.035, 0.2, 6).rotateZ(Math.PI / 2), BAR_X + 0.47, F + 1.37, z);
  }
  for (const y of [1.45, 2.15]) {
    b.add('woodDark', boxGeo(0.35, 0.06, 4.2), HX - 0.2, y, 0);
    for (let i = 0; i < 9; i++) {
      const z = -1.8 + i * 0.45, k = i % 3;
      if (k === 0) b.add('bottleG', cylGeo(0.06, 0.07, 0.3, 8), HX - 0.22, y + 0.18, z);
      else if (k === 1) b.add('bottleB', cylGeo(0.05, 0.07, 0.26, 8), HX - 0.22, y + 0.16, z);
      else b.add('wood', cylGeo(0.08, 0.075, 0.18, 10), HX - 0.22, y + 0.12, z);
    }
  }
  for (const [z0, dir] of [[-3.6, 1], [3.6, -1]]) { // stacked barrels in the corners behind the bar
    for (let i = 0; i < 3; i++) b.add('wood', cylGeo(0.36, 0.36, 0.85, 12).rotateX(Math.PI / 2), HX - 0.5 - i * 0.75, F + 0.36, z0);
    for (let i = 0; i < 2; i++) b.add('wood', cylGeo(0.36, 0.36, 0.85, 12).rotateX(Math.PI / 2), HX - 0.87 - i * 0.75, F + 1.0, z0);
    b.add('woodDark', boxGeo(2.4, 0.06, 0.9), HX - 1.25, F + 0.02, z0 + dir * 0.05);
  }

  // tables, benches, candles
  const candles = [];
  for (const [tx, tz] of TABLES) {
    b.add('wood', boxGeo(1.9, 0.09, 0.95), tx, F + 0.78, tz);
    for (const s of [-1, 1]) {
      b.add('woodDark', boxGeo(0.1, 0.74, 0.7), tx + s * 0.75, F + 0.37, tz);
      b.add('wood', boxGeo(1.8, 0.07, 0.32), tx, F + 0.43, tz + s * 0.78);
      for (const k of [-1, 1]) b.add('woodDark', boxGeo(0.08, 0.4, 0.26), tx + k * 0.75, F + 0.2, tz + s * 0.78);
    }
    b.add('candle', cylGeo(0.035, 0.04, 0.16, 8), tx + 0.25, F + 0.9, tz + 0.1);
    candles.push(new THREE.Vector3(tx + 0.25, F + 1.02, tz + 0.1));
    b.add('iron', cylGeo(0.12, 0.14, 0.03, 10), tx + 0.25, F + 0.83, tz + 0.1);
    b.add('wood', boxGeo(0.4, 0.05, 0.28), tx - 0.4, F + 0.84, tz); // a board of bread and cheese
    b.add('hay', new THREE.SphereGeometry(0.11, 8, 6).scale(1.4, 0.7, 1), tx - 0.45, F + 0.9, tz);
  }
  // chandelier: an iron ring of candles hanging from the middle beam
  const CH = new THREE.Vector3(-0.5, CEIL - 0.85, 0.5);
  b.add('iron', new THREE.TorusGeometry(0.6, 0.03, 6, 24).rotateX(Math.PI / 2), CH.x, CH.y, CH.z);
  for (let i = 0; i < 4; i++) b.add('iron', cylGeo(0.012, 0.012, 0.85, 4).rotateZ(0.6 * Math.cos(i * Math.PI / 2)).rotateX(0.6 * Math.sin(i * Math.PI / 2)), CH.x + 0.3 * Math.cos(i * Math.PI / 2), CH.y + 0.4, CH.z + 0.3 * Math.sin(i * Math.PI / 2));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, x = CH.x + Math.cos(a) * 0.6, z = CH.z + Math.sin(a) * 0.6;
    b.add('candle', cylGeo(0.03, 0.035, 0.14, 8), x, CH.y + 0.09, z);
    candles.push(new THREE.Vector3(x, CH.y + 0.2, z));
  }
  const room = b.build(mats);
  group.add(room);

  // flames: candles and the hearth flicker by scaling small cones
  const flames = [];
  const flameGeo = new THREE.ConeGeometry(0.03, 0.09, 6).translate(0, 0.045, 0);
  candles.forEach((p, i) => {
    const m = new THREE.Mesh(flameGeo, M.flame);
    m.position.copy(p);
    group.add(m);
    flames.push({ m, k: i, base: 1 });
  });
  const hearthGeo = new THREE.ConeGeometry(0.16, 0.5, 7).translate(0, 0.25, 0);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(hearthGeo, M.flame);
    m.position.set(fx + (i - 1) * 0.22, F + 0.16, fz - 0.26);
    group.add(m);
    flames.push({ m, k: 100 + i, base: 1.4 - Math.abs(i - 1) * 0.4 });
  }

  // warm light sources, switched on only while the camera is inside (see update)
  const lights = [
    { l: new THREE.PointLight('#ff9a48', 0, 9, 1.6), p: [fx, F + 0.8, fz - 0.8], i: 11 },
    { l: new THREE.PointLight('#ffc27a', 0, 11, 1.6), p: [CH.x, CH.y - 0.1, CH.z], i: 16 },
    { l: new THREE.PointLight('#ffb866', 0, 8, 1.6), p: [BAR_X + 0.2, CEIL - 0.6, -0.2], i: 12 },
  ];
  for (const { l, p } of lights) { l.position.set(...p); l.visible = false; group.add(l); }

  // ---------------------------------------------------------------- people
  const labels = [];
  const people = [];
  // seats: far benches (facing the camera) first, then the near ones
  const seats = [];
  for (const side of [1, -1]) for (const [tx, tz] of TABLES) for (const dx of [-0.45, 0.45]) seats.push({ x: tx + dx, z: tz + side * 0.78, face: side > 0 ? Math.PI : 0 });
  const nAnon = 11 - Math.min(patrons.length, 11);
  const sitters = [...patrons.slice(0, 11).map((p) => ({ ...p, named: true }))];
  for (let i = 0; i < nAnon; i++) sitters.push({ name: null, job: null });
  // spread the anonymous drinkers over the free seats, deterministically
  const free = seats.map((s, i) => i).slice(patrons.length);
  const order = free.map((i) => ({ i, r: rand01(seed, 'tavern-seat', i) })).sort((a, c) => a.r - c.r).map((o) => o.i);
  sitters.forEach((p, n) => {
    const s = seats[p.named ? n : order[n - patrons.length]];
    if (!s) return;
    const color = p.job ? JOBS[p.job]?.color || '#7a6a55' : PATRON_COLORS[Math.floor(rand01(seed, 'tavern-color', n) * PATRON_COLORS.length)];
    const P = rig(M, color, { seated: true });
    P.root.position.set(s.x, F, s.z);
    P.root.rotation.y = s.face;
    P.r.hand.add(toolGeo('tankard', M));
    group.add(P.root);
    people.push({ P, kind: 'drinker', period: 4.2 + rand01(seed, 'tavern-period', n) * 2.6, offset: rand01(seed, 'tavern-off', n) * 6, talk: rand01(seed, 'tavern-talk', n) });
    if (p.named) labels.push({ pos: toWorld(s.x, F + 2.0, s.z), title: p.name, sub: JOBS[p.job]?.label || p.job });
  });
  // barkeepers behind the counter, facing the room: one pours from the tap, one wipes the counter
  const barSpots = [{ z: -1.5, kind: 'pour' }, { z: 1.3, kind: 'wipe' }];
  barSpots.forEach((spot, i) => {
    const k = keepers[i];
    const P = rig(M, k ? JOBS[k.job]?.color || '#a0522d' : '#a0522d');
    P.root.position.set(BAR_X + 0.75, F, spot.z);
    P.root.rotation.y = -Math.PI / 2;
    if (spot.kind === 'pour') P.r.hand.add(toolGeo('tankard', M));
    else P.r.hand.add(new THREE.Mesh(boxGeo(0.22, 0.04, 0.16), M.clothIvory)); // the rag
    // apron
    const apron = new THREE.Mesh(boxGeo(0.42, 0.6, 0.04), M.clothIvory);
    apron.position.set(0, 0.35, 0.27);
    P.body.add(apron);
    group.add(P.root);
    people.push({ P, kind: spot.kind });
    if (k) labels.push({ pos: toWorld(BAR_X + 0.75, F + 2.45, spot.z), title: k.name, sub: JOBS[k.job]?.label || k.job });
  });

  // ---------------------------------------------------------------- camera
  // along the front wall from the door corner: first the bar and the barkeepers, then a slow turn
  // over the tables toward the fireplace
  const camFrom = toWorld(-5.5, 2.45, -3.55), camTo = toWorld(0.6, 2.25, -3.6);
  const lookFrom = toWorld(BAR_X + 0.6, 1.35, -0.4), lookTo = toWorld(-3.4, 1.05, 1.0);
  const cam = (u) => {
    const k = ease(u);
    return { pos: camFrom.clone().lerp(camTo, k), look: lookFrom.clone().lerp(lookTo, ease(Math.max(0, (u - 0.25) / 0.75))) };
  };

  return {
    group,
    labels,
    cam,
    focus: toWorld(0, 1.2, 0),
    update(t, inside) {
      for (const { l, i } of lights) {
        l.visible = inside; // a light count change recompiles shaders once, only on the cut in and out
        l.intensity = inside ? i * (0.85 + 0.1 * Math.sin(t * 9.1) + 0.05 * Math.sin(t * 23.7)) : 0;
      }
      for (const f of flames) {
        const s = f.base * (0.85 + 0.12 * Math.sin(t * 11 + f.k * 1.7) + 0.06 * Math.sin(t * 27 + f.k));
        f.m.scale.set(f.base * (0.9 + 0.1 * Math.sin(t * 7 + f.k)), s, f.base);
      }
      for (const p of people) {
        const { P } = p;
        if (p.kind === 'drinker') {
          // most of the time the tankard rests on the table; every few seconds a long swig
          const c = (t + p.offset) / p.period, u = c - Math.floor(c);
          const lift = u < 0.12 ? ease(u / 0.12) : u < 0.3 ? 1 : u < 0.4 ? 1 - ease((u - 0.3) / 0.1) : 0;
          P.r.g.rotation.set(THREE.MathUtils.lerp(-0.95, -2.05, lift), 0, 0);
          P.body.rotation.x = -0.16 * lift + 0.06 * (1 - lift);
          // the talkers gesture with the free hand and turn to their neighbours
          const talk = p.talk > 0.45 ? 1 : 0.3;
          P.l.g.rotation.set(-0.6 - talk * 0.35 * Math.max(0, Math.sin(t * 2.3 + p.offset * 3)), 0, 0.05);
          P.body.rotation.y = talk * 0.18 * Math.sin(t * 0.9 + p.offset);
          P.body.rotation.z = 0.03 * Math.sin(t * 1.7 + p.offset);
        } else if (p.kind === 'pour') {
          P.r.g.rotation.set(-1.35 + 0.05 * Math.sin(t * 2), 0, 0);
          P.l.g.rotation.set(-1.0, 0, 0.15);
          P.body.rotation.x = 0.08;
        } else {
          P.r.g.rotation.set(-1.15, 0, -0.1 + 0.35 * Math.sin(t * 3.6));
          P.l.g.rotation.set(-0.5, 0, 0.1);
          P.body.rotation.x = 0.16;
          P.root.position.z = 1.3 + 0.12 * Math.sin(t * 1.8);
        }
      }
    },
  };
}
