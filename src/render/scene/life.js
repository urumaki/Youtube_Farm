// Everything that moves: villagers on non-intersecting walking loops, guards on the walls, smoke,
// banners and flags, torches, birds, boats, windmill sails, rain/snow. All a pure function of time t.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt, CASTLE, polyline, WATER_LEVEL } from '../../sim/world.js';
import { rand01 } from '../../sim/prng.js';
import { JOBS } from '../../sim/tiers.js';
import { softSprite, ROYAL } from './textures.js';
import { cylGeo, boxGeo } from './kit.js';

const WALK = 1.25; // m/s
const SPACING = 3.2; // m between walkers in one lane loop
const LANE = 1.5; // offset from the path centre line

// one material for every hull: planks coloured per vertex, seen from inside too (the deck is open)
let hullMat = null;

/**
 * A wooden ship (a cog) or, without a sail, a small boat; the bow at +z, the deck at y = 0.
 * The hull is lofted from U-shaped cross sections: pointed at the bow, fuller at the stern, the sheer
 * rising toward both ends and the keel curving up into the stem and stern posts.
 * float: how far the deck stands above the water.
 */
function ship(M, len, sail) {
  hullMat ??= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const big = sail && len >= 10;
  const W = len * (sail ? 0.15 : 0.17), D = len * 0.12, H0 = len * 0.035, RISE = len * (big ? 0.05 : 0.035);
  const N = 20, K = 12;
  const width = (u) => W * Math.pow(Math.max(0, 1 - Math.abs(u) ** 2.2), u > 0 ? 0.8 : 0.45);
  const top = (u) => H0 + RISE * u * u;
  const keel = (u) => { const e = Math.abs(u) ** 3; return -D * (1 - e) + top(u) * e; };
  const plank = [new THREE.Color('#5b412c'), new THREE.Color('#654933')], wale = new THREE.Color('#2f2219'), rail = new THREE.Color('#8a6a48'), tar = new THREE.Color('#1f1a17');
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * 2 - 1, z = (u * len) / 2, w = width(u) + 0.02, yt = top(u), yk = keel(u);
    for (let j = 0; j <= K; j++) {
      const a = -Math.PI / 2 + (Math.PI * j) / K, c = Math.cos(a);
      const f = Math.pow(c, 0.55); // 0 at the gunwale, 1 at the keel: a full, round section
      const y = yt - (yt - yk) * f;
      pos.push(w * Math.sin(a), y, z);
      // the top strake lighter, a dark wale below it, tarred planks under the waterline
      const depth = (yt - y) / Math.max(0.01, yt - yk);
      col.push(...(depth < 0.08 ? rail : depth < 0.16 ? wale : y < -D * 0.45 ? tar : plank[Math.floor(depth * 9) % 2]).toArray());
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < K; j++) {
    const a = i * (K + 1) + j, b = a + K + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const hull = new THREE.BufferGeometry();
  hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hull.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  hull.setIndex(idx);
  hull.computeVertexNormals();
  g.add(new THREE.Mesh(hull, hullMat));
  // the deck: planks across the hull a little below the gunwale
  const deckY = H0 - len * 0.025, dpos = [], didx = [];
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * 2 - 1, w = width(u) * 0.96 * Math.max(0, Math.min(1, (deckY - keel(u)) / (top(u) - keel(u)) * 1.3));
    dpos.push(-w, deckY, (u * len) / 2, w, deckY, (u * len) / 2);
    if (i < N) didx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  }
  const deck = new THREE.BufferGeometry();
  deck.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
  deck.setIndex(didx);
  deck.computeVertexNormals();
  g.add(new THREE.Mesh(deck, M.wood));
  const add = (geo, m) => { const o = new THREE.Mesh(geo, m); g.add(o); return o; };
  // stem and stern posts, the rudder hung on the stern post
  add(boxGeo(0.12 + len * 0.008, top(1) - keel(0.92) + len * 0.03, 0.2).translate(0, (top(1) + keel(0.92)) / 2 + len * 0.015, len / 2 - 0.05), M.woodDark);
  add(boxGeo(0.12 + len * 0.008, top(-1) - keel(-0.92), 0.2).translate(0, (top(-1) + keel(-0.92)) / 2, -len / 2 + 0.05), M.woodDark);
  if (sail) {
    add(boxGeo(0.1, D * 0.9, len * 0.07).translate(0, -D * 0.2, -len / 2 - len * 0.035), M.woodDark); // rudder
    // castles fore and aft with a rail of posts; the aft one higher, as on a cog
    const castle = (u, l, h) => {
      const z = (u * len) / 2, w = width(u) * 1.02, y = top(u);
      add(boxGeo(w * 2, h + (y - deckY), l).translate(0, (y + h + deckY) / 2, z), M.wood); // planked all round
      add(boxGeo(w * 2 + 0.1, 0.1, l + 0.1).translate(0, y + h, z), M.woodDark);
      for (const s of [-1, 1]) {
        add(boxGeo(0.08, 0.5, l).translate(s * (w - 0.04), y + h + 0.3, z), M.woodDark);
        for (let k = 0; k <= 3; k++) add(boxGeo(0.1, 0.55, 0.1).translate(s * (w - 0.04), y + h + 0.27, z - l / 2 + (k * l) / 3), M.woodDark);
      }
      add(boxGeo(w * 2, 0.5, 0.08).translate(0, y + h + 0.3, z + (u > 0 ? -l / 2 : l / 2)), M.woodDark);
    };
    if (big) { castle(-0.78, len * 0.2, len * 0.09); castle(0.8, len * 0.13, len * 0.06); }
    // one mast amidships, a yard with a square sail full of wind, a bowsprit
    const mh = len * (big ? 1.0 : 0.85);
    add(cylGeo(0.1 + len * 0.006, 0.14 + len * 0.008, mh, 8).translate(0, deckY + mh / 2, len * 0.05), M.woodDark);
    add(cylGeo(0.3 + len * 0.01, 0.25 + len * 0.01, 0.5, 8).translate(0, deckY + mh, len * 0.05), M.wood); // the top
    const sw = len * 0.55, sh = mh * 0.55, sy = deckY + mh * 0.38;
    add(cylGeo(0.07, 0.07, sw * 1.12, 6).rotateZ(Math.PI / 2).translate(0, sy + sh, len * 0.05), M.woodDark);
    const cloth = new THREE.PlaneGeometry(sw, sh, 8, 6);
    const cp = cloth.attributes.position;
    for (let v = 0; v < cp.count; v++) {
      const x = cp.getX(v) / (sw / 2), y = cp.getY(v) / (sh / 2);
      cp.setZ(v, len * 0.05 * (1 - x * x) * (1 - 0.4 * (y + 1) * (y + 1) / 4) + len * 0.01); // bellied forward
    }
    cloth.computeVertexNormals();
    add(cloth.translate(0, sy + sh / 2, len * 0.05 + 0.15), M.sail);
    add(cylGeo(0.05, 0.08, len * 0.28, 6).rotateX(Math.PI / 2 - 0.35).translate(0, top(1) + len * 0.05, len / 2 + len * 0.1), M.woodDark);
  } else {
    // a rowing boat: two thwarts, oars shipped along the sides
    for (const z of [-0.15, 0.2]) add(boxGeo(width(z * 2) * 1.9, 0.06, 0.28).translate(0, deckY + 0.12, z * len), M.woodDark);
    for (const s of [-1, 1]) add(cylGeo(0.03, 0.03, len * 0.75, 6).rotateX(Math.PI / 2).translate(s * W * 0.7, deckY + 0.2, 0), M.wood);
  }
  return { g, float: D * 0.45 };
}

