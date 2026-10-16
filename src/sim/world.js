// The fixed geography of the kingdom: terrain, river, moat, roads, reserved lots and house plots.
// Everything is a pure function of the seed, shared by the simulation, the renderer and the tests.
import { hash, rand01, rng } from './prng.js';
import {
  obbOverlap, obbAabb, grow, segmentObb, distToSegment, pointInObb, SpatialHash, smoothstep, lerp, obbCorners,
} from './geometry.js';

export const WATER_LEVEL = 0.4;
export const CASTLE = { half: 26, island: 46, moatInner: 47, moatOuter: 58, ground: 4.5 };
export const GATE = { x: CASTLE.half, z: 0 };
export const ROAD_WIDTH = { main: 8, street: 6, track: 4 };
export const RIVER_HALF_WIDTH = 13;
const PLOT_SETBACK = 1.6;
const MAX_PLOTS = 9000;

// ---------------------------------------------------------------- noise
function lattice(seed, i, j) {
  return rand01(seed, 'n', i, j) * 2 - 1;
}
function valueNoise(seed, x, z) {
  const i = Math.floor(x), j = Math.floor(z);
  const fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = lattice(seed, i, j), b = lattice(seed, i + 1, j);
  const c = lattice(seed, i, j + 1), d = lattice(seed, i + 1, j + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(seed, x, z, oct = 4) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * valueNoise(seed + o * 7919, x * f, z * f);
    norm += amp; amp *= 0.5; f *= 2.03;
  }
  return sum / norm;
}

// ---------------------------------------------------------------- world construction (memoized per seed)
const cache = new Map();
export function world(seed) {
  if (!cache.has(seed)) cache.set(seed, buildWorld(seed));
  return cache.get(seed);
}

function catmull(points, step) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Segment index for fast "distance to polyline" queries. */
function polyIndex(pts, cell = 50) {
  const grid = new SpatialHash(cell);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    grid.insert([Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)], i);
  }
  return {
    dist(x, z, maxR = 120) {
      let best = Infinity;
      for (const i of grid.query([x - maxR, z - maxR, x + maxR, z + maxR])) {
        const d = distToSegment(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
        if (d < best) best = d;
      }
      return best;
    },
  };
}

