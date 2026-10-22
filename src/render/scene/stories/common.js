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

export const jobLabel = (job, lang) => (lang === 'it' ? JOB_IT[job] : null) || JOBS[job]?.label || job;
const JOB_IT = {
  guard: 'Guardia', knight: 'Cavaliere', warrior: 'Guerriero', fletcher: 'Arcaio', farmer: 'Agricoltore', peasant: 'Contadino',
  woodcutter: 'Taglialegna', fisherman: 'Pescatore', blacksmith: 'Fabbro', baker: 'Fornaio', stonemason: 'Scalpellino',
  merchant: 'Mercante', innkeeper: 'Oste', priest: 'Prete', miller: 'Mugnaio', brewer: 'Birraio', apprentice: 'Apprendista',
  tailor: 'Sarto', physician: 'Medico', taxcollector: 'Esattore', potter: 'Vasaio', cobbler: 'Calzolaio', cooper: 'Bottaio',
  beekeeper: 'Apicoltore', bellfounder: 'Fonditore', clockmaker: 'Orologiaio', ratcatcher: 'Acchiappatopi', chimneysweep: 'Spazzacamino',
  falconer: 'Falconiere', cook: 'Cuoco',
};

/** A name tag for a cast member: the name when they have one, else their job. */
export function castTag(c, lang, sub) {
  return { pos: new THREE.Vector3(), title: c.name || jobLabel(c.job, lang), sub: sub ?? (c.name ? jobLabel(c.job, lang) : '') };
}

export const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const clamp01 = (x) => Math.max(0, Math.min(1, x));