/** Closed loop: up the right lane, U-turn, back down the left lane. Returns arc-length sampler. */
function laneLoop(pts, lane, w, yFn) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const nx = -Math.sin(ang), nz = Math.cos(ang);
    R.push([pts[i][0] + nx * lane, pts[i][1] + nz * lane]);
    L.push([pts[i][0] - nx * lane, pts[i][1] - nz * lane]);
  }
  const loop = [...R, ...L.reverse()];
  loop.push(loop[0]);
  const acc = [0];
  for (let i = 1; i < loop.length; i++) acc.push(acc[i - 1] + Math.hypot(loop[i][0] - loop[i - 1][0], loop[i][1] - loop[i - 1][1]));
  const total = acc.at(-1);
  const ys = loop.map(([x, z]) => yFn(x, z));
  return {
    total,
    at(s, out) {
      s = ((s % total) + total) % total;
      let lo = 0, hi = acc.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (acc[mid] <= s) lo = mid; else hi = mid; }
      const t = (s - acc[lo]) / (acc[hi] - acc[lo] || 1);
      out.x = loop[lo][0] + (loop[hi][0] - loop[lo][0]) * t;
      out.z = loop[lo][1] + (loop[hi][1] - loop[lo][1]) * t;
      out.y = ys[lo] + (ys[hi] - ys[lo]) * t;
      out.dir = Math.atan2(loop[hi][1] - loop[lo][1], loop[hi][0] - loop[lo][0]);
      return out;
    },
  };
}