function buildWorld(seed) {
  const r = rng(seed, 'world');
  const w = { seed };

  // River: from the northern hills, west of the castle, then east along the south of the town.
  const wob = () => r.float(-25, 25);
  w.riverPts = catmull([
    [-520, -1300], [-330 + wob(), -760], [-215 + wob(), -330], [-150, -80], [-128, 110], [-50, 245],
    [110 + wob(), 300], [360, 312 + wob()], [700, 335 + wob()], [1100, 350 + wob()], [1600, 380], [2600, 420],
  ], 8);
  w.river = polyIndex(w.riverPts);

  // Main road from the bridge eastward.
  const ph1 = r.float(0, 6.28), ph2 = r.float(0, 6.28);
  w.mainZ = (x) => smoothstep(70, 170, x) * (9 * Math.sin(x / 150 + ph1) + 3.5 * Math.sin(x / 57 + ph2));
  const main = [];
  for (let x = CASTLE.moatOuter; x <= 2500; x += 10) main.push([x, w.mainZ(x)]);
  w.roads = [{ id: 'main', kind: 'main', pts: main, width: ROAD_WIDTH.main }];

  w.terrainSeed = hash(seed, 'terrain');
  w.lots = buildLots(w, r);

  // Side streets (north and south) along the main road, then cross streets parallel to it.
  const blocking = Object.values(w.lots).filter((l) => l.blocksRoads);
  let x = 104 + r.int(0, 10), k = 0;
  while (x < 2420) {
    const z0 = w.mainZ(x);
    for (const dir of [-1, 1]) {
      const len = dir < 0 ? r.float(700, 860) : r.float(280, 340);
      const ang = dir * Math.PI / 2 + r.float(-0.12, 0.12);
      const bend = r.float(-0.12, 0.12);
      const pts = [];
      for (let s = 0; s <= len; s += 10) {
        const a = ang + bend * (s / len);
        pts.push([x + Math.cos(a) * s, z0 + Math.sin(a) * s]);
      }
      for (const part of clipByLots(pts, blocking)) w.roads.push({ id: `side${k}${dir < 0 ? 'n' : 's'}`, kind: 'street', pts: part, width: ROAD_WIDTH.street });
    }
    k++;
    x += r.int(64, 86);
  }
  for (const dz of [-160, -320, -480, -640, 150]) {
    const pts = [];
    for (let xx = 110; xx <= 2420; xx += 10) pts.push([xx, w.mainZ(xx) + dz + 6 * Math.sin(xx / 90 + dz)]);
    clipByLots(pts, blocking).forEach((part, i) => w.roads.push({ id: `cross${dz}_${i}`, kind: 'street', pts: part, width: ROAD_WIDTH.street }));
  }
  // Dirt tracks to the west-side workplaces (not used for plots).
  const ringTrack = [];
  for (let a = 0; a <= 64; a++) ringTrack.push([Math.cos(a / 64 * Math.PI * 2) * 67, Math.sin(a / 64 * Math.PI * 2) * 67]);
  w.tracks = [
    { id: 'ring', pts: ringTrack, width: ROAD_WIDTH.track },
    { id: 'mill', pts: catmull([[0, -67], [4, -140], [w.lots.windmill.x, w.lots.windmill.z + 8]], 6), width: ROAD_WIDTH.track },
    { id: 'quarry', pts: catmull([[-47, -47], [-90, -110], [w.lots.quarry.x + 10, w.lots.quarry.z + 14]], 6), width: ROAD_WIDTH.track },
    { id: 'saw', pts: catmull([[-67, 0], [w.lots.sawmill.x + 8, w.lots.sawmill.z - 4], [w.lots.dock.x + 6, w.lots.dock.z - 6]], 6), width: ROAD_WIDTH.track },
  ];
  w.allPaths = [...w.roads, ...w.tracks];
  w.pathIndex = buildPathIndex(w.allPaths);

  w.wall2 = buildWall2(w);
  w.fields = buildFields(w, r);
  w.plots = buildPlots(w, seed);
  return w;
}

function buildPathIndex(paths) {
  const grid = new SpatialHash(40);
  const segs = [];
  for (const p of paths) {
    for (let i = 0; i < p.pts.length - 1; i++) {
      const [ax, az] = p.pts[i], [bx, bz] = p.pts[i + 1];
      const s = { ax, az, bx, bz, hw: p.width / 2 };
      segs.push(s);
      grid.insert([Math.min(ax, bx) - s.hw, Math.min(az, bz) - s.hw, Math.max(ax, bx) + s.hw, Math.max(az, bz) + s.hw], s);
    }
  }
  return {
    segs,
    /** Distance from (x,z) to the nearest path edge (negative inside a path). */
    edgeDist(x, z, maxR = 30) {
      let best = Infinity;
      for (const s of grid.query([x - maxR, z - maxR, x + maxR, z + maxR])) {
        const d = distToSegment(x, z, s.ax, s.az, s.bx, s.bz) - s.hw;
        if (d < best) best = d;
      }
      return best;
    },
    near(aabb) { return grid.query(aabb); },
  };
}

function clipByLots(pts, lots) {
  const parts = [];
  let cur = [];
  for (const p of pts) {
    const blocked = lots.some((l) => pointInObb(grow(l, 7), p[0], p[1]));
    if (blocked) { if (cur.length > 3) parts.push(cur); cur = []; } else cur.push(p);
  }
  if (cur.length > 3) parts.push(cur);
  return parts;
}

