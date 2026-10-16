// Everything that moves: villagers on non-intersecting walking loops, guards on the walls, smoke,
// banners and flags, torches, birds, boats, windmill sails, rain/snow. All a pure function of time t.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt, CASTLE } from '../../sim/world.js';
import { rand01 } from '../../sim/prng.js';
import { JOBS } from '../../sim/tiers.js';
import { softSprite, ROYAL } from './textures.js';
import { cylGeo, boxGeo } from './kit.js';

const WALK = 1.25; // m/s
const SPACING = 3.2; // m between walkers in one lane loop
const LANE = 1.5; // offset from the path centre line

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

function personGeo() {
  const parts = [
    cylGeo(0.2, 0.3, 1.05, 8).translate(0, 0.95, 0),
    cylGeo(0.09, 0.11, 0.5, 6).translate(-0.1, 0.25, 0),
    cylGeo(0.09, 0.11, 0.5, 6).translate(0.1, 0.25, 0),
    cylGeo(0.07, 0.08, 0.6, 6).translate(-0.3, 1.05, 0),
    cylGeo(0.07, 0.08, 0.6, 6).translate(0.3, 1.05, 0),
  ].map((g) => { const q = g.toNonIndexed(); q.deleteAttribute('uv'); return q; });
  return mergeGeometries(parts);
}
function headGeo() {
  const h = new THREE.SphereGeometry(0.19, 10, 8).translate(0, 1.66, 0).toNonIndexed();
  h.deleteAttribute('uv');
  return h;
}

export function buildLife(w, state, M, castle, houses, buildings, opts = {}) {
  const seed = state.seed;
  const group = new THREE.Group();
  const updaters = [];
  const pop = state.subscriberCount;

  // ------------------------------------------------ walkers on separated loops
  const yFn = (x, z) => heightAt(w, x, z) + 0.05;
  const loops = [];
  const roadsWithHouses = new Set(state.plots.map((p) => p.road));
  for (const rd of w.roads) {
    if (!roadsWithHouses.has(rd.id) && rd.id !== 'main') continue;
    // keep each loop on its own stretch: side streets stop before the main road and the first cross street
    let pts = rd.pts;
    if (rd.id === 'main') {
      const maxX = Math.max(140, ...state.plots.filter((p) => p.road === 'main').map((p) => p.x + 10));
      pts = pts.filter((p) => p[0] <= maxX && p[0] >= CASTLE.moatOuter + 6);
    } else if (rd.id.startsWith('side')) {
      pts = pts.filter((p, i) => i * 10 > 10 && i * 10 < 150);
    } else continue; // cross streets: no walkers (their crossings would intersect other loops)
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
  bodyIm.count = headIm.count = walkers.length;
  walkers.forEach((wk, i) => {
    const v = state.villagers[wk.villager % Math.max(1, state.villagers.length)];
    bodyIm.setColorAt(i, new THREE.Color(v ? JOBS[v.job]?.color || '#777' : '#777'));
  });
  bodyIm.castShadow = headIm.castShadow = true;
  bodyIm.frustumCulled = headIm.frustumCulled = false;
  group.add(bodyIm, headIm);
  const P = { x: 0, y: 0, z: 0, dir: 0 }, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  updaters.push((t) => {
    walkers.forEach((wk, i) => {
      loops[wk.loop].at(wk.s0 + t * WALK, P);
      const bob = Math.abs(Math.sin(t * 7 + i)) * 0.06;
      m4.compose(v3.set(P.x, P.y + bob, P.z), q.setFromEuler(e.set(0, -P.dir + Math.PI / 2, Math.sin(t * 7 + i) * 0.04)), one);
      bodyIm.setMatrixAt(i, m4); headIm.setMatrixAt(i, m4);
    });
    bodyIm.instanceMatrix.needsUpdate = headIm.instanceMatrix.needsUpdate = true;
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
    smokeMat.uniforms.scale.value = 1920 / (2 * Math.tan((env.camera.fov * Math.PI) / 360));
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
          p.setZ(i, Math.sin(t * 2.1 + by * 0.9 + c.ph) * 0.18 * k + Math.sin(t * 3.3 + bx * 2 + c.ph) * 0.05 * k);
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
    updaters.push((t) => { sails.rotation.z = -t * 0.9; });
  }
  for (const b of buildings.boats) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(b.len * 0.18, b.len * 0.12, b.len, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2), M.woodDark);
    hull.scale.set(1, 0.55, 1);
    g.add(hull);
    if (b.sail) {
      const mast = new THREE.Mesh(cylGeo(0.12, 0.15, b.len * 0.8, 6).translate(0, b.len * 0.4, 0), M.woodDark);
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(b.len * 0.45, b.len * 0.45).translate(0, b.len * 0.45, 0.2), M.sail);
      sail.rotation.y = Math.PI / 2;
      g.add(mast, sail);
    }
    g.position.copy(b.pos).setY(0.55);
    g.rotation.y = -b.rot + Math.PI / 2;
    g.traverse((o) => { o.castShadow = true; });
    group.add(g);
    const ph = b.pos.x * 0.1;
    updaters.push((t) => { g.position.y = 0.55 + Math.sin(t * 1.3 + ph) * 0.08; g.rotation.z = Math.sin(t * 0.9 + ph) * 0.03; });
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
    hideSmoke(i) { hidden.add(i); },
    update(t, env) { for (const u of updaters) u(t, env); },
  };
}
