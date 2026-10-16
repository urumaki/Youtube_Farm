// Terrain (chunked rectilinear grid, finer near the castle and town), overlay map for roads/plazas, water.
import * as THREE from 'three';
import { heightAt, fbm, WATER_LEVEL, CASTLE, RIVER_HALF_WIDTH } from '../../sim/world.js';
import { rng } from '../../sim/prng.js';
import { detailTexture } from './textures.js';

export const OVERLAY_RECT = { x0: -460, z0: -1010, w: 3120, h: 1540 };

function axis(spans, min, max, coarse) {
  const out = [];
  let x = min;
  while (x < max) {
    out.push(x);
    const s = spans.find(([a, b]) => x >= a && x < b);
    x += s ? s[2] : coarse;
    for (const [a] of spans) if (out.at(-1) < a && x > a) x = a; // land exactly on span starts
  }
  out.push(max);
  return out;
}

const GRASS = [new THREE.Color('#5f7438'), new THREE.Color('#7f8648'), new THREE.Color('#4d6431'), new THREE.Color('#948f58')];
const SAND = new THREE.Color('#b8a77d'), MUD = new THREE.Color('#5a4a35'), ROCK = new THREE.Color('#7d776c'), ROCK2 = new THREE.Color('#5f5a52');

export function buildTerrain(w, { season = 'summer' } = {}) {
  const xs = axis([[-460, -200, 5], [-200, 160, 2.5], [160, 2660, 4]], -4200, 5600, 45);
  const zs = axis([[-1010, -270, 4], [-270, 270, 2.5], [270, 530, 4]], -3600, 2800, 45);
  const nx = xs.length, nz = zs.length;
  const H = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = heightAt(w, xs[i], zs[j]);
  const hAt = (i, j) => H[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))];

  const dry = season === 'summer' ? 0.25 : season === 'autumn' ? 0.55 : season === 'winter' ? 0.4 : 0.05;
  const color = new THREE.Color();
  const C = new Float32Array(nx * nz * 3);
  const N = new Float32Array(nx * nz * 3);
  const n = new THREE.Vector3();
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i, h = H[k];
      const dx = xs[Math.min(nx - 1, i + 1)] - xs[Math.max(0, i - 1)], dz = zs[Math.min(nz - 1, j + 1)] - zs[Math.max(0, j - 1)];
      n.set(-(hAt(i + 1, j) - hAt(i - 1, j)) / dx, 1, -(hAt(i, j + 1) - hAt(i, j - 1)) / dz).normalize();
      N.set([n.x, n.y, n.z], k * 3);
      const x = xs[i], z = zs[j];
      const v = (fbm(w.terrainSeed + 11, x / 90, z / 90, 3) + 1) / 2;
      const v2 = (fbm(w.terrainSeed + 17, x / 23, z / 23, 2) + 1) / 2;
      color.copy(GRASS[0]).lerp(GRASS[1], Math.min(1, v * 0.8 + dry * 0.6)).lerp(GRASS[2], (1 - v2) * 0.35).lerp(GRASS[3], dry * v2 * 0.5);
      if (h < 1.9) color.lerp(SAND, Math.min(1, (1.9 - h) / 1.1));
      if (h < WATER_LEVEL + 0.2) color.copy(MUD);
      const steep = 1 - n.y;
      if (steep > 0.12) color.lerp(h < 3 ? MUD : v2 > 0.5 ? ROCK : ROCK2, Math.min(h < 3 ? 0.6 : 1, (steep - 0.12) * 4));
      if (h > 16) color.lerp(ROCK, Math.min(0.7, (h - 16) / 30));
      C.set([color.r, color.g, color.b], k * 3);
    }
  }

  const detail = detailTexture(w.seed);
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const uniforms = {
    overlayMap: { value: null }, overlayRect: { value: new THREE.Vector4(OVERLAY_RECT.x0, OVERLAY_RECT.z0, OVERLAY_RECT.w, OVERLAY_RECT.h) },
    detailMap: { value: detail }, snow: { value: season === 'winter' ? 0 : 0 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nuniform sampler2D overlayMap;\nuniform sampler2D detailMap;\nuniform vec4 overlayRect;\nuniform float snow;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float d1 = texture2D(detailMap, vWPos.xz / 5.0).r;
        float d2 = texture2D(detailMap, vWPos.xz / 41.0).r;
        float d3 = texture2D(detailMap, vWPos.xz / 137.0 + 0.37).r;
        diffuseColor.rgb *= (0.7 + 0.6 * d1) * (0.8 + 0.4 * d2) * (0.85 + 0.3 * d3);
        vec2 ouv = (vWPos.xz - overlayRect.xy) / overlayRect.zw;
        if (ouv.x > 0.0 && ouv.x < 1.0 && ouv.y > 0.0 && ouv.y < 1.0) {
          vec4 ov = texture2D(overlayMap, ouv);
          diffuseColor.rgb = mix(diffuseColor.rgb, ov.rgb * (0.82 + 0.36 * d1), ov.a);
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.92, 0.97) * (0.9 + 0.1 * d1), snow * smoothstep(0.3, 0.6, d2 + 0.25));`);
  };
  mat.userData.uniforms = uniforms;

  const CH = 96;
  for (let j0 = 0; j0 < nz - 1; j0 += CH) {
    for (let i0 = 0; i0 < nx - 1; i0 += CH) {
      const i1 = Math.min(nx - 1, i0 + CH), j1 = Math.min(nz - 1, j0 + CH);
      const cw = i1 - i0 + 1, cd = j1 - j0 + 1;
      const pos = new Float32Array(cw * cd * 3), col = new Float32Array(cw * cd * 3), nor = new Float32Array(cw * cd * 3);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const l = (j - j0) * cw + (i - i0), k = j * nx + i;
        pos[l * 3] = xs[i]; pos[l * 3 + 1] = H[k]; pos[l * 3 + 2] = zs[j];
        col.set(C.subarray(k * 3, k * 3 + 3), l * 3);
        nor.set(N.subarray(k * 3, k * 3 + 3), l * 3);
      }
      const idx = [];
      for (let j = 0; j < cd - 1; j++) for (let i = 0; i < cw - 1; i++) {
        const a = j * cw + i, b = a + 1, c = a + cw, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setIndex(idx.length > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      group.add(m);
    }
  }
  group.userData = { material: mat, uniforms };
  return group;
}

// ---------------------------------------------------------------- overlay (roads, plazas, soil)
export function buildOverlay(w, state, scale = 0.76) {
  const W = Math.round(OVERLAY_RECT.w / scale), Hh = Math.round(OVERLAY_RECT.h / scale);
  const c = document.createElement('canvas');
  c.width = 4096; c.height = Math.round((4096 * Hh) / W);
  const sx = c.width / OVERLAY_RECT.w, sz = c.height / OVERLAY_RECT.h;
  const ctx = c.getContext('2d');
  const P = (x, z) => [(x - OVERLAY_RECT.x0) * sx, (z - OVERLAY_RECT.z0) * sz];
  const r = rng(w.seed, 'overlay');
  const stroke = (pts, width, style) => {
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((p, i) => { const [x, y] = P(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.lineWidth = width * sx; ctx.strokeStyle = style; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
  };
  const built = new Set(state.buildings.map((b) => b.id));

  // How far along each road the town has grown.
  const reach = new Map();
  for (const p of state.plots) {
    const road = w.roads.find((rd) => rd.id === p.road);
    if (!road) continue;
    let best = 0, bd = Infinity, acc = 0;
    for (let i = 1; i < road.pts.length; i++) {
      acc += Math.hypot(road.pts[i][0] - road.pts[i - 1][0], road.pts[i][1] - road.pts[i - 1][1]);
      const d = Math.hypot(road.pts[i][0] - p.x, road.pts[i][1] - p.z);
      if (d < bd) { bd = d; best = acc; }
    }
    reach.set(p.road, Math.max(reach.get(p.road) || 0, best + 14));
  }
  reach.set('main', Math.max(reach.get('main') || 0, 70));
  const clipRoad = (rd, len) => {
    const out = [rd.pts[0]];
    let acc = 0;
    for (let i = 1; i < rd.pts.length && acc < len; i++) { acc += Math.hypot(rd.pts[i][0] - rd.pts[i - 1][0], rd.pts[i][1] - rd.pts[i - 1][1]); out.push(rd.pts[i]); }
    return out;
  };
  const roads = w.roads.filter((rd) => reach.has(rd.id)).map((rd) => ({ ...rd, pts: clipRoad(rd, reach.get(rd.id)) }));
  // side streets also connect to the main road: extend them back to their start
  const tracks = w.tracks.filter((t) => t.id === 'ring' || (t.id === 'mill' && built.has('windmill')) || (t.id === 'quarry' && built.has('quarry')) || (t.id === 'saw' && (built.has('sawmill') || built.has('dock'))));
  const island = [[CASTLE.half, 0], [CASTLE.moatOuter + 2, 0]];

  // soft verges, then the dirt, then wheel ruts
  for (const t of tracks) stroke(t.pts, t.width + 2.5, 'rgba(110,98,70,0.35)');
  for (const t of tracks) stroke(t.pts, t.width, 'rgba(128,108,78,0.92)');
  for (const rd of roads) stroke(rd.pts, rd.width + 3, 'rgba(105,92,66,0.4)');
  stroke(island, 9, 'rgba(105,92,66,0.4)');
  for (const rd of roads) stroke(rd.pts, rd.width, rd.kind === 'main' ? 'rgba(128,116,98,0.97)' : 'rgba(134,112,80,0.95)');
  stroke(island, 6, 'rgba(128,116,98,0.97)');
  for (const rd of roads) for (const off of [-0.25, 0.25]) {
    const pts = rd.pts.map((p, i) => {
      const q = rd.pts[Math.min(rd.pts.length - 1, i + 1)], o = rd.pts[Math.max(0, i - 1)];
      const a = Math.atan2(q[1] - o[1], q[0] - o[0]);
      return [p[0] - Math.sin(a) * off * rd.width, p[1] + Math.cos(a) * off * rd.width];
    });
    stroke(pts, 0.7, 'rgba(85,70,50,0.35)');
  }
  // gardens / trampled earth in front of houses
  for (const p of state.plots) {
    ctx.save();
    const [x, y] = P(p.x, p.z);
    ctx.translate(x, y); ctx.rotate(p.rot);
    ctx.fillStyle = `rgba(${95 + r.int(-10, 10)},${108 + r.int(-10, 10)},62,0.28)`;
    ctx.fillRect(-p.hw * sx, -p.hd * sz, p.hw * 2 * sx, p.hd * 2 * sz);
    ctx.restore();
  }
  // plazas
  for (const id of ['market', 'district_east', 'district_north', 'district_south', 'district_far', 'colossus']) {
    if (!built.has(id)) continue;
    const l = w.lots[id];
    const [x, y] = P(l.x, l.z);
    ctx.fillStyle = 'rgba(140,130,115,0.97)';
    ctx.beginPath(); ctx.roundRect(x - l.hw * sx, y - l.hd * sz, l.hw * 2 * sx, l.hd * 2 * sz, 6 * sx); ctx.fill();
    ctx.strokeStyle = 'rgba(90,82,70,0.6)'; ctx.lineWidth = 1.2 * sx; ctx.stroke();
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(${r.int(90, 170)},${r.int(85, 160)},${r.int(75, 140)},0.35)`;
      ctx.fillRect(x + r.float(-l.hw, l.hw) * sx, y + r.float(-l.hd, l.hd) * sz, 0.8 * sx, 0.8 * sz);
    }
  }
  // dark tilled soil under fields, quarry dust, yards of workplaces
  for (const f of w.fields) {
    ctx.save();
    const [x, y] = P(f.x, f.z);
    ctx.translate(x, y); ctx.rotate(f.rot);
    ctx.fillStyle = 'rgba(92,74,50,0.8)';
    ctx.fillRect(-(f.hw + 0.6) * sx, -(f.hd + 0.6) * sz, (f.hw + 0.6) * 2 * sx, (f.hd + 0.6) * 2 * sz);
    ctx.restore();
  }
  for (const id of ['quarry', 'sawmill', 'forge', 'tavern', 'tournament', 'university', 'palace', 'cathedral', 'townhall', 'chapel', 'harbor']) {
    if (!built.has(id)) continue;
    const l = w.lots[id];
    ctx.save();
    const [x, y] = P(l.x, l.z);
    ctx.translate(x, y); ctx.rotate(l.rot);
    ctx.fillStyle = id === 'quarry' ? 'rgba(150,145,135,0.8)' : id === 'tournament' ? 'rgba(160,140,95,0.6)' : 'rgba(120,108,88,0.55)';
    ctx.beginPath(); ctx.roundRect(-l.hw * sx, -l.hd * sz, l.hw * 2 * sx, l.hd * 2 * sz, 3 * sx); ctx.fill();
    ctx.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.flipY = false;
  return t;
}