// Reserved building lots. Positions are fixed relative to the main road so the town reads well.
function buildLots(w, r) {
  const lots = {};
  const roadside = (id, x, side, hw, hd, extra = {}) => {
    const z = w.mainZ(x);
    const t = Math.atan2(w.mainZ(x + 1) - w.mainZ(x - 1), 2);
    const off = ROAD_WIDTH.main / 2 + 2 + hd;
    lots[id] = { id, x: x - Math.sin(t) * off * side, z: z + Math.cos(t) * off * side, hw, hd, rot: t, ...extra };
  };
  roadside('well', 76, -1, 3.5, 3.5);
  roadside('forge', 96, 1, 8, 7);
  roadside('bakery', 116, -1, 8, 7);
  roadside('chapel', 150, -1, 10, 15);
  lots.market = { id: 'market', x: 205, z: w.mainZ(205), hw: 22, hd: 19, rot: 0, plaza: true };
  roadside('tavern', 240, 1, 9, 8);
  lots.townhall = { id: 'townhall', x: 205, z: w.mainZ(205) - 19 - 13, hw: 13, hd: 11, rot: 0 };
  roadside('cathedral', 300, -1, 15, 26, { blocksRoads: true });
  lots.district_east = { id: 'district_east', x: 560, z: w.mainZ(560), hw: 17, hd: 17, rot: 0, plaza: true };
  lots.district_north = { id: 'district_north', x: 470, z: w.mainZ(470) - 330, hw: 16, hd: 16, rot: 0, plaza: true };
  lots.district_south = { id: 'district_south', x: 760, z: w.mainZ(760) + 75, hw: 16, hd: 16, rot: 0, plaza: true };
  lots.district_far = { id: 'district_far', x: 1150, z: w.mainZ(1150), hw: 18, hd: 18, rot: 0, plaza: true };
  lots.tournament = { id: 'tournament', x: 420, z: w.mainZ(420) - 235, hw: 48, hd: 28, rot: 0, blocksRoads: true };
  lots.university = { id: 'university', x: 690, z: w.mainZ(690) - 235, hw: 30, hd: 24, rot: 0, blocksRoads: true };
  lots.palace = { id: 'palace', x: 900, z: w.mainZ(900) - 400, hw: 42, hd: 32, rot: 0, blocksRoads: true };
  lots.colossus = { id: 'colossus', x: 1400, z: w.mainZ(1400), hw: 16, hd: 16, rot: 0, plaza: true };
  lots.windmill = { id: 'windmill', x: 6, z: -214, hw: 7, hd: 7, rot: 0 };
  lots.quarry = { id: 'quarry', x: -112, z: -222, hw: 20, hd: 14, rot: 0.3 };
  // West bank workplaces: sawmill at the forest edge, dock on the river.
  const bank = (zTarget, out) => {
    let best = null;
    for (const p of w.riverPts) if (!best || Math.abs(p[1] - zTarget) < Math.abs(best[1] - zTarget)) if (p[0] < 0) best = p;
    return [best[0] + out, best[1]];
  };
  const [sx, sz] = bank(40, 34);
  lots.sawmill = { id: 'sawmill', x: sx, z: sz, hw: 9, hd: 7, rot: 0.15 };
  const [dx, dz] = bank(150, RIVER_HALF_WIDTH + 2);
  lots.dock = { id: 'dock', x: dx, z: dz, hw: 6, hd: 8, rot: -0.5, onWater: true };
  // Harbor: north bank of the river, south-east of the town.
  let hp = w.riverPts.reduce((b, p) => (Math.abs(p[0] - 470) < Math.abs(b[0] - 470) ? p : b));
  lots.harbor = { id: 'harbor', x: hp[0], z: hp[1] - RIVER_HALF_WIDTH - 12, hw: 36, hd: 12, rot: 0, onWater: true };
  hp = w.riverPts.reduce((b, p) => (Math.abs(p[0] - 1250) < Math.abs(b[0] - 1250) ? p : b));
  lots.lighthouse = { id: 'lighthouse', x: hp[0], z: hp[1] - RIVER_HALF_WIDTH - 22, hw: 7, hd: 7, rot: 0 };
  lots.guardposts = { id: 'guardposts', x: 0, z: 0, hw: 0, hd: 0, rot: 0, virtual: true };
  lots.fields = { id: 'fields', x: 0, z: -120, hw: 0, hd: 0, rot: 0, virtual: true };
  lots.charter_stone = { id: 'charter_stone', x: 205, z: w.mainZ(205) + 10, hw: 0, hd: 0, rot: 0, virtual: true };
  for (const l of Object.values(lots)) l.y = undefined;
  return lots;
}

