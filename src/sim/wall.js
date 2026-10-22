// The Second Wall (owner 2026-10-21): it never passes over a house. Its route is planned on the day its
// construction begins, around the houses standing then: a zigzag ring (a tower at every change of direction)
// round the town, whose two ends run down to the river bank (the river closes the town on the west and the
// south, so nobody walks round the end of the wall). It need not take in every house. Gates where roads
// cross it. A house still in the way moves to a free plot; houses built later never go on it
// (simulate.js findHome).
// state.wall2 = { day, pts: [[x, z], ...] } (an open line from bank to bank); wallLayout() gives the pieces.
import { RIVER_HALF_WIDTH, CASTLE } from './world.js';
import { obbOverlap, obbAabb, grow, segmentObb, SpatialHash } from './geometry.js';

const PIECE = 20; // longest piece of wall between joints
const GATE_HALF = 9.5; // half the opening of a gate, towers included
const BANK = RIVER_HALF_WIDTH + 1; // the wall ends here, at the water's edge
// the route is found on rays from the town centre (an ellipse like the first plan, scaled per ray)
const C = { x: 150, z: 0, rx: 255, rz: 205 };
const STEPS = 60; // corners to choose from (one per ray)
const SCALES = Array.from({ length: 25 }, (_, i) => 0.8 + i * 0.05); // 0.8 .. 2.0 (far out round the quarry)

const rayPoint = (k, r) => {
  const a = (k / STEPS) * Math.PI * 2;
  return [C.x + Math.cos(a) * C.rx * r, C.z + Math.sin(a) * C.rz * r];
};

const PLANS = new WeakMap(); // saves from before the route was stored plan it again (the renderer twice)
/**
 * The route of the wall round the town as it stands today (see the top of the file): one corner per ray,
 * at the distance that keeps it off the houses, fields and building lots, crossing roads only where the
 * gate towers are clear of houses, not too far from the first plan, not jumping from ray to ray.
 * Where a ray meets the river first, the wall follows the water (and is not built there).
 */
export function planWall2(w, state) {
  if (!PLANS.has(state)) PLANS.set(state, findRoute(w, state));
  return PLANS.get(state);
}

