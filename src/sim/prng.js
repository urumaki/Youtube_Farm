// Seeded randomness. Simulation and render code must use these, never Math.random().

/** 32-bit hash of any mix of strings and numbers (cyrb53-style mixing). */
export function hash(...parts) {
  let h1 = 0xdeadbeef ^ parts.length;
  let h2 = 0x41c6ce57;
  for (const p of parts) {
    const s = typeof p === 'number' ? numKey(p) : String(p);
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ 0x2f, 2246822507); // separator so ("ab","c") != ("a","bc")
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

function numKey(n) {
  return Number.isInteger(n) ? 'i' + n : 'f' + n.toPrecision(17);
}

/** mulberry32 generator with helpers. */
export function rng(...seedParts) {
  let a = hash(...seedParts);
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    float: (lo = 0, hi = 1) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), // inclusive
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    weighted(items, weightOf = (x) => x.weight) {
      let total = 0;
      for (const it of items) total += weightOf(it);
      let r = next() * total;
      for (const it of items) {
        r -= weightOf(it);
        if (r < 0) return it;
      }
      return items[items.length - 1];
    },
  };
}

/** Stateless uniform in [0,1) for (seed, ...keys). */
export function rand01(...parts) {
  return hash(...parts) / 4294967296;
}