const flat = (g) => { const q = g.index ? g.toNonIndexed() : g; q.deleteAttribute('uv'); return q; };
/** Tunic, shoulders and sleeves: tinted per instance by the villager's job. */
function personGeo() {
  const sleeve = (sx) => cylGeo(0.075, 0.095, 0.62, 8).rotateZ(sx * 0.16).translate(sx * 0.29, 1.12, 0);
  return mergeGeometries([
    cylGeo(0.19, 0.33, 0.9, 12).translate(0, 0.98, 0),                          // flared tunic
    new THREE.SphereGeometry(0.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.25, 0.5, 0.85).translate(0, 1.42, 0), // shoulders
    sleeve(-1), sleeve(1),
  ].map(flat));
}
/** Legs, shoes, belt, hands and a hood/cap in dark cloth and leather. */
function gearGeo() {
  return mergeGeometries([
    cylGeo(0.075, 0.085, 0.58, 6).translate(-0.09, 0.29, 0), cylGeo(0.075, 0.085, 0.58, 6).translate(0.09, 0.29, 0),
    boxGeo(0.13, 0.08, 0.24).translate(-0.09, 0.04, 0.04), boxGeo(0.13, 0.08, 0.24).translate(0.09, 0.04, 0.04),
    cylGeo(0.235, 0.24, 0.07, 12).translate(0, 1.08, 0),                         // belt
    boxGeo(0.07, 0.05, 0.03).translate(0, 1.08, 0.24),                           // buckle
    cylGeo(0.215, 0.2, 0.09, 12).translate(0, 1.79, 0),                          // cap band
    new THREE.ConeGeometry(0.2, 0.26, 12).translate(0, 1.96, 0),                  // cap crown
  ].map(flat));
}
function headGeo() {
  return mergeGeometries([
    new THREE.SphereGeometry(0.17, 12, 10).scale(1, 1.1, 1).translate(0, 1.66, 0),
    cylGeo(0.07, 0.08, 0.12, 8).translate(0, 1.5, 0),                            // neck
    new THREE.SphereGeometry(0.06, 8, 6).translate(-0.33, 0.8, 0), new THREE.SphereGeometry(0.06, 8, 6).translate(0.33, 0.8, 0), // hands
  ].map(flat));
}