function findRoute(w, state) {
  const avoid = [
    ...state.plots.map((p) => ({ b: grow(p, 3), cost: 60 })),
    ...Object.values(w.lots).filter((l) => !l.virtual && l.hw > 0).map((l) => ({ b: grow(l, 4), cost: 1000 })), // never over a building
    ...w.fields.map((f) => ({ b: grow(f, 2), cost: 250 })), // never over the crops (owner 2026-10-22)
    { b: { x: 0, z: 0, hw: CASTLE.moatOuter + 6, hd: CASTLE.moatOuter + 6, rot: 0 }, cost: 500 },
  ];
  const grid = new SpatialHash(40);
  for (const o of avoid) grid.insert(obbAabb(o.b), o);
  const near = (box) => grid.query(obbAabb(box));
  const wet = (p) => w.river.dist(p[0], p[1]) < BANK;
  // per ray: where it meets the river (the wall then follows the water there)
  // (looked for within the first plan's reach: the far scales are only for going round things)
  const river = Array.from({ length: STEPS }, (_, k) => SCALES.find((r) => r <= 1.6 + 1e-9 && wet(rayPoint(k, r))) ?? null);
  // a ray that meets the river may also end a little further out on the water, so the last stretch can
  // come down to the bank round a building standing by it (the quarry)
  const cands = Array.from({ length: STEPS }, (_, k) => (river[k] !== null ? SCALES.filter((r) => r >= river[k] && r <= river[k] + 0.16 && wet(rayPoint(k, r))) : SCALES));
  const edgeCost = (p, q) => {
    if (wet(p) && wet(q)) return 0;
    const box = segmentObb(p[0], p[1], q[0], q[1], 2);
    let c = 0;
    for (const o of near(box)) if (obbOverlap(o.b, box)) c += o.cost;
    // a road under the wall for a long way (not just crossing it) needs too many gates
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    let onRoad = 0;
    for (let d = 0; d <= L; d += 3) if (w.pathIndex.edgeDist(p[0] + ((q[0] - p[0]) * d) / L, p[1] + ((q[1] - p[1]) * d) / L, 10) < 1) onRoad++;
    if (onRoad > 4) c += 40;
    // the gate towers where roads cross must not stand on houses
    for (const g of wallLayout(w, [p, q]).gates) {
      for (const k of [-1, 1]) {
        const t = { x: g.x + Math.cos(g.rot) * k * 7, z: g.z + Math.sin(g.rot) * k * 7, hw: 3, hd: 3, rot: g.rot };
        for (const o of near(t)) if (obbOverlap(o.b, t)) c += o.cost;
      }
    }
    return c;
  };
  // shortest path round the ring (dynamic programming), starting from a ray that meets the river (one
  // corner only there), else from the first plan's distance
  const k0 = Math.max(0, river.findIndex((r) => r !== null));
  const r0 = river[k0] ?? 1.05;
  let prev = new Map([[r0, { cost: 0, path: [r0] }]]);
  for (let j = 1; j <= STEPS; j++) {
    const k = (k0 + j) % STEPS, kp = (k0 + j - 1) % STEPS;
    const next = new Map();
    for (const r of j === STEPS ? [r0] : cands[k]) {
      const q = rayPoint(k, r);
      let pick = null;
      for (const [rp, v] of prev) {
        const c = v.cost + edgeCost(rayPoint(kp, rp), q) + Math.abs(r - 1.05) * 4 + Math.abs(r - rp) * 6;
        if (!pick || c < pick.cost) pick = { cost: c, path: [...v.path, r] };
      }
      next.set(r, pick);
    }
    prev = next;
  }
  const best = prev.get(r0);
  const ring = best.path.slice(0, STEPS).map((r, j) => rayPoint((k0 + j) % STEPS, r));
  // open the ring where it follows the river: from the bank, round the town, back to the bank
  const n = ring.length;
  let start = ring.findIndex((p, i) => !wet(p) && wet(ring[(i + n - 1) % n]));
  let route;
  if (start < 0) route = [...ring, ring[0]];
  else {
    route = [];
    for (let k = 0; k <= n; k++) {
      const p = ring[(start - 1 + k + n) % n];
      route.push(p);
      if (k > 1 && wet(p)) break;
    }
    route[0] = toBank(w, route[1], route[0]);
    route[route.length - 1] = toBank(w, route.at(-2), route.at(-1));
  }
  // corners in a straight line are one side of the wall
  const straight = [route[0]];
  for (let i = 1; i < route.length - 1; i++) {
    const a = straight.at(-1), b = route[i + 1], p = route[i];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    if (Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / (Math.hypot(dx, dz) || 1) > 1.5) straight.push(p);
  }
  straight.push(route.at(-1));
  return { day: state.day, pts: straight.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]) };
}

/**
 * True when (x, z) lies inside the Second Wall (its route, closed by the river). The route's corners stand
 * on rays from the town centre, so a point is inside when it is nearer the centre than the wall on its own
 * ray; on the river side, where there is no wall, inside the first plan's ellipse.
 */
export function insideWall2(pts, x, z, margin = 0.03) {
  const polar = ([px, pz]) => {
    const u = (px - C.x) / C.rx, v = (pz - C.z) / C.rz;
    return [Math.atan2(v, u), Math.hypot(u, v)];
  };
  const [a, r] = polar([x, z]);
  for (let i = 0; i < pts.length - 1; i++) {
    const [a0, r0] = polar(pts[i]), [a1, r1] = polar(pts[i + 1]);
    let span = a1 - a0, off = a - a0;
    span -= Math.round(span / (2 * Math.PI)) * 2 * Math.PI;
    off -= Math.round(off / (2 * Math.PI)) * 2 * Math.PI;
    if (span === 0 || off / span < 0 || off / span > 1) continue;
    return r < r0 + (r1 - r0) * (off / span) - margin;
  }
  return r < 1;
}

function toBank(w, from, to) {
  const L = Math.hypot(to[0] - from[0], to[1] - from[1]);
  for (let d = 0; d <= L; d += 0.5) {
    const p = [from[0] + ((to[0] - from[0]) * d) / L, from[1] + ((to[1] - from[1]) * d) / L];
    if (w.river.dist(p[0], p[1]) < BANK) return p;
  }
  return to;
}