// ---------------------------------------------------------------- water
function waterNormalTexture(seed) {
  const S = 256, r = rng(seed, 'waves');
  const hgt = new Float32Array(S * S);
  const waves = Array.from({ length: 24 }, () => ({ kx: r.int(-9, 9), kz: r.int(-9, 9), ph: r.float(0, 6.28), a: r.float(0.3, 1) }));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0;
    for (const w of waves) v += w.a * Math.sin(((w.kx * x + w.kz * y) / S) * Math.PI * 2 + w.ph);
    hgt[y * S + x] = v;
  }
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = hgt[y * S + ((x + 1) % S)] - hgt[y * S + ((x + S - 1) % S)];
    const dy = hgt[((y + 1) % S) * S + x] - hgt[((y + S - 1) % S) * S + x];
    const v = new THREE.Vector3(-dx * 0.25, -dy * 0.25, 1).normalize();
    const o = (y * S + x) * 4;
    img.data[o] = (v.x * 0.5 + 0.5) * 255; img.data[o + 1] = (v.y * 0.5 + 0.5) * 255; img.data[o + 2] = (v.z * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function buildWater(w) {
  const normal = waterNormalTexture(w.seed);
  const uniforms = { time: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2b5560'), roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.9,
    normalMap: normal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.1,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.time = uniforms.time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float flow;\nvarying float vFlow;\nvarying vec3 vWPos2;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFlow = flow;\nvWPos2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float time;\nvarying float vFlow;\nvarying vec3 vWPos2;')
      .replace('#include <normal_fragment_maps>', `
        vec2 wuv = vWPos2.xz / 26.0;
        vec3 n1 = texture2D(normalMap, wuv + vec2(0.0, time * 0.035 * vFlow) + vec2(time * 0.006)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(normalMap, wuv * 2.3 - vec2(time * 0.017, time * 0.028 * vFlow)).xyz * 2.0 - 1.0;
        vec2 slope = (n1.xy + n2.xy) * normalScale;
        normal = normalize((viewMatrix * vec4(normalize(vec3(slope.x, 1.0, slope.y)), 0.0)).xyz);`);
  };
  const group = new THREE.Group();
  // river ribbon
  const pts = w.riverPts, half = RIVER_HALF_WIDTH + 9;
  const pos = [], idx = [], flow = [], uv = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const nx = -Math.sin(ang), nz = Math.cos(ang);
    pos.push(pts[i][0] + nx * half, WATER_LEVEL, pts[i][1] + nz * half, pts[i][0] - nx * half, WATER_LEVEL, pts[i][1] - nz * half);
    flow.push(1, 1); uv.push(0, i, 1, i);
    if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 1));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const river = new THREE.Mesh(g, mat);
  river.receiveShadow = true;
  group.add(river);
  // moat
  const ring = new THREE.RingGeometry(CASTLE.island - 3, CASTLE.moatOuter + 4, 128, 1);
  ring.rotateX(-Math.PI / 2);
  ring.translate(0, WATER_LEVEL, 0);
  ring.setAttribute('flow', new THREE.Float32BufferAttribute(new Float32Array(ring.attributes.position.count).fill(0.15), 1));
  const moat = new THREE.Mesh(ring, mat);
  moat.receiveShadow = true;
  group.add(moat);
  group.userData = { uniforms, material: mat };
  return group;
}