export function buildLife(w, state, M, castle, houses, buildings, opts = {}) {
  const seed = state.seed;
  const group = new THREE.Group();
  const updaters = [];
  const pop = state.subscriberCount;

  // ------------------------------------------------ walkers on separated loops
  const yFn = (x, z) => heightAt(w, x, z) + 0.05;
  const loops = [];
  // One closed loop per street that has houses, trimmed 16 m from both ends so loops never meet at
  // junctions (streets never cross each other, see tests/world.test.js).
  const roadsWithHouses = new Set(state.plots.map((p) => p.road));
  for (const rd of w.roads) {
    if (!roadsWithHouses.has(rd.id) && rd.id !== 'east') continue;
    const pl = polyline(rd.pts);
    if (pl.total < 50) continue;
    const pts = [];
    for (let sv = 16; sv <= pl.total - 16; sv += 6) { const [x, z] = pl.at(sv); pts.push([x, z]); }
    if (pts.length < 3) continue;
    loops.push(laneLoop(pts, LANE, w, yFn));
  }
  loops.push(laneLoop(castle.courtyardLoop.map(([x, , z]) => [x, z]).concat([castle.courtyardLoop[0]].map(([x, , z]) => [x, z])), 0.01, w, () => CASTLE.ground + 0.17));

  // Walkers per loop proportional to its length, evenly spaced (>= SPACING) and all moving at the
  // same speed, so no two ever touch; loops never cross each other.
  const walkers = [];
  const capacity = loops.map((l) => Math.floor(l.total / SPACING));
  const totalLen = loops.reduce((a, l) => a + l.total, 0);
  const want = Math.min(pop + 4, 420);
  loops.forEach((l, li) => {
    const n = Math.min(capacity[li], Math.round((want * l.total) / totalLen));
    for (let j = 0; j < n; j++) walkers.push({ loop: li, s0: (j * l.total) / n, villager: walkers.length });
  });
  const bodyIm = new THREE.InstancedMesh(personGeo(), M.people, Math.max(1, walkers.length));
  const headIm = new THREE.InstancedMesh(headGeo(), M.skin, Math.max(1, walkers.length));
  const gearIm = new THREE.InstancedMesh(gearGeo(), M.gear, Math.max(1, walkers.length));
  bodyIm.count = headIm.count = gearIm.count = walkers.length;
  walkers.forEach((wk, i) => {
    const v = state.villagers[wk.villager % Math.max(1, state.villagers.length)];
    bodyIm.setColorAt(i, new THREE.Color(v ? JOBS[v.job]?.color || '#777' : '#777'));
  });
  bodyIm.castShadow = headIm.castShadow = gearIm.castShadow = true;
  bodyIm.frustumCulled = headIm.frustumCulled = gearIm.frustumCulled = false;
  group.add(bodyIm, headIm, gearIm);
  const P = { x: 0, y: 0, z: 0, dir: 0 }, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  updaters.push((t) => {
    walkers.forEach((wk, i) => {
      loops[wk.loop].at(wk.s0 + t * WALK, P);
      const bob = Math.abs(Math.sin(t * 7 + i)) * 0.06;
      m4.compose(v3.set(P.x, P.y + bob, P.z), q.setFromEuler(e.set(0, -P.dir + Math.PI / 2, Math.sin(t * 7 + i) * 0.04)), one);
      bodyIm.setMatrixAt(i, m4); headIm.setMatrixAt(i, m4); gearIm.setMatrixAt(i, m4);
    });
    bodyIm.instanceMatrix.needsUpdate = headIm.instanceMatrix.needsUpdate = gearIm.instanceMatrix.needsUpdate = true;
  });

  // ------------------------------------------------ guards: one per lane per wall stretch, ping-pong
  const guardCount = state.unlockedTiers.includes('guard') ? Math.min(10, Math.max(2, state.villagers.filter((v) => v.job === 'guard').length)) : 0;
  const guards = [];
  for (let i = 0; i < guardCount; i++) {
    const walk = castle.guardWalks[i % castle.guardWalks.length];
    guards.push({ walk, lane: i < castle.guardWalks.length ? -0.7 : 0.7, phase: rand01(seed, 'g', i) * 20 });
  }
  const gBody = new THREE.InstancedMesh(personGeo(), M.people, Math.max(1, guards.length + 2));
  const gHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.7, 0), M.iron, Math.max(1, guards.length + 2));
  const gSpear = new THREE.InstancedMesh(cylGeo(0.03, 0.03, 2.6, 4).translate(0.38, 1.3, 0), M.iron, Math.max(1, guards.length + 2));
  gBody.count = gHead.count = gSpear.count = guardCount ? guards.length + 2 : 0;
  for (let i = 0; i < guards.length + 2; i++) gBody.setColorAt(i, new THREE.Color(ROYAL.blue));
  gBody.frustumCulled = gHead.frustumCulled = gSpear.frustumCulled = false;
  gBody.castShadow = true;
  group.add(gBody, gHead, gSpear);
  updaters.push((t) => {
    if (!guardCount) return;
    guards.forEach((g, i) => {
      const { a, b } = g.walk;
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const s = ((t * 0.9 + g.phase) % (2 * len));
      const k = s < len ? s / len : 2 - s / len;
      const dir = Math.atan2(b[2] - a[2], b[0] - a[0]) + (s < len ? 0 : Math.PI);
      const nx = -Math.sin(Math.atan2(b[2] - a[2], b[0] - a[0])), nz = Math.cos(Math.atan2(b[2] - a[2], b[0] - a[0]));
      m4.compose(v3.set(a[0] + (b[0] - a[0]) * k + nx * g.lane, a[1], a[2] + (b[2] - a[2]) * k + nz * g.lane), q.setFromEuler(e.set(0, -dir + Math.PI / 2, 0)), one);
      gBody.setMatrixAt(i, m4); gHead.setMatrixAt(i, m4); gSpear.setMatrixAt(i, m4);
    });
    // two gate guards standing beside the passage
    [-1, 1].forEach((s, k) => {
      m4.compose(v3.set(CASTLE.half + 6.2, CASTLE.ground + 0.1, s * 4.6), q.setFromEuler(e.set(0, Math.PI / 2, 0)), one);
      gBody.setMatrixAt(guards.length + k, m4); gHead.setMatrixAt(guards.length + k, m4); gSpear.setMatrixAt(guards.length + k, m4);
    });
    gBody.instanceMatrix.needsUpdate = gHead.instanceMatrix.needsUpdate = gSpear.instanceMatrix.needsUpdate = true;
  });

  // ------------------------------------------------ smoke (chimneys + workshops)
  const sources = [
    ...houses.chimneys.map((p) => ({ pos: p, dark: false, rate: 1 })),
    ...buildings.smoke.map((s) => ({ pos: s.pos, dark: s.dark, rate: s.dark ? 1.6 : 1.2 })),
    ...(opts.extraChimneys || []),
  ].slice(0, 1600);
  const PER = 12;
  const smokeGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(sources.length * PER * 3), sSize = new Float32Array(sources.length * PER), sAlpha = new Float32Array(sources.length * PER), sDark = new Float32Array(sources.length * PER);
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  smokeGeo.setAttribute('size', new THREE.BufferAttribute(sSize, 1));
  smokeGeo.setAttribute('alpha', new THREE.BufferAttribute(sAlpha, 1));
  smokeGeo.setAttribute('dark', new THREE.BufferAttribute(sDark, 1));
  const smokeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { map: { value: softSprite() }, scale: { value: 1900 }, light: { value: new THREE.Color(1, 1, 1) } },
    vertexShader: `attribute float size; attribute float alpha; attribute float dark; varying float vA; varying float vD; uniform float scale;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; vA = alpha * smoothstep(6.0, 22.0, -mv.z); vD = dark; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 light; varying float vA; varying float vD;
      void main(){ vec4 c = texture2D(map, gl_PointCoord); vec3 col = mix(vec3(0.82,0.82,0.84), vec3(0.38,0.36,0.35), vD) * light; gl_FragColor = vec4(col, c.a * vA); }`,
  });
  const smoke = new THREE.Points(smokeGeo, smokeMat);
  smoke.frustumCulled = false;
  smoke.renderOrder = 5;
  group.add(smoke);
  const hidden = new Set();
  updaters.push((t, env) => {
    const wind = env.wind || [1, 0.3];
    sources.forEach((src, si) => {
      const off = rand01(seed, 'sm', si);
      for (let k = 0; k < PER; k++) {
        const idx = si * PER + k;
        const ph = (t * 0.16 * src.rate + k / PER + off) % 1;
        const active = !hidden.has(si) && (src.startAt === undefined || t > src.startAt + ph * 6);
        const rise = ph * 11 * (src.dark ? 1.3 : 1);
        sPos[idx * 3] = src.pos.x + wind[0] * ph * ph * 9 + Math.sin(t * 0.8 + k) * 0.3 * ph;
        sPos[idx * 3 + 1] = src.pos.y + rise;
        sPos[idx * 3 + 2] = src.pos.z + wind[1] * ph * ph * 9;
        sSize[idx] = (1.2 + ph * 5.5) * (src.dark ? 1.5 : 1);
        sAlpha[idx] = active ? Math.sin(Math.PI * Math.min(1, ph * 1.15)) * (src.dark ? 0.3 : 0.24) : 0;
        sDark[idx] = src.dark ? 1 : 0;
      }
    });
    smokeGeo.attributes.position.needsUpdate = smokeGeo.attributes.size.needsUpdate = smokeGeo.attributes.alpha.needsUpdate = true;
    smokeMat.uniforms.light.value.setScalar(1 - 0.6 * env.night);
    smokeMat.uniforms.scale.value = (env.viewportH || 1920) / (2 * Math.tan((env.camera.fov * Math.PI) / 360));
  });

  // ------------------------------------------------ cloth: banners (hanging) and flags (on poles)
  const clothList = [];
  const addCloth = (w0, h0, mat, place, hanging) => {
    const geo = new THREE.PlaneGeometry(w0, h0, 10, 12);
    const base = geo.attributes.position.array.slice();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    place(mesh);
    group.add(mesh);
    clothList.push({ mesh, base, w0, h0, hanging, ph: clothList.length * 1.7 });
  };
  for (const bn of castle.banners) addCloth(bn.w, bn.h, M.cloth, (m) => { m.position.set(bn.x, bn.y - bn.h / 2, bn.z); m.rotation.y = Math.PI / 2; }, true);
  for (const bn of buildings.banners) addCloth(bn.w, bn.h, M.cloth, (m) => { m.position.copy(bn.pos).add(new THREE.Vector3(0, -bn.h / 2, 0)); m.rotation.y = -bn.rot; }, true);
  for (const f of [...castle.flags.map((f) => ({ pos: new THREE.Vector3(f.x, f.y, f.z), size: f.size, kind: f.kind })), ...buildings.flags]) {
    const mat = f.kind === 'pennant' ? M.clothRed : M.cloth;
    addCloth(f.size[0], f.size[1], mat, (m) => { m.position.copy(f.pos).add(new THREE.Vector3(f.size[0] / 2, -f.size[1] / 2, 0)); }, false);
  }
  updaters.push((t) => {
    for (const c of clothList) {
      const p = c.mesh.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const bx = c.base[i * 3], by = c.base[i * 3 + 1];
        if (c.hanging) {
          const k = (c.h0 / 2 - by) / c.h0; // 0 at top
          // local +Z points away from the wall: billow outward only, never into the masonry
          p.setZ(i, 0.04 + k * (0.16 * (0.5 + 0.5 * Math.sin(t * 2.1 + by * 0.9 + c.ph)) + 0.05 * (0.5 + 0.5 * Math.sin(t * 3.3 + bx * 2 + c.ph))));
        } else {
          const k = (bx + c.w0 / 2) / c.w0; // 0 at the pole
          p.setZ(i, Math.sin(t * 4.2 - bx * 1.6 + c.ph) * 0.35 * k + Math.sin(t * 6.1 - bx * 3 + by + c.ph) * 0.08 * k);
          p.setY(i, by - k * k * 0.15);
        }
      }
      p.needsUpdate = true;
      c.mesh.geometry.computeVertexNormals();
    }
  });

  // ------------------------------------------------ torches & lamps: flames + a few real lights
  const flamePts = [...castle.torches.map((p) => new THREE.Vector3(p.x, p.y, p.z)), ...buildings.lights.map((l) => l.pos)];
  const flameIm = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.5, 6).translate(0, 0.25, 0), M.flame, Math.max(1, flamePts.length));
  flameIm.count = flamePts.length;
  flameIm.frustumCulled = false;
  const brackets = new THREE.InstancedMesh(boxGeo(0.12, 0.6, 0.12), M.iron, Math.max(1, flamePts.length));
  brackets.count = flamePts.length;
  flamePts.forEach((p, i) => brackets.setMatrixAt(i, m4.makeTranslation(p.x, p.y - 0.3, p.z)));
  group.add(flameIm, brackets);
  const glowMat = new THREE.SpriteMaterial({ map: softSprite('rgba(255,190,90,1)', 'rgba(255,120,30,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const glows = flamePts.map((p) => { const s = new THREE.Sprite(glowMat); s.position.copy(p).add(new THREE.Vector3(0, 0.3, 0)); group.add(s); return s; });
  const pl = flamePts.slice(0, 6).map((p) => { const l = new THREE.PointLight('#ff9a40', 0, 26, 1.6); l.position.copy(p).add(new THREE.Vector3(0.5, 0.4, 0)); group.add(l); return l; });
  updaters.push((t, env) => {
    flamePts.forEach((p, i) => {
      const f = 1 + 0.18 * Math.sin(t * 13 + i * 2.1) + 0.1 * Math.sin(t * 23 + i);
      m4.compose(v3.copy(p), q.identity(), new THREE.Vector3(f * 0.9, f, f * 0.9));
      flameIm.setMatrixAt(i, m4);
      glows[i].scale.setScalar((0.9 + 2.6 * env.night) * f);
      glows[i].material.opacity = 0.25 + 0.75 * env.night;
    });
    flameIm.instanceMatrix.needsUpdate = true;
    pl.forEach((l, i) => { l.intensity = env.night * 60 * (1 + 0.15 * Math.sin(t * 11 + i * 3)); });
  });

  // ------------------------------------------------ windmill sails, boats
  for (const s of buildings.sails) {
    const hub = new THREE.Group();
    hub.position.copy(s.pos);
    hub.rotation.y = -s.rot;
    const sails = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Mesh(boxGeo(0.25, s.len, 0.2).translate(0, s.len / 2, 0), M.woodDark);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, s.len * 0.8).translate(1.0, s.len * 0.55, 0.05), M.sail);
      const a = new THREE.Group(); a.add(arm, cloth); a.rotation.z = (k * Math.PI) / 2;
      arm.castShadow = cloth.castShadow = true;
      sails.add(a);
    }
    hub.add(sails);
    group.add(hub);
    updaters.push((t) => { sails.rotation.z = -t * 0.9 - (s.extra?.(t) ?? 0); }); // `extra`: a gale (stories/windmill.js)
  }
  for (const b of buildings.boats) {
    const { g, float } = ship(M, b.len, b.sail);
    const y0 = WATER_LEVEL + float;
    g.position.copy(b.pos).setY(y0);
    g.rotation.y = -b.rot + Math.PI; // the bow along the lot's length, as before
    g.traverse((o) => { o.castShadow = true; });
    group.add(g);
    const ph = b.pos.x * 0.1;
    updaters.push((t) => { g.position.y = y0 + Math.sin(t * 1.3 + ph) * 0.06; g.rotation.z = Math.sin(t * 0.9 + ph) * 0.025; g.rotation.x = Math.sin(t * 0.7 + ph) * 0.01; });
  }

  // ------------------------------------------------ birds
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.6, 0.15, 0.5, 0, 0, 0.15, 0, 0, 0, 0, 0, 0.15, 0.6, 0.15, 0.5], 3));
  birdGeo.computeVertexNormals();
  const NB = 34;
  const birds = new THREE.InstancedMesh(birdGeo, new THREE.MeshBasicMaterial({ color: '#202020', side: THREE.DoubleSide }), NB);
  birds.frustumCulled = false;
  group.add(birds);
  updaters.push((t) => {
    for (let i = 0; i < NB; i++) {
      const flock = i % 3, k = Math.floor(i / 3);
      const cx = [40, 220, -60][flock], cz = [-60, 40, 120][flock], r = [90, 140, 70][flock];
      const a = t * (0.09 + flock * 0.02) + flock * 2 - k * 0.025;
      const x = cx + Math.cos(a) * r - Math.sin(a) * (k % 2 ? 1 : -1) * k * 1.4, z = cz + Math.sin(a) * r * 0.7 + Math.cos(a) * (k % 2 ? 1 : -1) * k * 1.4;
      const y = 48 + flock * 9 + Math.sin(t * 0.7 + k) * 2;
      const flap = 0.4 + 0.6 * Math.abs(Math.sin(t * 9 + k));
      m4.compose(v3.set(x, y, z), q.setFromEuler(e.set(0, -a, 0)), new THREE.Vector3(1.4, flap * 1.4, 1.4));
      birds.setMatrixAt(i, m4);
    }
    birds.instanceMatrix.needsUpdate = true;
  });

  // ------------------------------------------------ precipitation around the camera
  if (opts.weather === 'rain' || opts.weather === 'snow') {
    const snow = opts.weather === 'snow';
    const N = snow ? 5000 : 7000;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), seedv = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) seedv.set([rand01(seed, 'px', i), rand01(seed, 'py', i), rand01(seed, 'pz', i)], i * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: snow ? '#ffffff' : '#a9b8c8', size: snow ? 0.35 : 0.12, transparent: true, opacity: snow ? 0.9 : 0.55, depthWrite: false });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    group.add(pts);
    updaters.push((t, env) => {
      const c = env.camera.position, R = 70, Hh = 60, speed = snow ? 2.2 : 22;
      for (let i = 0; i < N; i++) {
        const sx = seedv[i * 3], sy = seedv[i * 3 + 1], sz = seedv[i * 3 + 2];
        const fall = (sy + (t * speed) / Hh) % 1;
        pos[i * 3] = c.x + (sx - 0.5) * 2 * R + (snow ? Math.sin(t + i) * 0.8 : -fall * 3);
        pos[i * 3 + 1] = c.y + Hh / 2 - fall * Hh;
        pos[i * 3 + 2] = c.z + (sz - 0.5) * 2 * R;
      }
      g.attributes.position.needsUpdate = true;
    });
  }

  return {
    group,
    walkers: walkers.length,
    guards: guardCount,
    smokeSources: sources,
    /** The castle's walking guards off (a wall watch shot has its own guards up there). */
    hideGuards(off) { gBody.visible = gHead.visible = gSpear.visible = !off; },
    /** Where villager `id` walks at time t (null if they have no walker). dir is smoothed over ~12 m. */
    walkerOf(id) {
      const wk = walkers.find((x) => x.villager === id);
      if (!wk) return null;
      const lp = loops[wk.loop], A = {}, B = {};
      return {
        at: (t) => { lp.at(wk.s0 + t * WALK, A); return new THREE.Vector3(A.x, A.y, A.z); },
        dir: (t) => { lp.at(wk.s0 + t * WALK - 6, A); lp.at(wk.s0 + t * WALK + 6, B); return Math.atan2(B.z - A.z, B.x - A.x); },
      };
    },
    hideSmoke(i) { hidden.add(i); },
    update(t, env) { for (const u of updaters) u(t, env); },
  };
}