// the roads and tracks in a grid, for the crossings
const PATHS = new WeakMap();
function pathSegs(w) {
  if (!PATHS.has(w)) {
    const g = new SpatialHash(40);
    for (const s of w.pathIndex.segs) g.insert([Math.min(s.ax, s.bx), Math.min(s.az, s.bz), Math.max(s.ax, s.bx), Math.max(s.az, s.bz)], s);
    PATHS.set(w, g);
  }
  return PATHS.get(w);
}

function segIntersect(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

/**
 * The pieces of the wall along a route: { pieces: [obb], towers: [[x, z]], gates: [{ x, z, rot }] }.
 * A gate where a road or track crosses it, square to the road (owner 2026-10-21: rot is the line through
 * its two towers, across the road), a tower at each corner (none right next to a gate), nothing over the
 * water. The wall runs into the gate towers, so where a road crosses at a slant it turns there.
 */
export function wallLayout(w, route) {
  const pieces = [], towers = [], gates = [];
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i], b = route[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.5) continue;
    const dir = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], rot = Math.atan2(dir[1], dir[0]);
    // road crossings along this side (one gate for crossings close together)
    const cross = [];
    for (const sg of pathSegs(w).query([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])])) {
      const t = segIntersect(a, b, [sg.ax, sg.az], [sg.bx, sg.bz]);
      if (t !== null && !cross.some((c) => Math.abs(c.d - t * L) < 2 * GATE_HALF + 6)) cross.push({ d: t * L, road: Math.atan2(sg.bz - sg.az, sg.bx - sg.ax) });
    }
    cross.sort((x, y) => x.d - y.d);
    // the stretches between the gates (from tower to tower), in pieces, none on the water
    let from = a;
    const spans = [];
    for (const { d, road } of cross) {
      // across the road, turned the way of the wall (the first tower is the one nearer a)
      let g = road + Math.PI / 2;
      g -= Math.round((g - rot) / Math.PI) * Math.PI;
      const gate = { x: a[0] + dir[0] * d, z: a[1] + dir[1] * d, rot: g };
      gates.push(gate);
      const [t0, t1] = [-1, 1].map((k) => [gate.x + Math.cos(g) * k * 7, gate.z + Math.sin(g) * k * 7]);
      spans.push([from, t0]);
      from = t1;
    }
    spans.push([from, b]);
    for (const [p, q] of spans) {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (len < 1) continue;
      const k = Math.ceil(len / PIECE);
      for (let j = 0; j < k; j++) {
        const p0 = [p[0] + ((q[0] - p[0]) * j) / k, p[1] + ((q[1] - p[1]) * j) / k];
        const p1 = [p[0] + ((q[0] - p[0]) * (j + 1)) / k, p[1] + ((q[1] - p[1]) * (j + 1)) / k];
        const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        if (w.river.dist(mid[0], mid[1]) < BANK - 2) continue;
        pieces.push(segmentObb(p0[0], p0[1], p1[0], p1[1], 2));
      }
    }
    // a tower where the wall turns
    if (i > 0 && !gates.some((g) => Math.hypot(g.x - a[0], g.z - a[1]) < GATE_HALF + 6) && w.river.dist(a[0], a[1]) > BANK + 2) towers.push([a[0], a[1]]);
  }
  return { pieces, towers, gates };
}

/** True when a piece of the wall stands on a field or a building lot. */
export function crossesFields(w, route) {
  const { pieces } = wallLayout(w, route);
  const lots = Object.values(w.lots).filter((l) => !l.virtual && l.hw > 0 && l.id !== 'fields');
  return [...w.fields, ...lots].some((f) => pieces.some((p) => obbOverlap(p, f)));
}

/** Boxes a house plot must keep clear of (pieces, towers and gate towers, with room round them). */
export function wallBlockers(w, route) {
  const { pieces, towers, gates } = wallLayout(w, route);
  const out = pieces.map((s) => grow(s, 3));
  for (const [x, z] of towers) out.push({ x, z, hw: 7, hd: 7, rot: 0 });
  for (const g of gates) for (const k of [-1, 1]) out.push({ x: g.x + Math.cos(g.rot) * k * 7, z: g.z + Math.sin(g.rot) * k * 7, hw: 5, hd: 5, rot: g.rot });
  return out;
}
