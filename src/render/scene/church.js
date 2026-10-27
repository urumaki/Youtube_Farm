// Inside the Chapel or the Cathedral (owner 2026-10-23): pews in rows with villagers praying on them, the priest (or the
// bishop, with mitre and crozier) blessing them from the altar, candles and stained glass. A way to show many names at
// once: named villagers sit in the front pews with name tags. Everything is in the church's own frame (x across the
// nave, z along it with the altar at -z, y up from the floor), which is the church's lot frame (since 2026-10-27 the
// Cathedral's west front and door face +z too, like the Chapel's). A pure function of t.
import * as THREE from 'three';
import { rand01 } from '../../sim/prng.js';
import { JOBS } from '../../sim/tiers.js';
import { Builder, boxGeo, cylGeo } from './kit.js';
import { rig } from './work.js';

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const COLORS = ['#7b3b2a', '#3f5a7a', '#5d6b35', '#8a6a3a', '#6a4a6e', '#9a8a6a', '#4a6a64', '#a0522d', '#56606e', '#7a5a4a'];
const GLASS = ['#2f5fb8', '#b8283a', '#e0b23a', '#2f8a4a', '#7a3fa8'];

// the two churches: half width of the nave (hx) and to the outer walls (ax, the cathedral's aisles), the altar and door
// walls (z0, z1), the height of the nave (h) and of the aisles (ah), the pews (rows from z, spacing dz, seats from x0
// every 0.8 m), where the clerics stand, the camera's move
const KINDS = {
  chapel: {
    hx: 4.85, ax: 4.85, z0: -10.85, z1: 6.85, h: 6.8, rows: 6, pz: -6.4, dz: 1.25, px: [0.75, 3.95], seats: 4,
    altarZ: -9.4, cam: { from: [4.4, 2.9, 4.2], to: [4.45, 3.3, -9.7], lookFrom: [0, 1.9, -9.6], lookTo: [-0.9, 0.8, -2.4] },
  },
  cathedral: {
    hx: 6.9, ax: 12.9, z0: -23.9, z1: 15.9, h: 17.8, ah: 9.8, rows: 8, pz: -16.5, dz: 1.3, px: [0.9, 5.7], seats: 6,
    altarZ: -21.4, cam: { from: [5.0, 7.5, 6.0], to: [6.2, 3.6, -20.5], lookFrom: [0, 3.2, -21.6], lookTo: [-1.0, 0.8, -12.5] },
  },
};

/** Stained glass: a grid of coloured panes in a lead frame on a wall facing `nx` (x walls) or along z (end walls). */
function glassWindow(b, cx, cy, cz, w, h, alongX, seed, k) {
  const cols = Math.max(2, Math.round(w / 0.32)), rows = Math.max(3, Math.round(h / 0.32));
  const cw = w / cols, ch = h / rows;
  b.add('iron', alongX ? boxGeo(w + 0.12, h + 0.12, 0.04) : boxGeo(0.04, h + 0.12, w + 0.12), cx, cy, cz);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const key = 'glass' + Math.floor(rand01(seed, 'pane', k, i, j) * GLASS.length);
    const u = -w / 2 + (i + 0.5) * cw, v = -h / 2 + (j + 0.5) * ch;
    if (alongX) b.add(key, boxGeo(cw * 0.86, ch * 0.86, 0.03), cx + u, cy + v, cz + (cz > 0 ? -0.03 : 0.03));
    else b.add(key, boxGeo(0.03, ch * 0.86, cw * 0.86), cx + (cx > 0 ? -0.03 : 0.03), cy + v, cz + u);
  }
}

/**
 * @param item         buildings.items.chapel or .cathedral (its group carries the lot transform)
 * @param clergy       [{ name, job }] named priests and bishops: the first at the altar, the second at the lectern
 * @param worshippers  [{ name, job }] named villagers in the front pews (name tags)
 */