// Second wall ring: an ellipse around the castle and old town, with gates where roads cross.
function buildWall2(w) {
  const cx = 150, cz = 0, rx = 255, rz = 205, n = 72;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]);
  }
  const segments = [];
  const gates = [];
  for (let i = 0; i < n; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const water = w.river.dist(mx, mz) < RIVER_HALF_WIDTH + 4;
    const roadHit = w.pathIndex.edgeDist(mx, mz) < 4;
    const box = segmentObb(ax, az, bx, bz, 2);
    if (water) continue;
    if (roadHit) { gates.push({ x: mx, z: mz, rot: box.rot }); continue; }
    segments.push(box);
  }
  return { segments, gates, towers: pts.filter((_, i) => i % 6 === 0).slice(0, -1) };
}

function buildFields(w, r) {
  const out = [];
  for (let x = -80; x <= 80; x += 27) {
    for (let z = -205; z <= -78; z += 20) {
      const f = { x: x + r.float(-3, 3), z: z + r.float(-2, 2), hw: r.float(10, 12.5), hd: r.float(7.5, 9), rot: r.float(-0.1, 0.1) };
      if (Math.hypot(f.x, f.z) < 80) continue;
      if (obbOverlap(grow(f, 3), grow(w.lots.windmill, 4))) continue;
      if (w.pathIndex.edgeDist(f.x, f.z) < Math.max(f.hw, f.hd) - 4) continue;
      if (obbCorners(f).some(([cx, cz]) => w.pathIndex.edgeDist(cx, cz) < 1)) continue;
      out.push(f);
    }
  }
  out.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  return out;
}

// ---------------------------------------------------------------- terrain
export function heightAt(w, x, z) {
  const ts = w.terrainSeed;
  const n = fbm(ts, x / 260, z / 260);
  const t = (n + 1) / 2;
  const town = smoothstep(30, 110, x) * (1 - smoothstep(500, 760, Math.abs(z)));
  let h = 2.4 + lerp(10, 2.6, town) * Math.pow(t, 1.5) + 0.6 * fbm(ts + 3, x / 40, z / 40);
  // landmark hills and the northern ridge
  h += 20 * Math.exp(-((x + 120) ** 2 + (z + 250) ** 2) / (2 * 55 ** 2));
  h += 9 * Math.exp(-((x - 6) ** 2 + (z + 214) ** 2) / (2 * 38 ** 2));
  h += Math.max(0, -z - 700) * 0.12 * (0.6 + 0.4 * t) + Math.max(0, z - 650) * 0.08;
  h += Math.max(0, -x - 400) * 0.06;
  // castle island and moat
  const rc = Math.hypot(x, z);
  h = lerp(CASTLE.ground, h, smoothstep(CASTLE.island - 2, CASTLE.moatOuter + 18, rc));
  const moat = smoothstep(CASTLE.island + 2, CASTLE.moatInner + 1.5, rc) * (1 - smoothstep(CASTLE.moatOuter - 2, CASTLE.moatOuter + 1, rc));
  h = lerp(h, -2.2, moat);
  // river channel
  const d = w.river.dist(x, z, 60);
  if (d < RIVER_HALF_WIDTH + 26) {
    const bank = smoothstep(RIVER_HALF_WIDTH - 4, RIVER_HALF_WIDTH + 26, d);
    h = lerp(-2.6, Math.max(h, 1.6), bank * bank * (3 - 2 * bank));
  }
  // gentle grading under roads
  const rd = w.pathIndex.edgeDist(x, z, 14);
  if (rd < 10 && h > 1.2) h = lerp(h, h * 0.9 + 0.2, 1 - smoothstep(0, 10, rd));
  return h;
}

