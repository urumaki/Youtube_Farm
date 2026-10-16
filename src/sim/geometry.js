// 2D helpers on the ground plane (x = east, z = south). Oriented boxes: {x, z, hw, hd, rot}.

export function obbCorners(b) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  const pts = [];
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const lx = u * b.hw, lz = v * b.hd;
    pts.push([b.x + lx * c - lz * s, b.z + lx * s + lz * c]);
  }
  return pts;
}

/** Separating-axis test between two oriented boxes. Touching edges do not count as overlap. */
export function obbOverlap(a, b) {
  const ca = obbCorners(a), cb = obbCorners(b);
  for (const r of [a.rot, a.rot + Math.PI / 2, b.rot, b.rot + Math.PI / 2]) {
    const ax = Math.cos(r), az = Math.sin(r);
    let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
    for (const [x, z] of ca) { const p = x * ax + z * az; if (p < minA) minA = p; if (p > maxA) maxA = p; }
    for (const [x, z] of cb) { const p = x * ax + z * az; if (p < minB) minB = p; if (p > maxB) maxB = p; }
    if (maxA <= minB + 1e-9 || maxB <= minA + 1e-9) return false;
  }
  return true;
}

export function obbAabb(b) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of obbCorners(b)) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  return [x0, z0, x1, z1];
}

export function grow(b, m) {
  return { ...b, hw: b.hw + m, hd: b.hd + m };
}

export function pointInObb(b, x, z) {
  const c = Math.cos(-b.rot), s = Math.sin(-b.rot);
  const dx = x - b.x, dz = z - b.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) <= b.hw && Math.abs(lz) <= b.hd;
}

export function segmentObb(ax, az, bx, bz, halfWidth) {
  const dx = bx - ax, dz = bz - az;
  return { x: (ax + bx) / 2, z: (az + bz) / 2, hw: Math.hypot(dx, dz) / 2, hd: halfWidth, rot: Math.atan2(dz, dx) };
}

export function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1e-12;
  let t = ((px - ax) * dx + (pz - az) * dz) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/** Uniform-grid spatial hash over AABBs. */
export class SpatialHash {
  constructor(cell = 40) { this.cell = cell; this.map = new Map(); }
  _keys([x0, z0, x1, z1]) {
    const c = this.cell, out = [];
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) out.push(i * 73856093 ^ j * 19349663);
    return out;
  }
  insert(aabb, item) {
    for (const k of this._keys(aabb)) {
      let a = this.map.get(k);
      if (!a) this.map.set(k, (a = []));
      a.push(item);
    }
  }
  query(aabb) {
    const seen = new Set();
    for (const k of this._keys(aabb)) for (const it of this.map.get(k) || []) seen.add(it);
    return seen;
  }
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;
