// Shared pieces for the story event scenes: people that walk and run, stages, flames, wording.
import * as THREE from 'three';
import { rig } from '../work.js';
import { JOBS } from '../../../sim/tiers.js';

/** A person with walking legs (faces +z). */
export function person(M, color) {
  return rig(M, color, { walk: true });
}

/** Legs and arms swing; `ph` advances with the distance covered, `amp` 0 = standing. */
export function stride(P, ph, amp, { arms = true } = {}) {
  const s = Math.sin(ph);
  P.legs[0].rotation.x = amp * s;
  P.legs[1].rotation.x = -amp * s;
  if (arms) { P.r.g.rotation.x = -amp * 0.9 * s; P.l.g.rotation.x = amp * 0.9 * s; }
  P.root.position.y += amp * 0.09 * Math.abs(Math.cos(ph)); // call after placing the person
}

/** A flickering torch flame on a stick, held in a hand group. Returns the flame for update(). */
export function torch(M, hand) {
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.7, 6).translate(0, 0.2, 0.08), M.woodDark);
  hand.add(stick);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 8).translate(0, 0.16, 0), flameMaterial('#ffb347'));
  flame.position.set(0, 0.56, 0.08);
  hand.add(flame);
  return flame;
}

export function flameMaterial(color) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
}

/**
 * A bonfire at C (crossed logs on a stone ring, three flames, a warm light) added to `group`.
 * Returns { update(t, on) } for the flicker.
 */
export function bonfire(group, M, C, power = 45) {
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(C.x + x, y, C.z + z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  for (let i = 0; i < 6; i++) {
    const log = add(new THREE.CylinderGeometry(0.1, 0.12, 1.6, 7), M.woodDark, 0, 0.42, 0);
    log.rotation.set(0.75, (i / 6) * Math.PI * 2, 0, 'YXZ');
  }
  add(new THREE.CylinderGeometry(0.75, 0.85, 0.12, 14), M.stoneDark, 0, 0.06, 0);
  const flames = [['#ff7a1a', 0.55, 1.5], ['#ffb347', 0.4, 1.15], ['#ffe08a', 0.22, 0.8]].map(([c, r, h], k) => {
    const f = add(new THREE.ConeGeometry(r, h, 10).translate(0, h / 2, 0), flameMaterial(c), 0, 0.25, 0);
    f.castShadow = false;
    f.userData.k = k;
    return f;
  });
  const light = new THREE.PointLight('#ff8a3d', power, 30, 2);
  light.position.set(C.x, 1.6, C.z);
  group.add(light);
  return {
    update(t, on) {
      light.visible = on;
      for (const f of flames) flicker(f, t, f.userData.k * 3);
      light.intensity = power * (1 + 0.12 * Math.sin(t * 17) + 0.08 * Math.sin(t * 29));
    },
  };
}

export function flicker(flame, t, k) {
  const f = 1 + 0.18 * Math.sin(t * 23 + k * 1.7) + 0.1 * Math.sin(t * 37 + k);
  flame.scale.set(1, f, 1);
}

/**
 * Where a scene in town takes place: the market square when it stands, else the well. Children of
 * `group` use the stage's local frame (x along the square, z across, y up from the paving).
 */
export function stage(buildings) {
  const it = buildings.items.market || buildings.items.well;
  if (!it) return null;
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(it.group.matrix);
  const toWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(group.matrix);
  return { group, toWorld, square: !!buildings.items.market };
}

export const jobLabel = (job) => JOBS[job]?.label || job;

/** A name tag for a cast member: the name when they have one, else their job. */
export function castTag(c, sub) {
  return { pos: new THREE.Vector3(), title: c.name || jobLabel(c.job), sub: sub ?? (c.name ? jobLabel(c.job) : '') };
}

export const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Owner 2026-11-23: people never pass through one another. Pushes the rigs (same parent, their root positions) at least
 * `d` apart on the ground, a few rounds of pairwise pushes, after a shot has placed them for the frame (the same input
 * gives the same output, so frames stay steady). Rigs out of the way (put far below) and ones lifted off the ground
 * (carried on shoulders) are left alone; `fixed` ones (at a bench, on a dais) push the others but never move.
 */
export function apart(list, d = 0.6, { iters = 4, fixed = [] } = {}) {
  const ps = list.filter((P) => P && P.root.visible !== false && Math.abs(P.root.position.y) < 0.9);
  const still = new Set(fixed);
  for (let it = 0; it < iters; it++) {
    let moved = false;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i].root.position, b = ps[j].root.position;
      let dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz);
      if (dist >= d) continue;
      if (dist < 1e-4) { dx = 1e-4 * Math.cos(i * 2.4 + j); dz = 1e-4 * Math.sin(i * 2.4 + j); dist = 1e-4; } // the same spot: a fixed way apart
      const fa = still.has(ps[i]), fb = still.has(ps[j]);
      if (fa && fb) continue;
      const push = (d - dist) / dist, sa = fa ? 0 : fb ? 1 : 0.5, sb = fb ? 0 : fa ? 1 : 0.5;
      a.x -= dx * push * sa; a.z -= dz * push * sa;
      b.x += dx * push * sb; b.z += dz * push * sb;
      moved = true;
    }
    if (!moved) break;
  }
}

/**
 * Petals thrown over a winner (owner 2026-11-23, the King's prizes): red and gold specks drifting down around (x, y, z).
 * Returns { group, at(t, k, x, y, z) }; k 0 hides them, 1 is the full shower.
 */
export function petals(seed, n = 90) {
  const group = new THREE.Group();
  const sets = ['#d8333a', '#f2c14e'].map((c) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: c, size: 0.07, transparent: true, opacity: 0.95, depthWrite: false }));
    pts.frustumCulled = false;
    group.add(pts);
    return pts;
  });
  const h = (i, k) => { const s = Math.sin((seed % 997) * 12.9898 + i * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
  return {
    group,
    at(t, k, x, y, z, spread = 2.2) {
      sets.forEach((pts, s) => {
        const arr = pts.geometry.attributes.position.array;
        for (let i = 0; i < n; i++) {
          if (h(i, s) > k) { arr[i * 3 + 1] = -1e4; continue; }
          const f = (t * (0.22 + 0.1 * h(i, s + 2)) + h(i, s + 4)) % 1;
          arr[i * 3] = x + (h(i, s + 6) - 0.5) * spread * 2 + 0.25 * Math.sin(t * 2 + i);
          arr[i * 3 + 1] = y + 4 - 4 * f;
          arr[i * 3 + 2] = z + (h(i, s + 8) - 0.5) * spread * 2 + 0.25 * Math.cos(t * 1.7 + i);
        }
        pts.geometry.attributes.position.needsUpdate = true;
      });
    },
  };
}

/**
 * Which of the King's prize-givings a day gets (owner 2026-11-23: not always the same): 0, 1 or 2, from the seed and the day,
 * or the story's own `award` (test renders: --award).
 */
export function awardOf(args, n = 3) {
  const a = args.story?.award;
  if (a !== undefined && a !== null) return ((Number(a) % n) + n) % n;
  const d = Number(args.state?.day || 0), s = Number(args.seed || 0);
  return Math.abs(d + (s % n)) % n;
}