export function isWater(w, x, z) {
  return heightAt(w, x, z) < WATER_LEVEL;
}

// ---------------------------------------------------------------- plots
function buildPlots(w, seed) {
  const blockers = new SpatialHash(40);
  const add = (b) => blockers.insert(obbAabb(b), b);
  for (const s of w.pathIndex.segs) add(segmentObb(s.ax, s.az, s.bx, s.bz, s.hw + 1));
  for (const l of Object.values(w.lots)) if (!l.virtual) add(grow(l, 2.5));
  for (const s of w.wall2.segments) add(grow(s, 3));
  for (const t of w.wall2.towers) add({ x: t[0], z: t[1], hw: 7, hd: 7, rot: 0 });
  for (const f of w.fields) add(grow(f, 2));

  const cands = [];
  for (const road of w.roads) {
    const r = rng(seed, 'plots', road.id);
    for (const side of [-1, 1]) {
      let s = 6;
      const pts = road.pts;
      // arc-length parametrisation
      const acc = [0];
      for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const at = (sv) => {
        let i = 1;
        while (i < acc.length - 1 && acc[i] < sv) i++;
        const t = (sv - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
        return [ax + (bx - ax) * t, az + (bz - az) * t, Math.atan2(bz - az, bx - ax)];
      };
      const total = acc[acc.length - 1];
      while (s < total - 6) {
        const width = r.float(9, 12.5), depth = r.float(11, 14.5), gap = r.float(1.2, 3.2);
        const [px, pz, ang] = at(s + width / 2);
        const off = road.width / 2 + PLOT_SETBACK + depth / 2;
        cands.push({
          x: px - Math.sin(ang) * off * side,
          z: pz + Math.cos(ang) * off * side,
          hw: width / 2, hd: depth / 2,
          rot: ang, facing: side, road: road.id,
        });
        s += width + gap;
      }
    }
  }
  const gx = CASTLE.moatOuter + 4;
  cands.sort((a, b) => Math.hypot(a.x - gx, a.z) - Math.hypot(b.x - gx, b.z) || a.x - b.x || a.z - b.z);

  const accepted = new SpatialHash(40);
  const plots = [];
  for (const c of cands) {
    if (plots.length >= MAX_PLOTS) break;
    if (Math.hypot(c.x, c.z) < CASTLE.moatOuter + 20) continue;
    const corners = obbCorners(c);
    if (corners.some(([x, z]) => w.river.dist(x, z) < RIVER_HALF_WIDTH + 8)) continue;
    const hs = corners.map(([x, z]) => heightAt(w, x, z));
    const hc = heightAt(w, c.x, c.z);
    if (Math.max(...hs, hc) - Math.min(...hs, hc) > 2.6 || Math.min(...hs) < 1.2) continue;
    const box = obbAabb(c);
    let bad = false;
    for (const b of blockers.query(box)) if (obbOverlap(c, b)) { bad = true; break; }
    if (bad) continue;
    for (const p of accepted.query(box)) if (obbOverlap(grow(c, 0.6), p)) { bad = true; break; }
    if (bad) continue;
    c.id = plots.length;
    c.y = hc;
    c.yMin = Math.min(...hs, hc);
    accepted.insert(box, c);
    plots.push(c);
  }
  return plots;
}

/** All obstacles that houses must never overlap (for tests and debug). */
export function obstacles(w) {
  const out = [];
  for (const s of w.pathIndex.segs) out.push({ kind: 'road', box: segmentObb(s.ax, s.az, s.bx, s.bz, s.hw) });
  for (const l of Object.values(w.lots)) if (!l.virtual) out.push({ kind: 'lot:' + l.id, box: l });
  for (const s of w.wall2.segments) out.push({ kind: 'wall2', box: s });
  for (const f of w.fields) out.push({ kind: 'field', box: f });
  return out;
}
