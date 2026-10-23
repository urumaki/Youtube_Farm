// The fixed geography of the kingdom: terrain, river, moat, roads, reserved lots and house plots.
// Everything is a pure function of the seed, shared by the simulation, the renderer and the tests.
import { hash, rand01, rng } from './prng.js';
import {
  obbOverlap, obbAabb, grow, segmentObb, distToSegment, pointInObb, SpatialHash, smoothstep, lerp, obbCorners,
} from './geometry.js';

export const WATER_LEVEL = 0.4;
export const CASTLE = { half: 28, island: 46, moatInner: 47, moatOuter: 58, ground: 4.5 };
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

  // Organic town plan (after medieval castle towns such as Corfe or Bolsover): a market square just
  // outside the castle bridge, streets radiating from it and bending with the ground, lanes branching
  // off them, and long narrow burgage plots running back from every street frontage.
  w.terrainSeed = hash(seed, 'terrain');
  w.lots = buildLots(w, r);
  w.roads = growRoads(w, r, seed);
  addRoadsideLots(w);

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
  // added after the plots, so the plot list never changes (virtual lots, houses do not see them): the
  // beehives in a corner of a field west of the castle, the Great Bridge across the river south of town
  const f = w.fields[2] || w.fields[0];
  if (f) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    w.lots.apiary = { id: 'apiary', x: f.x - c * (f.hw - 3) + s * (f.hd - 2.5), z: f.z - s * (f.hw - 3) - c * (f.hd - 2.5), hw: 2.5, hd: 2, rot: f.rot, virtual: true };
  }
  buildNobleQuarter(w, seed);
  // the Great Bridge (owner 2026-10-23: moved west) crosses the river where the Noble Quarter's avenue ends, so a road
  // can run on to it; without the avenue, south of town as before
  const av = w.roads.find((r) => r.id === 'noble_avenue');
  const end = av ? av.pts[av.pts.length - 1] : [150, 0];
  const bp = w.riverPts.reduce((b, p) => (Math.hypot(p[0] - end[0], av ? p[1] - end[1] : 0) < Math.hypot(b[0] - end[0], av ? b[1] - end[1] : 0) ? p : b));
  const bq = w.riverPts[Math.min(w.riverPts.length - 1, w.riverPts.indexOf(bp) + 1)];
  w.lots.stone_bridge = { id: 'stone_bridge', x: bp[0], z: bp[1], hw: 5, hd: RIVER_HALF_WIDTH + 9, rot: Math.atan2(bq[1] - bp[1], bq[0] - bp[0]), virtual: true, onWater: true };
  placeFletcherWorkshop(w);
  placePalace(w);
  // the dense plots new houses take from 2026-10-23 on (ids from DENSE_ID), laid out round everything else;
  // houses already standing keep their plots, and a dense plot on one of them is passed over (simulate.js)
  w.densePlots = buildPlots(w, seed, { dense: true });
  return w;
}

// The Royal Palace (owner 2026-10-23) stands beside the University: the free ground nearest it, found after every
// plot, street and lot is laid out (its first lot in the east stays reserved, so the streets there do not move).
function placePalace(w) {
  const uni = w.lots.university;
  if (!uni) return;
  const taken = new SpatialHash(40);
  const take = (b) => taken.insert(obbAabb(b), b);
  for (const p of [...w.plots, ...w.finePlots]) take(grow(p, 1));
  for (const s of w.pathIndex.segs) take(segmentObb(s.ax, s.az, s.bx, s.bz, s.hw + 1));
  for (const l of Object.values(w.lots)) if ((!l.virtual || l.hw > 0) && l.id !== 'palace') take(grow(l, 3));
  for (const f of w.fields) take(grow(f, 2));
  const hits = (b) => [...taken.query(obbAabb(b))].some((o) => obbOverlap(b, o));
  const river = (x, z) => { let d = Infinity; for (let i = 1; i < w.riverPts.length; i++) d = Math.min(d, distToSegment(x, z, ...w.riverPts[i - 1], ...w.riverPts[i])); return d; };
  let best = null;
  for (let dx = -200; dx <= 200; dx += 4) for (let dz = -200; dz <= 200; dz += 4) for (const rot of [0, Math.PI / 2]) {
    const d = Math.hypot(dx, dz);
    if (best && d >= best.d) continue;
    const c = { id: 'palace', x: uni.x + dx, z: uni.z + dz, hw: 36, hd: 21, rot, blocksRoads: true };
    if (Math.hypot(c.x, c.z) < CASTLE.moatOuter + 45) continue;
    if ([[c.x, c.z], ...obbCorners(c)].some(([x, z]) => river(x, z) < RIVER_HALF_WIDTH + 6)) continue;
    if (hits(c)) continue;
    best = { ...c, d };
  }
  if (best) { delete best.d; w.lots.palace = best; }
}

