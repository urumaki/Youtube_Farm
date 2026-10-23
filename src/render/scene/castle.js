// The royal castle: curtain walls, four distinct corner towers, gate towers + gatehouse with the
// kingdom sign, barbican, drawbridge and stone bridge, keep with real floors, stairs and balcony, courtyard.
import * as THREE from 'three';
import { Builder, boxGeo, cylGeo, gableGeo, pyramidGeo, merlonRing, merlonLine, archGeo } from './kit.js';
import { CASTLE } from '../../sim/world.js';

const G = CASTLE.ground; // courtyard level
const H = CASTLE.half; // wall line
const WALL_H = 12, WALL_T = 3.2;
const TOP = G + WALL_H;

export function buildCastle(M) {
  const b = new Builder();
  const torches = [], banners = [], flags = [];

  // ---------------------------------------------------------------- curtain walls
  const wall = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ang = -Math.atan2(z1 - z0, x1 - x0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    b.add('stone', boxGeo(len, WALL_H + 4, WALL_T), cx, G - 4 + (WALL_H + 4) / 2, cz, ang);
    // batter (sloped plinth) and string course
    b.add('stoneDark', boxGeo(len, 2.2, WALL_T + 1.2), cx, G - 0.4, cz, ang);
    b.add('stoneDark', boxGeo(len, 0.5, WALL_T + 0.5), cx, TOP - 0.2, cz, ang);
    // outer merlons + inner parapet; the outside is the side away from the castle centre
    const nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
    const out = Math.sign(nx * cx + nz * cz) || 1;
    const ox = nx * out * (WALL_T / 2 - 0.35), oz = nz * out * (WALL_T / 2 - 0.35);
    merlonLine(b, 'stone', x0 + ox, z0 + oz, x1 + ox, z1 + oz, TOP);
    b.add('stone', boxGeo(len, 0.9, 0.5), cx - ox, TOP + 0.45, cz - oz, ang);
    // arrow slits on the outer face
    const n = Math.floor(len / 6);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      b.add('window', boxGeo(0.35, 1.8, 0.2), x0 + (x1 - x0) * t + nx * out * (WALL_T / 2 + 0.02), G + 6.5, z0 + (z1 - z0) * t + nz * out * (WALL_T / 2 + 0.02), ang);
    }
  };
  wall(-H, -H, H, -H); // north
  wall(-H, H, H, H); // south
  wall(-H, -H, -H, H); // west
  wall(H, -H, H, -10.5); // east, north of the gate
  wall(H, 10.5, H, H); // east, south of the gate

  // ---------------------------------------------------------------- corner towers (all different)
  const towers = [
    { x: -H, z: -H, h: 27, r: 6.0, roof: 'cone', roofH: 13 },
    { x: H, z: -H, h: 22, r: 5.4, roof: 'cone', roofH: 10 },
    { x: -H, z: H, h: 20, r: 5.2, roof: 'cone', roofH: 9 },
    { x: H, z: H, h: 24, r: 5.6, roof: 'cone', roofH: 11 },
  ];
  for (const t of towers) {
    const top = G + t.h;
    b.add('stoneDark', cylGeo(t.r + 0.9, t.r + 1.4, 7, 24), t.x, -1.0, t.z);
    b.add('stone', cylGeo(t.r, t.r + 0.3, t.h + 1.5, 24), t.x, G - 1.5 + (t.h + 1.5) / 2, t.z);
    b.add('stoneDark', cylGeo(t.r + 0.6, t.r, 1.0, 24), t.x, top + 0.2, t.z);
    b.add('stoneDark', cylGeo(t.r + 0.6, t.r + 0.6, 0.6, 24), t.x, top + 0.9, t.z);
    // machicolations: corbels under an oversailing parapet ring, then the roof over it
    const nc = Math.round(t.r * 4);
    for (let i = 0; i < nc; i++) {
      const a = (i / nc) * Math.PI * 2;
      b.add('stoneDark', boxGeo(0.5, 0.9, 0.7), t.x + Math.cos(a) * (t.r + 0.25), top - 0.6, t.z + Math.sin(a) * (t.r + 0.25), -a + Math.PI / 2);
    }
    b.add('stone', cylGeo(t.r + 0.7, t.r + 0.7, 2.2, 24, 4, true), t.x, top + 2.1, t.z);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      b.add('window', boxGeo(0.7, 1.0, 0.3), t.x + Math.cos(a) * (t.r + 0.72), top + 2.2, t.z + Math.sin(a) * (t.r + 0.72), -a + Math.PI / 2);
    }
    // arrow slits facing outward
    const a0 = Math.atan2(t.z, t.x);
    for (let k = -1; k <= 1; k++) {
      const a = a0 + k * 0.7;
      for (const y of [G + 5, G + 11, G + t.h - 4]) {
        b.add('window', boxGeo(0.25, 1.6, 0.4), t.x + Math.cos(a) * (t.r + 0.05), y, t.z + Math.sin(a) * (t.r + 0.05), -a + Math.PI / 2);
      }
    }
    if (t.roof === 'cone') {
      b.add('castleRoof', cylGeo(0.05, t.r + 1.5, t.roofH, 28, 2), t.x, top + 3.2 + t.roofH / 2, t.z);
      b.add('castleRoof', cylGeo(t.r + 1.5, t.r + 1.6, 0.3, 28, 2), t.x, top + 3.25, t.z); // eaves lip
      b.add('gold', new THREE.SphereGeometry(0.45, 10, 8), t.x, top + 3.3 + t.roofH, t.z);
      b.add('iron', cylGeo(0.06, 0.06, 2.5, 6), t.x, top + 4.4 + t.roofH, t.z);
      flags.push({ x: t.x, y: top + 5.4 + t.roofH, z: t.z, size: [2.6, 1.4], kind: 'pennant' });
    } else {
      b.add('stoneDark', cylGeo(t.r - 0.3, t.r - 0.3, 0.3, 24), t.x, top + 0.95, t.z); // roof deck
      b.add('woodDark', cylGeo(0.12, 0.15, 9, 8), t.x, top + 5.5, t.z);
      flags.push({ x: t.x, y: top + 9.6, z: t.z, size: [4.2, 2.6], kind: 'flag' });
    }
  }

  // ---------------------------------------------------------------- gate towers + gatehouse
  const gateTop = G + 17;
  for (const s of [-1, 1]) {
    const z = s * 8;
    b.add('stone', boxGeo(7, 21, 7), H + 1.5, G - 4 + 10.5, z);
    b.add('stoneDark', boxGeo(8.2, 2.5, 8.2), H + 1.5, G - 0.2, z);
    b.add('stoneDark', boxGeo(7.8, 0.8, 7.8), H + 1.5, gateTop + 0.4, z); // machicolation course
    for (const [x0, z0, x1, z1] of [[H - 2.4, z - 3.9, H + 5.4, z - 3.9], [H - 2.4, z + 3.9, H + 5.4, z + 3.9], [H + 5.4, z - 3.9, H + 5.4, z + 3.9], [H - 2.4, z - 3.9, H - 2.4, z + 3.9]]) {
      merlonLine(b, 'stone', x0, z0, x1, z1, gateTop + 0.8, 2.2, [1.1, 1.4, 0.6]);
    }
    b.add('castleRoof', pyramidGeo(7.4, 7.4, 6.5), H + 1.5, gateTop + 0.8, z);
    for (const y of [G + 6, G + 11.5]) b.add('window', boxGeo(0.2, 1.7, 0.35), H + 5.03, y, z);
    banners.push({ x: H + 5.15, y: G + 15.6, z, w: 2.6, h: 6.5, face: 'x' });
  }
  // gatehouse block above the passage; passage 6 m wide, 7.5 m high, left open
  const passH = 7.5;
  b.add('stone', boxGeo(7, gateTop - (G + passH), 9), H + 1.5, (G + passH + gateTop) / 2, 0);
  b.add('stoneDark', boxGeo(7.6, 0.7, 9), H + 1.5, gateTop + 0.35, 0);
  merlonLine(b, 'stone', H + 5.2, -4.3, H + 5.2, 4.3, gateTop + 0.7, 2.2, [1.1, 1.4, 0.6]);
  // passage side walls + arch voussoirs on the outer face
  for (const s of [-1, 1]) b.add('stoneDark', boxGeo(7, passH + 4, 1.5), H + 1.5, G - 4 + (passH + 4) / 2, s * 3.75);
  b.add('stoneDark', archGeo(6, 3, 7.2), H + 1.5, G + passH - 3, 0); // rounded arch over the passage
  // portcullis (raised) and open oak doors with iron straps
  for (let i = -2; i <= 2; i++) b.add('iron', boxGeo(0.12, 4.2, 0.12), H + 4.2, G + passH - 1.4, i * 1.15);
  for (const y of [G + passH - 3.2, G + passH - 1.8, G + passH + 0.4]) b.add('iron', boxGeo(0.12, 0.12, 5.6), H + 4.2, y, 0);
  for (const s of [-1, 1]) {
    b.add('woodDark', boxGeo(0.35, 6.4, 2.9), H - 0.6, G + 3.2, s * 4.1, s * 1.2);
    for (const y of [G + 1.2, G + 3.2, G + 5.2]) b.add('iron', boxGeo(0.4, 0.18, 2.7), H - 0.55, y, s * 4.15, s * 1.2);
  }
  // the kingdom name above the gate, and the arms above it
  const sign = new THREE.PlaneGeometry(13, 1.62);
  sign.rotateY(Math.PI / 2);
  b.add('woodDark', boxGeo(0.3, 2.1, 13.6), H + 5.15, G + passH + 1.7, 0);
  b.add('sign', sign, H + 5.33, G + passH + 1.7, 0);
  const arms = new THREE.PlaneGeometry(2.6, 3.1);
  arms.rotateY(Math.PI / 2);
  b.add('arms', arms, H + 5.25, G + passH + 4.8, 0);
  torches.push({ x: H + 5.5, y: G + 5.2, z: -3.9 }, { x: H + 5.5, y: G + 5.2, z: 3.9 });

  // ---------------------------------------------------------------- island path, barbican, drawbridge, bridge
  const bx = CASTLE.island - 1.0; // barbican / hinge line
  b.add('cobble', boxGeo(bx - H - 5, 0.3, 6), (H + 5 + bx) / 2, G + 0.1, 0);
  for (const s of [-1, 1]) {
    b.add('stone', cylGeo(1.9, 2.1, 9, 16), bx, G - 3 + 4.5, s * 4.4);
    merlonRing(b, 'stone', bx, G + 6, s * 4.4, 1.85, 7, [0.8, 1.0, 0.5]);
    torches.push({ x: bx + 1.4, y: G + 3.6, z: s * 2.9 });
  }
  b.add('stone', boxGeo(2.4, 1.6, 7), bx, G + 5.4, 0);
  b.add('stoneDark', archGeo(5.4, 1.2, 2.4), bx, G + 3.4, 0);
  const pier = CASTLE.moatInner + 6.5;
  b.add('stoneDark', boxGeo(2.6, 8, 6.4), pier, G - 4, 0);
  b.add('stoneDark', boxGeo(3.4, 1.2, 7.2), pier, G - 7, 0);
  // stone span from the pier to the far bank, with its own pier in the water
  const far = CASTLE.moatOuter + 4;
  b.add('stone', boxGeo(far - pier, 1.0, 6), (far + pier) / 2, G - 0.5, 0);
  b.add('stone', boxGeo(far - pier, 0.8, 0.5), (far + pier) / 2, G + 0.4, -2.9);
  b.add('stone', boxGeo(far - pier, 0.8, 0.5), (far + pier) / 2, G + 0.4, 2.9);
  b.add('stoneDark', boxGeo(1.8, 7, 5.6), (far + pier) / 2, G - 4.4, 0);
  b.add('stoneDark', boxGeo(3, 7, 7), far + 1.5, G - 3.8, 0); // abutment
  b.add('stone', boxGeo(7, 0.8, 6), far + 6.5, G - 1.5, 0, 0, 0, -0.32); // ramp down to the road

  // drawbridge: pivot at the barbican, deck spans to the pier
  const drawbridge = new THREE.Group();
  drawbridge.position.set(bx + 0.9, G - 0.1, 0);
  const deckLen = pier - 1.3 - (bx + 0.9);
  const deck = new THREE.Mesh(boxGeo(deckLen, 0.45, 5.2, 2), M.wood);
  deck.position.set(deckLen / 2, 0, 0);
  deck.castShadow = deck.receiveShadow = true;
  drawbridge.add(deck);
  for (const z of [-1.8, 0, 1.8]) {
    const strap = new THREE.Mesh(boxGeo(deckLen, 0.08, 0.25), M.iron);
    strap.position.set(deckLen / 2, 0.26, z);
    drawbridge.add(strap);
  }
  const chains = [-2.4, 2.4].map((z) => {
    const c = new THREE.Mesh(cylGeo(0.06, 0.06, 1, 6), M.iron);
    c.userData = { z };
    return c;
  });

  // ---------------------------------------------------------------- courtyard
  b.add('cobble', boxGeo(2 * H - WALL_T, 0.25, 2 * H - WALL_T, 3), 0, G + 0.02, 0);
  // stables along the north wall, barracks along the south-east
  b.add('timber', boxGeo(30, 4.5, 6, 4), -4, G + 2.25, -H + WALL_T / 2 + 3);
  b.add('roofRed', gableGeo(31, 7.2, 2.6), -4, G + 4.5, -H + WALL_T / 2 + 3);
  b.add('timber', boxGeo(16, 5, 6, 4), 14, G + 2.5, H - WALL_T / 2 - 3);
  b.add('thatch', gableGeo(17, 7.2, 3), 14, G + 5, H - WALL_T / 2 - 3);
  for (let i = 0; i < 6; i++) b.add('window', boxGeo(1, 1.2, 0.1), 8 + i * 2.3, G + 2.6, H - WALL_T / 2 - 6.05);
  // well
  b.add('stone', cylGeo(1.3, 1.4, 1.1, 16), 14, G + 0.55, -8);
  b.add('woodDark', boxGeo(0.2, 2.6, 0.2), 14, G + 1.6, -9.2);
  b.add('woodDark', boxGeo(0.2, 2.6, 0.2), 14, G + 1.6, -6.8);
  b.add('roofRed', gableGeo(1.2, 3.2, 0.9).rotateY(Math.PI / 2), 14, G + 2.9, -8);
  // the guards' training yard (owner 2026-10-23): a sanded square between the well and the barracks, inside the
  // courtyard paths, with a rail fence on two sides, two straw dummies, a rack of spears, shields and a bench
  const TY = { x: 14, z: 3.5, hw: 5, hd: 4.5 };
  b.add('dirt', boxGeo(TY.hw * 2, 0.06, TY.hd * 2, 3), TY.x, G + 0.17, TY.z);
  for (let z = TY.z - TY.hd; z <= TY.z + TY.hd + 0.01; z += 1.5) b.add('woodDark', boxGeo(0.12, 0.95, 0.12), TY.x - TY.hw, G + 0.6, z);
  for (let x = TY.x - TY.hw + 1.5; x <= TY.x + TY.hw + 0.01; x += 1.5) b.add('woodDark', boxGeo(0.12, 0.95, 0.12), x, G + 0.6, TY.z + TY.hd);
  for (const y of [0.55, 0.95]) {
    b.add('wood', boxGeo(0.07, 0.08, TY.hd * 2), TY.x - TY.hw, G + y, TY.z);
    b.add('wood', boxGeo(TY.hw * 2, 0.08, 0.07), TY.x, G + y, TY.z + TY.hd);
  }
  for (const [x, z] of [[16.8, 6.6], [18.2, 3.2]]) { // straw dummies: a post, a stuffed body, arms, a sack head
    b.add('woodDark', cylGeo(0.07, 0.08, 1.9, 6), x, G + 1.1, z);
    b.add('hay', cylGeo(0.26, 0.3, 0.75, 10), x, G + 1.45, z);
    b.add('woodDark', boxGeo(1.1, 0.09, 0.09), x, G + 1.7, z);
    b.add('clothIvory', new THREE.SphereGeometry(0.2, 10, 8), x, G + 2.05, z);
    b.add('clothRed', cylGeo(0.12, 0.12, 0.02, 12).rotateX(Math.PI / 2), x - 0.3, G + 1.5, z); // the mark to hit
  }
  // the weapon rack against the fence: spears leaning on a bar, two shields hung on the rails
  for (const x of [11.6, 13.6]) b.add('woodDark', boxGeo(0.12, 1.6, 0.12), x, G + 0.95, TY.z + TY.hd - 0.35);
  b.add('woodDark', boxGeo(2.2, 0.1, 0.1), 12.6, G + 1.65, TY.z + TY.hd - 0.35);
  for (let i = 0; i < 6; i++) {
    const x = 11.85 + i * 0.32;
    b.add('wood', cylGeo(0.025, 0.025, 2.2, 5).rotateX(0.12), x, G + 1.25, TY.z + TY.hd - 0.5);
    b.add('iron', new THREE.ConeGeometry(0.045, 0.22, 6).rotateX(0.12), x, G + 2.45, TY.z + TY.hd - 0.36);
  }
  for (const [x, key] of [[15.2, 'clothBlue'], [16.3, 'clothRed']]) b.add(key, cylGeo(0.36, 0.36, 0.05, 16).rotateX(Math.PI / 2), x, G + 0.8, TY.z + TY.hd - 0.08);
  b.add('wood', boxGeo(0.45, 0.45, 2.2), TY.x - TY.hw + 0.5, G + 0.4, TY.z - 1.5); // the bench by the fence
  // stairs from the courtyard up to the wall walk (south and north walls)
  for (const s of [-1, 1]) {
    const zc = s * (H - WALL_T / 2 - 1.0);
    const steps = 25, rise = WALL_H / steps;
    for (let i = 0; i < steps; i++) {
      const top = G + (i + 1) * rise;
      b.add('stone', boxGeo(0.55, top - G, 2), -8 - i * 0.55, G + (top - G) / 2, zc);
    }
  }

  // ---------------------------------------------------------------- keep
  const K = { x: -6, z: -2, w: 20, d: 16, h: 24 };
  const kTop = G + K.h;
  b.add('stone', boxGeo(K.w, K.h + 2, K.d), K.x, G - 2 + (K.h + 2) / 2, K.z);
  b.add('stoneDark', boxGeo(K.w + 1, 1.2, K.d + 1), K.x, G + 0.6, K.z);
  for (const y of [G + 4.5, G + 9, G + 13.5, G + 18]) b.add('stoneDark', boxGeo(K.w + 0.3, 0.35, K.d + 0.3), K.x, y, K.z); // floor string courses
  b.add('stoneDark', boxGeo(K.w + 1.4, 0.9, K.d + 1.4), K.x, kTop + 0.2, K.z);
  merlonLine(b, 'stone', K.x - K.w / 2 - 0.4, K.z - K.d / 2 - 0.4, K.x + K.w / 2 + 0.4, K.z - K.d / 2 - 0.4, kTop + 0.6, 2.2);
  merlonLine(b, 'stone', K.x - K.w / 2 - 0.4, K.z + K.d / 2 + 0.4, K.x + K.w / 2 + 0.4, K.z + K.d / 2 + 0.4, kTop + 0.6, 2.2);
  merlonLine(b, 'stone', K.x - K.w / 2 - 0.4, K.z - K.d / 2 - 0.4, K.x - K.w / 2 - 0.4, K.z + K.d / 2 + 0.4, kTop + 0.6, 2.2);
  merlonLine(b, 'stone', K.x + K.w / 2 + 0.4, K.z - K.d / 2 - 0.4, K.x + K.w / 2 + 0.4, K.z + K.d / 2 + 0.4, kTop + 0.6, 2.2);
  b.add('castleRoof', pyramidGeo(K.w - 2.4, K.d - 2.4, 9), K.x, kTop + 0.6, K.z);
  // corner turrets
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const tx = K.x + sx * (K.w / 2), tz = K.z + sz * (K.d / 2);
    b.add('stone', cylGeo(1.9, 1.6, 7, 14), tx, kTop + 2.5, tz);
    b.add('stoneDark', cylGeo(2.1, 1.9, 0.5, 14), tx, kTop + 6.1, tz);
    b.add('castleRoof', cylGeo(0.04, 2.4, 5.5, 14, 2), tx, kTop + 6.35 + 2.75, tz);
    b.add('window', boxGeo(0.25, 1.1, 0.25), tx + sx * 1.7, kTop + 3.5, tz + sz * 0.1);
  }
  // windows: arched (slot + rounded head), on three upper floors of every face
  const archWin = (x, y, z, face) => {
    const ry = face === 'x' ? Math.PI / 2 : 0;
    b.add('window', boxGeo(1.3, 2.0, 0.2), x, y, z, ry);
    b.add('window', cylGeo(0.65, 0.65, 0.2, 12).rotateX(Math.PI / 2), x, y + 1.0, z, ry);
    b.add('stoneDark', boxGeo(1.9, 0.3, 0.45), x, y - 1.1, z, ry);
  };
  for (const y of [G + 7, G + 11.5, G + 16, G + 20.5]) {
    for (const t of [-0.32, 0, 0.32]) {
      archWin(K.x + t * K.w, y, K.z - K.d / 2 - 0.05, 'z');
      archWin(K.x + t * K.w, y, K.z + K.d / 2 + 0.05, 'z');
    }
    for (const t of [-0.25, 0.25]) {
      archWin(K.x - K.w / 2 - 0.05, y, K.z + t * K.d, 'x');
      if (y > G + 8) archWin(K.x + K.w / 2 + 0.05, y, K.z + t * K.d, 'x');
    }
  }
  // entrance at first-floor level on the east face, reached by a stone stair
  const ex = K.x + K.w / 2, doorY = G + 4.5;
  b.add('woodDark', boxGeo(0.3, 3.2, 2.2), ex + 0.05, doorY + 1.6, K.z);
  b.add('iron', boxGeo(0.35, 0.15, 2.0), ex + 0.12, doorY + 1.0, K.z);
  b.add('iron', boxGeo(0.35, 0.15, 2.0), ex + 0.12, doorY + 2.3, K.z);
  b.add('stoneDark', archGeo(2.6, 0.9, 0.5), ex + 0.15, doorY + 3.0, K.z);
  b.add('stone', boxGeo(2.6, doorY - G + 0.2, 3), ex + 1.3, G + (doorY - G) / 2, K.z); // landing
  b.add('stone', boxGeo(0.3, 1.0, 3), ex + 2.5, doorY + 0.5, K.z); // landing parapet
  const steps = 10, rise = (doorY - G) / steps;
  for (let i = 0; i < steps; i++) {
    const top = doorY - (i + 1) * rise + rise;
    b.add('stone', boxGeo(2.4, top - G, 0.55), ex + 1.3, G + (top - G) / 2, K.z + 1.5 + 0.275 + i * 0.55);
  }
  torches.push({ x: ex + 0.4, y: doorY + 3.6, z: K.z - 1.8 }, { x: ex + 0.4, y: doorY + 3.6, z: K.z + 1.8 });
  // balcony on the south face, third floor, with iron railing and corbels
  const balY = G + 13.6, bz = K.z + K.d / 2;
  b.add('stoneDark', boxGeo(6, 0.4, 1.8), K.x + 2, balY, bz + 0.9);
  for (const t of [-2.4, -0.8, 0.8, 2.4]) b.add('stoneDark', boxGeo(0.5, 1.0, 1.6), K.x + 2 + t, balY - 0.7, bz + 0.8);
  b.add('iron', boxGeo(6, 0.08, 0.08), K.x + 2, balY + 1.1, bz + 1.75);
  for (let i = 0; i <= 12; i++) b.add('iron', boxGeo(0.06, 1.1, 0.06), K.x - 1 + i * 0.5, balY + 0.55, bz + 1.75);
  b.add('woodDark', boxGeo(1.6, 2.6, 0.2), K.x + 2, balY + 1.5, bz + 0.05);
  // flag on the keep
  b.add('woodDark', cylGeo(0.14, 0.18, 10, 8), K.x, kTop + 9 + 5, K.z);
  b.add('gold', new THREE.SphereGeometry(0.35, 10, 8), K.x, kTop + 19.2, K.z);
  flags.push({ x: K.x, y: kTop + 18.6, z: K.z, size: [6.2, 3.8], kind: 'flag' });
  banners.push({ x: ex + 0.25, y: G + 22.6, z: K.z - 4.5, w: 2.4, h: 6.5, face: 'x' }, { x: ex + 0.25, y: G + 22.6, z: K.z + 4.5, w: 2.4, h: 6.5, face: 'x' });

  // a slender watchtower rising from the keep, with the tallest red spire of the castle
  {
    const wx = K.x - K.w / 2 + 3, wz = K.z + K.d / 2 - 3, base = kTop - 2, wh = 14;
    b.add('stone', cylGeo(2.6, 2.8, wh, 18), wx, base + wh / 2, wz);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      b.add('stoneDark', boxGeo(0.4, 0.7, 0.5), wx + Math.cos(a) * 2.8, base + wh - 0.5, wz + Math.sin(a) * 2.8, -a + Math.PI / 2);
    }
    for (const y of [base + 5, base + 9.5]) for (const a of [0.4, 2.0, 3.6, 5.2]) b.add('window', boxGeo(0.6, 1.4, 0.3), wx + Math.cos(a) * 2.62, y, wz + Math.sin(a) * 2.62, -a + Math.PI / 2);
    b.add('castleRoof', cylGeo(0.04, 3.4, 12, 20, 2), wx, base + wh + 6, wz);
    b.add('gold', new THREE.SphereGeometry(0.4, 10, 8), wx, base + wh + 12.2, wz);
    b.add('iron', cylGeo(0.06, 0.06, 3, 6), wx, base + wh + 13.5, wz);
    flags.push({ x: wx, y: base + wh + 15, z: wz, size: [3.2, 1.8], kind: 'pennant' });
  }
  // bartizans: corbelled turrets on the outer face of the curtain walls
  for (const [x, z, a] of [[0, -H, -Math.PI / 2], [0, H, Math.PI / 2], [-H, 0, Math.PI], [-H, -14, Math.PI], [-H, 14, Math.PI]]) {
    const bx2 = x + Math.cos(a) * (WALL_T / 2 + 1.1), bz2 = z + Math.sin(a) * (WALL_T / 2 + 1.1);
    b.add('stone', cylGeo(1.5, 0.3, 2.2, 14), bx2, TOP - 2.4, bz2);
    b.add('stone', cylGeo(1.5, 1.5, 3.6, 14), bx2, TOP + 0.5, bz2);
    b.add('window', boxGeo(0.25, 1.1, 0.3), bx2 + Math.cos(a) * 1.5, TOP + 0.6, bz2 + Math.sin(a) * 1.5, -a + Math.PI / 2);
    b.add('castleRoof', cylGeo(0.03, 1.95, 3.6, 14, 2), bx2, TOP + 4.1, bz2);
  }

  const group = b.build(M);
  group.add(drawbridge);
  for (const c of chains) group.add(c);

  // guard walks: one segment per wall stretch, two lanes (never through towers or each other)
  const wy = TOP + 0.05;
  const guardWalks = [
    [[-H + 6.5, -H], [H - 6, -H]], [[-H + 6, H], [H - 6, H]], [[-H, -H + 6.5], [-H, H - 6]],
    [[H, -H + 6], [H, -12.5]], [[H, 12.5], [H, H - 6]],
  ].map(([a, c]) => ({ a: [a[0], wy, a[1]], b: [c[0], wy, c[1]] }));
  const courtyardLoop = [[8, -14], [20, -14], [20, 15], [-20, 15], [-20, 10], [8, 10]].map(([x, z]) => [x, G + 0.15, z]);

  return {
    group, torches, banners, flags, drawbridge, chains, guardWalks, courtyardLoop,
    // where a guard drills at a straw dummy in the training yard; the camera stands to the north (-z)
    training: { at: new THREE.Vector3(11.2, G + 0.2, 5.2), view: [0, -1], floor: G + 0.2 },
    gate: new THREE.Vector3(H + 5, G + 6, 0), keep: new THREE.Vector3(K.x, G + 14, K.z),
    signPos: new THREE.Vector3(H + 5.4, G + passH + 1.7, 0),
    update(t, { bridgeOpen = 1 } = {}) {
      const a = (1 - bridgeOpen) * 1.3; // radians: 0 = lowered
      drawbridge.rotation.z = a;
      const endX = drawbridge.position.x + Math.cos(a) * deckLen, endY = drawbridge.position.y + Math.sin(a) * deckLen;
      for (const c of chains) {
        const top = new THREE.Vector3(bx + 0.4, G + 6.1, c.userData.z), end = new THREE.Vector3(endX, endY + 0.3, c.userData.z * 0.95);
        c.position.copy(top).add(end).multiplyScalar(0.5);
        c.scale.set(1, top.distanceTo(end), 1);
        c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(top).normalize());
      }
    },
  };
}