export function buildChurchInterior({ item, kind, M, seed, clergy = [], worshippers = [] }) {
  const K = KINDS[kind];
  const group = new THREE.Group();
  item.group.add(group);
  const frame = item.group.matrix.clone();
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(frame);
  const mats = { ...M, candle: new THREE.MeshStandardMaterial({ color: '#efe3c4', roughness: 0.6 }) };
  GLASS.forEach((c, i) => { mats['glass' + i] = new THREE.MeshBasicMaterial({ color: c }); });
  const { hx, ax, z0, z1, h } = K, len = z1 - z0, zc = (z0 + z1) / 2;

  // ---------------------------------------------------------------- the church
  const b = new Builder();
  b.add('stone', boxGeo(2 * ax, 0.2, len, 2), 0, -0.1, zc); // stone floor
  b.add('clothRed', boxGeo(1.2, 0.02, len - 3), 0, 0.01, zc + 1.5); // a red carpet up the aisle
  b.add('stone', boxGeo(2 * ax + 0.4, h, 0.3), 0, h / 2, z0 - 0.15); // altar wall
  b.add('stone', boxGeo(2 * ax + 0.4, h, 0.3), 0, h / 2, z1 + 0.15); // door wall
  b.add('woodDark', boxGeo(2.0, 3.2, 0.12), 0, 1.6, z1 - 0.02); // the door, shut
  for (const s of [-1, 1]) {
    if (kind === 'chapel') {
      b.add('plaster', boxGeo(0.3, h, len), s * (hx + 0.15), h / 2, zc);
      for (const z of [-6, -1, 4]) glassWindow(b, s * hx, 3.8, z, 1.1, 2.8, false, seed, `c${s}${z}`);
      for (let z = z0 + 1.5; z < z1; z += 3) b.add('woodDark', boxGeo(0.25, h, 0.3), s * (hx - 0.1), h / 2, z); // timber posts
    } else {
      // the aisles behind a row of columns, their low ceiling, the outer walls with windows
      const { ah } = K;
      b.add('stone', boxGeo(0.3, ah, len), s * (ax + 0.15), ah / 2, zc);
      b.add('stone', boxGeo(ax - hx, 0.3, len), s * (hx + ax) / 2, ah + 0.15, zc);
      b.add('stone', boxGeo(0.6, h - ah, len), s * hx, (h + ah) / 2, zc); // the clerestory wall over the arcade
      for (let z = -19.5; z <= 12; z += 5) {
        b.add('stone', cylGeo(0.5, 0.58, ah - 2.5, 12), s * hx, (ah - 2.5) / 2, z);
        b.add('stoneDark', boxGeo(1.3, 0.4, 1.3), s * hx, ah - 2.3, z); // capital
        if (z + 5 <= 13) b.add('stone', new THREE.TorusGeometry(2.5, 0.3, 6, 16, Math.PI).rotateY(Math.PI / 2), s * hx, ah - 2.5, z + 2.5); // arcade arch
        // a rib across the nave vault, from one column line to the other
        b.add('stoneDark', new THREE.TorusGeometry(hx, 0.22, 6, 24, Math.PI), 0, h - hx, z);
        b.add('stone', boxGeo(0.7, h - ah, 0.7), s * (hx - 0.1), (h + ah) / 2, z); // shaft up the clerestory
      }
      for (let z = -17; z <= 10; z += 5) {
        glassWindow(b, s * (hx - 0.3), 13.2, z, 1.7, 5.2, false, seed, `n${s}${z}`); // clerestory
        glassWindow(b, s * ax, 4.6, z, 1.5, 3.4, false, seed, `a${s}${z}`); // aisle
      }
    }
  }
  b.add(kind === 'chapel' ? 'plaster' : 'stone', boxGeo(2 * ax, 0.3, len), 0, h + 0.15, zc); // ceiling
  if (kind === 'chapel') for (let z = z0 + 1.5; z < z1; z += 3) b.add('woodDark', boxGeo(2 * hx, 0.3, 0.3), 0, h - 0.15, z); // beams
  // the end windows: lancets over the altar, the rose over the door
  const big = kind === 'cathedral';
  for (const x of big ? [-2.4, 0, 2.4] : [-1.1, 1.1]) glassWindow(b, x, big ? 10 : 4.5, z0 + 0.02, big ? 1.6 : 0.9, big ? 7 : 2.6, true, seed, `l${x}`);
  if (big) for (let r = 0; r < 3; r++) for (let i = 0; i < 6 + r * 6; i++) {
    const a = (i / (6 + r * 6)) * Math.PI * 2, rr = 0.6 + r * 0.9;
    b.add('glass' + ((i + r) % GLASS.length), boxGeo(0.62, 0.62, 0.03), Math.cos(a) * rr, 12.5 + Math.sin(a) * rr, z1 - 0.04);
  }
  // the sanctuary: steps up to the altar, the altar with its cloths, a cross on the wall, candles, the lectern
  const stepH = big ? 0.22 : 0.18;
  for (let i = 0; i < (big ? 3 : 2); i++) b.add('stone', boxGeo(2 * hx, stepH, (big ? 4.6 : 2.9) - i * 0.6), 0, stepH * (i + 0.5), z0 + ((big ? 4.6 : 2.9) - i * 0.6) / 2);
  const floor = stepH * (big ? 3 : 2), aw = big ? 3.2 : 2.0;
  b.add('stone', boxGeo(aw, 1.0, 0.9), 0, floor + 0.5, K.altarZ);
  b.add('clothIvory', boxGeo(aw + 0.15, 0.05, 1.0), 0, floor + 1.02, K.altarZ);
  b.add('clothRed', boxGeo(aw * 0.5, 0.75, 0.02), 0, floor + 0.62, K.altarZ + 0.47);
  b.add('gold', boxGeo(0.18, big ? 3.2 : 1.7, 0.12), 0, big ? 5.5 : 3.7, z0 + 0.1);
  b.add('gold', boxGeo(big ? 1.8 : 0.95, 0.18, 0.12), 0, big ? 6.2 : 4.0, z0 + 0.1);
  const candles = [];
  for (const x of [-aw * 0.4, aw * 0.4]) {
    b.add('gold', cylGeo(0.05, 0.09, 0.35, 8), x, floor + 1.2, K.altarZ - 0.1);
    b.add('candle', cylGeo(0.035, 0.035, 0.3, 8), x, floor + 1.52, K.altarZ - 0.1);
    candles.push([x, floor + 1.7, K.altarZ - 0.1]);
  }
  for (const x of [-(aw / 2 + 0.9), aw / 2 + 0.9]) { // tall candlesticks on the floor
    b.add('gold', cylGeo(0.04, 0.16, 1.5, 8), x, floor + 0.75, K.altarZ + 0.3);
    b.add('candle', cylGeo(0.05, 0.05, 0.4, 8), x, floor + 1.7, K.altarZ + 0.3);
    candles.push([x, floor + 1.95, K.altarZ + 0.3]);
  }
  const lectern = [hx * 0.55, floor, K.altarZ + (big ? 2.6 : 1.55)];
  b.add('woodDark', cylGeo(0.08, 0.12, 1.05, 8), lectern[0], floor + 0.52, lectern[2]);
  b.add('woodDark', boxGeo(0.6, 0.06, 0.45).rotateX(0.35), lectern[0], floor + 1.1, lectern[2] - 0.05);
  b.add('clothIvory', boxGeo(0.5, 0.03, 0.36).rotateX(0.35), lectern[0], floor + 1.14, lectern[2] - 0.05);
  // the pews: a seat, a back and a kneeler, both sides of the aisle
  const seats = [];
  for (let r = 0; r < K.rows; r++) {
    const z = K.pz + r * K.dz;
    for (const s of [-1, 1]) {
      const [a0, a1] = K.px, cx = s * (a0 + a1) / 2, w = a1 - a0;
      b.add('wood', boxGeo(w, 0.07, 0.42), cx, 0.44, z);
      b.add('woodDark', boxGeo(w, 0.55, 0.06), cx, 0.72, z + 0.24);
      for (const e of [a0, a1]) b.add('woodDark', boxGeo(0.07, 0.95, 0.6), s * e, 0.47, z + 0.03);
      b.add('woodDark', boxGeo(w, 0.1, 0.16), cx, 0.12, z - 0.62);
      for (let i = 0; i < K.seats; i++) seats.push({ x: s * (a0 + 0.4 + i * 0.8), z, row: r, side: s, i });
    }
  }
  const room = b.build(mats);
  group.add(room);

  // flames
  const flames = [];
  const flameGeo = new THREE.ConeGeometry(0.035, 0.11, 6).translate(0, 0.055, 0);
  candles.forEach((p, i) => {
    const m = new THREE.Mesh(flameGeo, M.flame);
    m.position.set(...p);
    group.add(m);
    flames.push({ m, k: i });
  });
  // light: the altar candles and the daylight through the glass, switched on only while the camera is inside
  const lights = [
    { l: new THREE.PointLight('#ffc27a', 0, big ? 22 : 12, 1.6), p: [0, floor + 2.4, K.altarZ + 1.2], i: big ? 26 : 13 },
    { l: new THREE.PointLight('#ffeacc', 0, big ? 30 : 14, 1.6), p: [0, h * 0.62, K.pz + K.rows * K.dz * 0.3], i: big ? 34 : 14 },
    { l: new THREE.PointLight('#dfe6ff', 0, big ? 30 : 14, 1.6), p: [0, h * 0.62, K.pz + K.rows * K.dz + 2], i: big ? 26 : 10 },
  ];
  for (const { l, p } of lights) { l.position.set(...p); l.visible = false; group.add(l); }

  // ---------------------------------------------------------------- people
  const labels = [];
  const people = [];
  // the named in the front rows, on the side the camera looks at, then the rest at random in about half the free seats
  const order = [...seats].sort((a, c) => a.row - c.row || a.side - c.side || (a.side < 0 ? c.i - a.i : a.i - c.i));
  const named = worshippers.slice(0, seats.length);
  const used = new Set(order.slice(0, named.length));
  const rest = seats.filter((s) => !used.has(s) && rand01(seed, 'pew', s.row, s.side, s.i) < 0.55);
  const sitters = [...named.map((p, i) => ({ s: order[i], p })), ...rest.map((s) => ({ s, p: null }))];
  sitters.forEach(({ s, p }, n) => {
    const color = p ? JOBS[p.job]?.color || '#7a6a55' : COLORS[Math.floor(rand01(seed, 'pew-color', n) * COLORS.length)];
    const P = rig(M, color, { seated: true });
    P.root.position.set(s.x, 0, s.z);
    P.root.rotation.y = Math.PI; // facing the altar
    group.add(P.root);
    people.push({ P, kind: 'pray', off: rand01(seed, 'pray', n) * 6, look: rand01(seed, 'look', n) });
    if (p) labels.push({ pos: toWorld(s.x, 1.95, s.z), title: p.name, sub: JOBS[p.job]?.label || p.job });
  });
  // the clerics: a bishop (always in the cathedral) or else the priest blesses from behind the altar, another named
  // cleric reads at the lectern; a bishop wears a mitre and holds a crozier
  const lead = clergy.find((c) => c.job === 'bishop') || (big ? { name: null, job: 'bishop' } : clergy[0] || { name: null, job: 'priest' });
  const second = clergy.find((c) => c !== lead);
  const spots = [
    { p: lead, x: 0, z: K.altarZ - 0.85, yaw: 0, kind: 'bless' },
    ...(second ? [{ p: second, x: lectern[0] + 0.15, z: lectern[2] - 0.65, yaw: -0.25, kind: 'read' }] : []),
  ];
  for (const sp of spots) {
    const P = rig(M, JOBS[sp.p.job]?.color || '#e8e2d0');
    P.root.position.set(sp.x, floor, sp.z);
    P.root.rotation.y = sp.yaw;
    const stole = new THREE.Mesh(boxGeo(0.16, 0.85, 0.04), M.clothRed);
    stole.position.set(0, 0.42, 0.29);
    P.body.add(stole);
    if (sp.p.job === 'bishop') {
      const mitre = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.62, 4).scale(1, 1, 0.7).translate(0, 1.47, 0), M.clothIvory);
      const band = new THREE.Mesh(cylGeo(0.215, 0.225, 0.07, 12), M.gold);
      band.position.y = 1.2;
      P.body.add(mitre, band);
      const crozier = new THREE.Group();
      crozier.add(new THREE.Mesh(cylGeo(0.025, 0.025, 1.9, 6).translate(0, 0.35, 0), M.gold));
      crozier.add(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 5, 12, Math.PI * 1.4).translate(0.13, 1.3, 0), M.gold));
      P.l.hand.add(crozier);
      sp.crozier = crozier;
    }
    group.add(P.root);
    people.push({ P, kind: sp.kind, crozier: sp.crozier });
    if (sp.p.name) labels.push({ pos: toWorld(sp.x, floor + (sp.p.job === 'bishop' ? 2.45 : 2.2), sp.z), title: sp.p.name, sub: JOBS[sp.p.job]?.label || sp.p.job });
  }

  // ---------------------------------------------------------------- camera
  // down the side aisle from behind the pews toward the altar, the view turning from the altar to the faces in the pews
  const c = K.cam;
  const camFrom = toWorld(...c.from), camTo = toWorld(...c.to), lookFrom = toWorld(...c.lookFrom), lookTo = toWorld(...c.lookTo);
  const cam = (u) => ({ pos: camFrom.clone().lerp(camTo, ease(u)), look: lookFrom.clone().lerp(lookTo, ease(Math.max(0, (u - 0.3) / 0.7))) });

  const lerp = THREE.MathUtils.lerp;
  return {
    group,
    labels,
    cam,
    focus: toWorld(0, 1.2, K.pz),
    update(t, inside) {
      // the outside of the building (the cathedral's transept and aisles are solid boxes across the nave) is hidden
      // while the camera is in; the interior is a closed room of its own
      item.body.visible = !inside;
      for (const { l, i } of lights) {
        l.visible = inside; // a light count change recompiles shaders once, only on the cut in and out
        l.intensity = inside ? i * (0.94 + 0.04 * Math.sin(t * 7.3)) : 0;
      }
      for (const f of flames) f.m.scale.set(0.9 + 0.1 * Math.sin(t * 7 + f.k), 0.85 + 0.15 * Math.sin(t * 11 + f.k * 1.7), 1);
      for (const p of people) {
        const { P } = p;
        if (p.kind === 'pray') {
          // hands together in front of the chest, the head bowed; now and then one looks up to the altar
          const up = p.look > 0.8 ? Math.max(0, Math.sin(t * 0.6 + p.off)) : 0;
          P.r.g.rotation.set(-1.05, 0, -0.42);
          P.l.g.rotation.set(-1.05, 0, 0.42);
          P.body.rotation.set(lerp(0.14, -0.05, up) + 0.015 * Math.sin(t * 1.3 + p.off), 0, 0.02 * Math.sin(t * 0.7 + p.off));
        } else if (p.kind === 'bless') {
          // arms raised over the altar, slowly lowered and raised again
          const a = -2.0 + 0.35 * Math.sin(t * 0.9);
          P.r.g.rotation.set(a, 0, 0.45);
          P.l.g.rotation.set(a, 0, -0.45);
          if (p.crozier) { P.l.g.rotation.set(-0.55, 0, -0.12); p.crozier.rotation.x = 0.55; } // the bishop blesses with one hand
          P.body.rotation.set(-0.04, 0, 0);
        } else {
          // reading at the lectern, turning a page now and then
          const c2 = (t / 3.4) % 1, turn = c2 > 0.8 ? Math.sin(((c2 - 0.8) / 0.2) * Math.PI) : 0;
          P.r.g.rotation.set(-0.95 - 0.5 * turn, 0, -0.15 - 0.3 * turn);
          P.l.g.rotation.set(-0.95, 0, 0.15);
          P.body.rotation.set(0.15, 0, 0);
        }
      }
    },
  };
}