// The Fletcher's Workshop (owner 2026-10-23, a commission): the free ground nearest the market square that
// fronts a street, found after every plot, street and lot is laid out, so nothing else moves. The lot's
// front (+z) faces the street.
function placeFletcherWorkshop(w) {
  const hw = 6, hd = 5;
  const taken = new SpatialHash(40);
  const take = (b) => taken.insert(obbAabb(b), b);
  for (const p of [...w.plots, ...w.finePlots]) take(grow(p, 1));
  for (const s of w.pathIndex.segs) take(segmentObb(s.ax, s.az, s.bx, s.bz, s.hw + 1));
  for (const l of Object.values(w.lots)) if (!l.virtual || l.hw > 0) take(grow(l, 2));
  for (const f of w.fields) take(grow(f, 2));
  const hits = (b) => [...taken.query(obbAabb(b))].some((o) => obbOverlap(b, o));
  const spots = [];
  for (let dx = -160; dx <= 160; dx += 4) for (let dz = -160; dz <= 160; dz += 4) spots.push([MARKET.x + dx, MARKET.z + dz, Math.hypot(dx, dz)]);
  spots.sort((a, b) => a[2] - b[2]);
  for (const [x, z] of spots) {
    if (Math.hypot(x, z) < CASTLE.moatOuter + 18 || isWater(w, x, z)) continue;
    let near = null, nd = Infinity;
    for (const s of w.pathIndex.segs) {
      const d = distToSegment(x, z, s.ax, s.az, s.bx, s.bz) - s.hw;
      if (d < nd) { nd = d; near = s; }
    }
    if (!near || nd > hd + 8) continue;
    let rot = Math.atan2(near.bz - near.az, near.bx - near.ax);
    // turn the lot so the street is in front of it (local +z)
    const mx = (near.ax + near.bx) / 2 - x, mz = (near.az + near.bz) / 2 - z;
    if (-Math.sin(rot) * mx + Math.cos(rot) * mz < 0) rot += Math.PI;
    let river = Infinity;
    for (let i = 1; i < w.riverPts.length; i++) river = Math.min(river, distToSegment(x, z, ...w.riverPts[i - 1], ...w.riverPts[i]));
    if (river < RIVER_HALF_WIDTH + 15) continue;
    const lot = { id: 'fletcher_workshop', x, z, hw, hd, rot };
    if (hits(lot)) continue;
    w.lots.fletcher_workshop = lot;
    return;
  }
}

// The University and the Noble Quarter (owner 2026-10-22): the open ground between the castle and the river
// is kept for them. Laid out after the plots, so the plot list never changes: the University moves here from
// its first lot in the east (the streets there already steer round that ground), the quarter's streets
// leave the castle approach, and its wide plots (`w.finePlots`, ids from FINE_ID) take the finer houses.
export const FINE_ID = 100000;
export const DENSE_ID = 200000;
const NOBLE_STREETS = [
  { id: 'noble_avenue', kind: 'main', width: 7, parent: 'approach', pts: [[74, 1], [74, 40], [78, 80], [84, 120], [88, 160], [92, 200], [94, 232]] },
  { id: 'noble_east1', parent: 'noble_avenue', pts: [[80, 94], [115, 96], [158, 104]] },
  { id: 'noble_east2', parent: 'noble_avenue', pts: [[88, 160], [150, 162], [228, 170]] },
  { id: 'noble_east3', parent: 'noble_avenue', pts: [[93, 214], [150, 215], [210, 219]] },
  { id: 'noble_west', parent: 'noble_avenue', pts: [[92, 200], [40, 203], [-40, 206]] },
];
function buildNobleQuarter(w, seed) {
  // the ground already taken: plots, streets and tracks, lots (other seeds lay their streets out elsewhere)
  const taken = new SpatialHash(40);
  const take = (b) => taken.insert(obbAabb(b), b);
  for (const p of w.plots) take(grow(p, 1));
  for (const s of w.pathIndex.segs) take(segmentObb(s.ax, s.az, s.bx, s.bz, s.hw + 1));
  for (const l of Object.values(w.lots)) if (!l.virtual && l.id !== 'university') take(grow(l, 3));
  const hits = (b) => [...taken.query(obbAabb(b))].some((o) => obbOverlap(b, o));
  // the University on the free ground nearest its place below the castle (if there is none it stays east)
  let uni = null;
  for (let dx = -60; dx <= 60; dx += 10) for (let dz = -40; dz <= 40; dz += 10) {
    const c = { id: 'university', x: 5 + dx, z: 150 + dz, hw: 32, hd: 24, rot: 0 };
    if (uni && Math.hypot(dx, dz) >= uni.d) continue;
    if (hits(grow(c, 4)) || obbCorners(c).some(([x, z]) => w.river.dist(x, z) < RIVER_HALF_WIDTH + 12 || Math.hypot(x, z) < CASTLE.moatOuter + 15)) continue;
    uni = { ...c, d: Math.hypot(dx, dz) };
  }
  const streets = [...NOBLE_STREETS];
  if (uni) {
    delete uni.d;
    w.lots.university = uni;
    // the lane from the avenue to the University gate (no houses on it)
    streets.push({ id: 'scholars_lane', parent: 'noble_avenue', pts: [[null, uni.z], [uni.x + uni.hw + 2, uni.z]], noPlots: true, toGate: true });
  }
  for (const st of streets) {
    const parent = w.roads.find((rd) => rd.id === st.parent);
    if (!parent) continue;
    if (st.toGate) st.pts[0][0] = parent.pts.reduce((b, p) => (Math.abs(p[1] - uni.z) < Math.abs(b[1] - uni.z) ? p : b))[0];
    // a street stops short of any street, plot or lot in its way
    const pts = [];
    for (const p of catmull(st.pts, 6)) {
      if (Math.hypot(p[0] - st.pts[0][0], p[1] - st.pts[0][1]) > 12 && (w.pathIndex.edgeDist(p[0], p[1]) < (st.width || ROAD_WIDTH.street) / 2 + 2 || hits({ x: p[0], z: p[1], hw: 3, hd: 3, rot: 0 }))) break;
      pts.push(p);
    }
    if (pts.length < 3) continue;
    const pl = polyline(parent.pts);
    let branchS = 0, bd = Infinity;
    for (let sv = 0; sv <= pl.total; sv += 1) {
      const [x, z] = pl.at(sv), d = Math.hypot(x - pts[0][0], z - pts[0][1]);
      if (d < bd) { bd = d; branchS = sv; }
    }
    if (bd > 4) continue; // its junction was cut off the parent street
    w.roads.push({ id: st.id, kind: st.kind || 'street', pts, width: st.width || ROAD_WIDTH.street, parent: st.parent, depth: (parent.depth || 0) + 1, base: (parent.base || 0) + branchS, branchS, joined: null, noble: true, noPlots: st.noPlots });
  }
  w.allPaths = [...w.roads, ...w.tracks];
  w.pathIndex = buildPathIndex(w.allPaths);

  const blockers = new SpatialHash(40);
  const add = (b) => blockers.insert(obbAabb(b), b);
  for (const s of w.pathIndex.segs) add(segmentObb(s.ax, s.az, s.bx, s.bz, s.hw + 1.5));
  for (const l of Object.values(w.lots)) if (!l.virtual) add(grow(l, 4));
  for (const p of w.plots) add(grow(p, 1));
  for (const f of w.fields) add(grow(f, 2));
  w.finePlots = [];
  for (const road of w.roads.filter((rd) => rd.noble && !rd.noPlots)) {
    const r = rng(seed, 'fineplots', road.id);
    const pl = polyline(road.pts);
    for (const side of [-1, 1]) {
      let s = r.float(4, 8) + (road.parent === 'noble_avenue' ? 9 : 0); // clear of the avenue's own plots
      while (s < pl.total - 8) {
        const width = r.float(13, 16.5), depth = r.float(24, 30);
        const [px, pz, ang] = pl.at(s + width / 2);
        const off = road.width / 2 + 2.5 + depth / 2;
        const c = { x: px - Math.sin(ang) * off * side, z: pz + Math.cos(ang) * off * side, hw: width / 2, hd: depth / 2, rot: ang, facing: side, road: road.id };
        s += width + r.float(2, 4);
        if (Math.hypot(c.x, c.z) < CASTLE.moatOuter + 20) continue;
        const corners = obbCorners(c);
        if (corners.some(([x, z]) => w.river.dist(x, z) < RIVER_HALF_WIDTH + 8)) continue;
        const hs = corners.map(([x, z]) => heightAt(w, x, z)), hc = heightAt(w, c.x, c.z);
        if (Math.max(...hs, hc) - Math.min(...hs, hc) > 2.6 || Math.min(...hs) < 1.2) continue;
        if ([...blockers.query(obbAabb(c))].some((b) => obbOverlap(c, b))) continue;
        c.id = FINE_ID + w.finePlots.length;
        c.y = hc;
        c.yMin = Math.min(...hs, hc);
        c.fine = true;
        add(grow(c, 0.6));
        w.finePlots.push(c);
      }
    }
  }
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

// Reserved building lots. The market sits outside the castle bridge with the chapel and town hall on
// its sides; large later buildings get open ground that streets steer around.
export const MARKET = { x: 102, z: 0, hw: 20, hd: 16 };
function buildLots(w, r) {
  const lots = {};
  lots.market = { id: 'market', ...MARKET, rot: 0, plaza: true };
  lots.chapel = { id: 'chapel', x: MARKET.x - 6, z: -MARKET.hd - 17, hw: 10, hd: 15, rot: 0 };
  lots.townhall = { id: 'townhall', x: MARKET.x - 4, z: MARKET.hd + 14, hw: 13, hd: 11, rot: 0 };
  lots.cathedral = { id: 'cathedral', x: 330, z: -95, hw: 15, hd: 26, rot: 0.2, blocksRoads: true };
  lots.district_east = { id: 'district_east', x: 560, z: -55, hw: 17, hd: 17, rot: 0, plaza: true, blocksRoads: true };
  lots.district_north = { id: 'district_north', x: 470, z: -330, hw: 16, hd: 16, rot: 0, plaza: true, blocksRoads: true };
  lots.district_south = { id: 'district_south', x: 760, z: 95, hw: 16, hd: 16, rot: 0, plaza: true, blocksRoads: true };
  lots.district_far = { id: 'district_far', x: 1150, z: -40, hw: 18, hd: 18, rot: 0, plaza: true, blocksRoads: true };
  lots.tournament = { id: 'tournament', x: 420, z: -235, hw: 48, hd: 28, rot: 0, blocksRoads: true };
  lots.university = { id: 'university', x: 690, z: -235, hw: 30, hd: 24, rot: 0, blocksRoads: true };
  lots.palace = { id: 'palace', x: 900, z: -400, hw: 42, hd: 32, rot: 0, blocksRoads: true };
  lots.colossus = { id: 'colossus', x: 1400, z: -25, hw: 16, hd: 16, rot: 0, plaza: true, blocksRoads: true };
  lots.windmill = { id: 'windmill', x: 6, z: -214, hw: 7, hd: 7, rot: 0, blocksRoads: true };
  lots.quarry = { id: 'quarry', x: -112, z: -222, hw: 20, hd: 14, rot: 0.3, blocksRoads: true };
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
  let hp = w.riverPts.reduce((b, p) => (Math.abs(p[0] - 470) < Math.abs(b[0] - 470) ? p : b));
  lots.harbor = { id: 'harbor', x: hp[0], z: hp[1] - RIVER_HALF_WIDTH - 12, hw: 36, hd: 12, rot: 0, onWater: true, blocksRoads: true };
  hp = w.riverPts.reduce((b, p) => (Math.abs(p[0] - 1250) < Math.abs(b[0] - 1250) ? p : b));
  lots.lighthouse = { id: 'lighthouse', x: hp[0], z: hp[1] - RIVER_HALF_WIDTH - 22, hw: 7, hd: 7, rot: 0, blocksRoads: true };
  lots.guardposts = { id: 'guardposts', x: 0, z: 0, hw: 0, hd: 0, rot: 0, virtual: true };
  lots.fields = { id: 'fields', x: 0, z: -120, hw: 0, hd: 0, rot: 0, virtual: true };
  lots.charter_stone = { id: 'charter_stone', x: MARKET.x, z: 10, hw: 0, hd: 0, rot: 0, virtual: true };
  // small structures inside the market square: virtual (house plots and roads ignore them), drawn on the
  // square's paving (onPlaza)
  lots.crier_stand = { id: 'crier_stand', x: MARKET.x - 11, z: -13.8, hw: 1.6, hd: 1.6, rot: 0, virtual: true, onPlaza: 'market' };
  lots.pillory = { id: 'pillory', x: MARKET.x - 11, z: 14.2, hw: 2.6, hd: 1.7, rot: 0, virtual: true, onPlaza: 'market' };
  lots.tailor_stall = { id: 'tailor_stall', x: MARKET.x + 11, z: -13.8, hw: 1.8, hd: 1.6, rot: 0, virtual: true, onPlaza: 'market' };
  lots.physician_booth = { id: 'physician_booth', x: MARKET.x + 12, z: 14.2, hw: 2.2, hd: 1.6, rot: 0, virtual: true, onPlaza: 'market' };
  // workshops on the ward squares (built after their ward): beside the fountain, clear of the banner poles
  lots.cooperage = { id: 'cooperage', x: lots.district_east.x, z: lots.district_east.z - 12, hw: 3.6, hd: 2.4, rot: 0, virtual: true, onPlaza: 'district_east' };
  lots.bell_foundry = { id: 'bell_foundry', x: lots.district_north.x, z: lots.district_north.z - 11.5, hw: 3.6, hd: 2.6, rot: 0, virtual: true, onPlaza: 'district_north' };
  lots.clock_tower = { id: 'clock_tower', x: lots.district_south.x, z: lots.district_south.z - 11, hw: 3, hd: 3, rot: 0, virtual: true, onPlaza: 'district_south' };
  lots.potter_stall = { id: 'potter_stall', x: MARKET.x - 18, z: -13.8, hw: 1.6, hd: 1.6, rot: 0, virtual: true, onPlaza: 'market' };
  lots.cobbler_stall = { id: 'cobbler_stall', x: MARKET.x + 18, z: 14.2, hw: 1.6, hd: 1.6, rot: 0, virtual: true, onPlaza: 'market' };
  void r;
  return lots;
}

/** Arc-length helpers for a polyline. */
export function polyline(pts) {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return {
    pts, acc, total: acc[acc.length - 1],
    at(sv) {
      let i = 1;
      while (i < acc.length - 1 && acc[i] < sv) i++;
      const t = Math.max(0, Math.min(1, (sv - acc[i - 1]) / (acc[i] - acc[i - 1] || 1)));
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      return [ax + (bx - ax) * t, az + (bz - az) * t, Math.atan2(bz - az, bx - ax)];
    },
  };
}

// Streets grow by a seeded walk that prefers flat ground, keeps away from water, lots and other
// streets, and ends in a T-junction when it meets another street.
function growRoads(w, r, seed) {
  const roads = [];
  const segs = new SpatialHash(30);
  const blockers = Object.values(w.lots).filter((l) => !l.virtual && l.id !== 'market');
  const STEP = 8;
  const addSegs = (road) => {
    for (let i = 0; i < road.pts.length - 1; i++) {
      const [ax, az] = road.pts[i], [bx, bz] = road.pts[i + 1];
      segs.insert([Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)], { road, i });
    }
  };
  const nearRoad = (x, z, ignore, radius) => {
    let best = null;
    for (const s of segs.query([x - radius, z - radius, x + radius, z + radius])) {
      if (ignore(s.road, s.i)) continue;
      const [ax, az] = s.road.pts[s.i], [bx, bz] = s.road.pts[s.i + 1];
      const d = distToSegment(x, z, ax, az, bx, bz);
      if (d < radius && (!best || d < best.d)) best = { d, s };
    }
    return best;
  };
  const h = (x, z) => heightAt(w, x, z);
  const walk = ({ id, start, heading, length, width, kind, parent, depth, base, keep = 0 }) => {
    const pts = [start];
    let [x, z] = start, a = heading;
    let joined = null;
    const own = (rd, i) => rd.id === id || (rd === parent && pts.length < 5);
    for (let k = 0; k * STEP < length; k++) {
      let best = null;
      for (const da of [-0.5, -0.24, -0.12, 0, 0.12, 0.24, 0.5]) {
        const curl = fbm(seed + 31 + depth, x / 160, z / 160, 2) * 0.07;
        const na = a + da + curl;
        const nx = x + Math.cos(na) * STEP, nz = z + Math.sin(na) * STEP;
        let cost = Math.abs(da) * 0.5 + Math.abs(h(nx, nz) - h(x, z)) * 1.4 + keep * Math.abs(Math.atan2(Math.sin(na - heading), Math.cos(na - heading)));
        if (nx > 2600 || nx < -60 || nz < -1150 || nz > 520) cost += 1000;
        if (w.river.dist(nx, nz, 80) < RIVER_HALF_WIDTH + 26) cost += 1000;
        if (Math.hypot(nx, nz) < CASTLE.moatOuter + 22) cost += 1000;
        if (h(nx, nz) > 16) cost += 6;
        for (const l of blockers) {
          if (pointInObb(grow(l, 9), nx, nz)) cost += 1000;
          else if (pointInObb(grow(l, 40), nx + Math.cos(na) * 30, nz + Math.sin(na) * 30)) cost += 4; // steer early
        }
        if (w.river.dist(nx + Math.cos(na) * 40, nz + Math.sin(na) * 40, 80) < RIVER_HALF_WIDTH + 30) cost += 4;
        if (!best || cost < best.cost) best = { cost, na, nx, nz };
      }
      if (best.cost >= 1000) break;
      a = best.na; x = best.nx; z = best.nz;
      const hit = pts.length > 3 && nearRoad(x, z, own, 24);
      if (hit) {
        // T-junction: finish on the other street's centre line
        const [ax, az] = hit.s.road.pts[hit.s.i], [bx, bz] = hit.s.road.pts[hit.s.i + 1];
        const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        pts.push([ax + dx * t, az + dz * t]);
        joined = hit.s.road.id;
        break;
      }
      pts.push([x, z]);
    }
    if (pts.length < (depth > 1 ? 7 : 4)) return null;
    const road = { id, kind, pts, width, parent: parent?.id ?? null, depth, base, joined };
    roads.push(road);
    addSegs(road);
    return road;
  };

  // the approach from the castle bridge into the market square
  const approach = { id: 'approach', kind: 'main', pts: [[CASTLE.moatOuter + 4, 0], [MARKET.x - MARKET.hw, 0]], width: ROAD_WIDTH.main, parent: null, depth: 0, base: 0 };
  roads.push(approach);
  addSegs(approach);
  // main streets leaving the market
  const mains = [
    { id: 'east', start: [MARKET.x + MARKET.hw, 0], heading: r.float(-0.08, 0.08), length: 2300 },
    { id: 'northeast', start: [MARKET.x + MARKET.hw * 0.6, -MARKET.hd], heading: -0.8 + r.float(-0.1, 0.1), length: 1300 },
    { id: 'southeast', start: [MARKET.x + MARKET.hw * 0.6, MARKET.hd], heading: 0.75 + r.float(-0.1, 0.1), length: 1100 },
    { id: 'north', start: [MARKET.x + MARKET.hw, -MARKET.hd * 0.5], heading: -1.25 + r.float(-0.08, 0.08), length: 900 },
  ];
  const queue = [];
  for (const m of mains) {
    const rd = walk({ ...m, width: ROAD_WIDTH.main, kind: 'main', parent: null, depth: 1, base: 0, keep: 0.5 });
    if (rd) queue.push(rd);
  }
  // lanes branch off streets, and smaller lanes off those
  let n = 0;
  while (queue.length) {
    const p = queue.shift();
    if (p.depth >= 3) continue;
    const pl = polyline(p.pts);
    let s = p.depth === 1 ? r.float(60, 90) : r.float(45, 70);
    let side = r.chance(0.5) ? 1 : -1;
    while (s < pl.total - 30) {
      const [x, z, ang] = pl.at(s);
      side = r.chance(0.7) ? -side : side;
      const turn = side * (Math.PI / 2 + r.float(-0.45, 0.45));
      const off = p.width / 2 + 1;
      const start = [x - Math.sin(ang) * off * side, z + Math.cos(ang) * off * side];
      const rd = walk({
        id: `lane${n++}`, start: [start[0] + Math.cos(ang + turn) * 2, start[1] + Math.sin(ang + turn) * 2], heading: ang + turn,
        length: p.depth === 1 ? r.float(180, 520) : r.float(80, 240), width: ROAD_WIDTH.street, kind: 'street', keep: 0.15,
        parent: p, depth: p.depth + 1, base: p.base + s,
      });
      if (rd) { rd.pts.unshift([x, z]); rd.branchS = s; queue.push(rd); }
      s += p.depth === 1 ? r.float(55, 110) : r.float(60, 120);
    }
  }
  return roads;
}

/** Workshops and the tavern front the main streets near the market. */
function addRoadsideLots(w) {
  const place = (id, roadId, s, side, hw, hd) => {
    const rd = w.roads.find((x) => x.id === roadId);
    if (!rd) return;
    const [x, z, ang] = polyline(rd.pts).at(s);
    const off = rd.width / 2 + 2 + hd;
    w.lots[id] = { id, x: x - Math.sin(ang) * off * side, z: z + Math.cos(ang) * off * side, hw, hd, rot: ang };
  };
  place('well', 'approach', 10, -1, 3.5, 3.5);
  place('tavern', 'east', 22, -1, 9, 8);
  place('forge', 'east', 45, 1, 8, 7);
  place('bakery', 'northeast', 30, 1, 8, 7);
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
  const towers = pts.slice(0, -1).filter((p, i) => i % 6 === 0 && w.pathIndex.edgeDist(p[0], p[1]) > 8 && w.river.dist(p[0], p[1]) > RIVER_HALF_WIDTH + 6);
  return { segments, gates, towers };
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
  const moat = smoothstep(CASTLE.island - 1, CASTLE.moatInner + 3, rc) * (1 - smoothstep(CASTLE.moatOuter - 4, CASTLE.moatOuter + 3, rc));
  h = lerp(h, -2.2, moat);
  // river channel
  const d = w.river.dist(x, z, 60);
  if (d < RIVER_HALF_WIDTH + 26) {
    const bank = smoothstep(RIVER_HALF_WIDTH - 4, RIVER_HALF_WIDTH + 26, d);
    h = lerp(-2.6, Math.max(h, 1.6), bank * bank * (3 - 2 * bank));
  }
  // gentle grading under roads
  const rd = w.pathIndex ? w.pathIndex.edgeDist(x, z, 14) : Infinity;
  if (rd < 10 && h > 1.2) h = lerp(h, h * 0.9 + 0.2, 1 - smoothstep(0, 10, rd));
  return h;
}

export function isWater(w, x, z) {
  return heightAt(w, x, z) < WATER_LEVEL;
}

// ---------------------------------------------------------------- plots
function buildPlots(w, seed, { dense = false } = {}) {
  const blockers = new SpatialHash(40);
  const add = (b) => blockers.insert(obbAabb(b), b);
  for (const s of w.pathIndex.segs) add(segmentObb(s.ax, s.az, s.bx, s.bz, s.hw + 1));
  for (const l of Object.values(w.lots)) if (!l.virtual || (dense && l.hw > 0)) add(grow(l, 2.5));
  if (dense) for (const p of w.finePlots) add(grow(p, 1));
  for (const s of w.wall2.segments) add(grow(s, 3));
  for (const t of w.wall2.towers) add({ x: t[0], z: t[1], hw: 7, hd: 7, rot: 0 });
  for (const f of w.fields) add(grow(f, 2));

  // Burgage plots: narrow frontage on the street, long backs (house in front, croft behind).
  // They are taken in order of distance along the street network from the market, so the town
  // grows as ribbons along its streets rather than as a block.
  const cands = [];
  for (const road of w.roads) {
    if (dense && road.noble) continue; // the Noble Quarter's streets keep their wide plots
    const r = rng(seed, dense ? 'plots2' : 'plots', road.id);
    const pl = polyline(road.pts);
    for (const side of [-1, 1]) {
      let s = road.id === 'approach' ? 4 : r.float(5, 9);
      while (s < pl.total - 6) {
        const main = road.kind === 'main';
        // dense (owner 2026-10-23): narrow medieval frontages close together, so more houses fit on a street
        const width = dense ? (main ? r.float(5.2, 6.6) : r.float(5.6, 7.4)) : main ? r.float(5.8, 9) : r.float(6.5, 10.5);
        const depth = main ? r.float(18, 27) : r.float(14, 21);
        const gap = dense ? (r.chance(0.05) ? r.float(3, 5) : r.float(0.2, 0.5))
          : r.chance(0.1) ? r.float(3.5, 8) : r.float(0.5, 1.6); // the odd gap: a yard or an alley
        const [px, pz, ang] = pl.at(s + width / 2);
        const setback = dense ? r.float(1.0, 1.6) : r.float(1.3, 3);
        const off = road.width / 2 + setback + depth / 2;
        cands.push({
          x: px - Math.sin(ang) * off * side,
          z: pz + Math.cos(ang) * off * side,
          hw: width / 2, hd: depth / 2,
          rot: ang + r.float(-0.07, 0.07), facing: side, road: road.id,
          prio: road.base + s + r.float(0, 25) + road.depth * 12,
        });
        s += width + gap;
      }
    }
  }
  cands.sort((a, b) => a.prio - b.prio || a.x - b.x || a.z - b.z);

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
    for (const p of accepted.query(box)) if (obbOverlap(grow(c, dense ? 0.1 : 0.6), p)) { bad = true; break; }
    if (bad) continue;
    c.id = (dense ? DENSE_ID : 0) + plots.length;
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
