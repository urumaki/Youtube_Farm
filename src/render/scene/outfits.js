// What each villager wears for their job (owner 2026-10-28, after the jester's cap of 2026-10-23): a hat, helmet or hood
// in place of the plain cap, and over the tunic an apron, a tabard, a long robe or a few things of the trade. Shown in
// every scene (at work, in the caravan, the tavern, the church, the stories). The rig only gets the tunic colour, which
// is the job's own (JOBS[job].color, unique to each job), so the outfit is found by that colour.
// The head piece goes in P.hat (a group), so a scene that takes the hat off (a rider's helmet, the pillory) takes it off.
// Medieval only, nothing magic: no pointed wizard hats.
import * as THREE from 'three';
import { JOBS } from '../../sim/tiers.js';
import { cylGeo, boxGeo } from './kit.js';

// body frame of the rig (work.js): the tunic is a cone from r 0.33 at y -0.09 to r 0.19 at y 0.81, the belt at y 0.46,
// the head at y 1.04 (r 0.17), the plain cap from y 1.17; the ground is at y -0.62 when standing
const tunicR = (y) => 0.33 - ((y + 0.09) / 0.9) * 0.14;

// materials made once per material set
function mats(M) {
  if (M.outfit) return M.outfit;
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
  M.outfit = {
    straw: std('#d9bf7a'), leather: std('#5b3b22'), leatherLight: std('#8a5f3a'), linen: std('#ece4cf'), white: std('#f4f0e6'),
    steel: std('#b9bec4', { roughness: 0.35, metalness: 0.75 }), mail: std('#8d9298', { roughness: 0.5, metalness: 0.6 }),
    black: std('#151214'), soot: std('#3a312c', { roughness: 0.95 }), felt: std('#3b2f28'), navy: std('#22344f'), wool: std('#7d2a24'),
    brown: std('#5e4630'), grey: std('#77746c'), canvas: std('#a59d88'), clay: std('#9a5f42'), blood: std('#8e2c25'),
    green: std('#3f5a2a'), purple: std('#4a2766'), blue: std('#24346e'), plume: std('#b3262e'), feather: std('#f2efe6'),
    veil: std('#e8e4d8', { transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }),
    glass: std('#cfe3ea', { roughness: 0.1, metalness: 0.3 }),
  };
  return M.outfit;
}

// head pieces (y up from the body's origin, the cap's place)
const HATS = {
  straw: (O) => [[cylGeo(0.36, 0.36, 0.03, 18).translate(0, 1.19, 0), O.straw], [cylGeo(0.16, 0.19, 0.17, 14).translate(0, 1.28, 0), O.straw],
    [cylGeo(0.195, 0.195, 0.04, 14).translate(0, 1.22, 0), O.brown]],
  wideFelt: (O, mat = O.felt) => [[cylGeo(0.33, 0.33, 0.03, 18).translate(0, 1.2, 0), mat], [cylGeo(0.17, 0.2, 0.2, 14).translate(0, 1.3, 0), mat]],
  kettle: (O) => [[new THREE.SphereGeometry(0.205, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.17, 0), O.steel],
    [cylGeo(0.32, 0.34, 0.03, 18).translate(0, 1.17, 0), O.steel]],
  // a bascinet with a nasal guard
  bascinet: (O) => [[new THREE.ConeGeometry(0.2, 0.36, 14).translate(0, 1.33, 0), O.steel], [cylGeo(0.2, 0.2, 0.12, 14).translate(0, 1.15, 0), O.steel],
    [boxGeo(0.035, 0.2, 0.03).translate(0, 1.06, 0.18), O.steel]],
  // a round steel cap with a plume
  plumed: (O) => [[new THREE.SphereGeometry(0.205, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.15, 1).translate(0, 1.15, 0), O.steel],
    [new THREE.SphereGeometry(0.07, 8, 6).scale(1, 2.2, 0.7).rotateX(-0.5).translate(0, 1.47, -0.06), O.plume]],
  toque: (O) => [[cylGeo(0.21, 0.17, 0.34, 14).translate(0, 1.33, 0), O.white], [new THREE.SphereGeometry(0.21, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1).translate(0, 1.5, 0), O.white]],
  // a soft beret, tilted, with a feather
  beret: (O, mat, feather = O.feather) => [[new THREE.SphereGeometry(0.24, 14, 8).scale(1, 0.32, 1).rotateZ(-0.15).translate(0.02, 1.22, 0), mat],
    [new THREE.ConeGeometry(0.035, 0.4, 6).rotateZ(-0.7).translate(-0.12, 1.36, -0.05), feather]],
  // a close linen cap tied under the chin
  coif: (O, mat = O.linen) => [[new THREE.SphereGeometry(0.188, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(1, 1.05, 1.05).translate(0, 1.05, -0.01), mat]],
  knit: (O, mat) => [[new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.25, 1).translate(0, 1.12, 0), mat],
    [cylGeo(0.195, 0.195, 0.06, 14).translate(0, 1.13, 0), mat]],
  // a hood, its point falling back, and the short cape on the shoulders
  hood: (O, mat) => [[new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.62).scale(1.02, 1.12, 1.08).translate(0, 1.05, -0.02), mat],
    [new THREE.ConeGeometry(0.07, 0.34, 8).rotateX(-1.9).translate(0, 1.18, -0.3), mat], [cylGeo(0.2, 0.33, 0.24, 14).translate(0, 0.8, 0), mat]],
  // the executioner's hood, down over the face
  executioner: (O) => [[new THREE.ConeGeometry(0.31, 0.74, 12).translate(0, 1.16, 0), O.black]],
  // the scholar's round cap (a pileus)
  pileus: (O, mat) => [[new THREE.SphereGeometry(0.19, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(0, 1.15, 0), mat],
    [new THREE.ConeGeometry(0.03, 0.08, 6).translate(0, 1.32, 0), mat]],
  // a chaperon: a rolled band with the cloth hanging at the side
  chaperon: (O, mat) => [[new THREE.TorusGeometry(0.19, 0.07, 8, 16).rotateX(Math.PI / 2).translate(0, 1.2, 0), mat],
    [new THREE.SphereGeometry(0.16, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1).translate(0, 1.21, 0), mat],
    [boxGeo(0.09, 0.32, 0.06).rotateZ(0.25).translate(0.2, 1.06, 0), mat]],
  flatCap: (O, mat) => [[cylGeo(0.2, 0.2, 0.08, 14).translate(0, 1.18, 0), mat], [boxGeo(0.22, 0.02, 0.12).translate(0, 1.15, 0.2), mat]],
  bare: () => [],
};

// on the body: aprons, tabards, robes, capes and the things of the trade
function apron(mat, top = 0.68, bottom = -0.06, w = 0.42) {
  const tilt = Math.atan2(tunicR(bottom) - tunicR(top), top - bottom);
  const g = boxGeo(w, top - bottom, 0.025).rotateX(-tilt).translate(0, (top + bottom) / 2, (tunicR(top) + tunicR(bottom)) / 2 + 0.025);
  return [[g, mat], [cylGeo(0.012, 0.012, 0.4, 4).rotateZ(Math.PI / 2).translate(0, top - 0.02, tunicR(top) + 0.01), mat]];
}
const tabard = (mat, front = true) => {
  const top = 0.78, bottom = 0.02, tilt = Math.atan2(tunicR(bottom) - tunicR(top), top - bottom), z = (tunicR(top) + tunicR(bottom)) / 2 + 0.02;
  return [[boxGeo(0.36, top - bottom, 0.02).rotateX(-tilt).translate(0, (top + bottom) / 2, z), mat],
    ...(front ? [[boxGeo(0.36, top - bottom, 0.02).rotateX(tilt).translate(0, (top + bottom) / 2, -z), mat]] : [])];
};
// a long robe from the belt to the ground (standing only: sitting, the tunic is enough)
// (wider than the tunic all the way down, so the tunic's hem never shows through)
const robe = (mat) => [[cylGeo(0.28, 0.42, 1.04, 16, 4, true).translate(0, -0.02, 0), mat], [cylGeo(0.255, 0.27, 0.08, 14).translate(0, 0.5, 0), mat]];
const mailCollar = (O) => [[cylGeo(0.2, 0.27, 0.16, 14).translate(0, 0.86, 0), O.mail]];
const purse = (mat) => [[new THREE.SphereGeometry(0.07, 8, 6).scale(1, 1.2, 0.7).translate(0.2, 0.38, 0.18), mat]];
const quiver = (O) => [[cylGeo(0.07, 0.06, 0.55, 8).rotateZ(0.35).translate(0.08, 0.7, -0.27), O.leather],
  ...[-0.03, 0.02, 0.07].map((x) => [new THREE.ConeGeometry(0.03, 0.09, 4).translate(x + 0.2, 1.02, -0.27), O.feather])];
const chain = (O, gold) => [[new THREE.TorusGeometry(0.2, 0.025, 6, 20).rotateX(Math.PI / 2 - 0.35).translate(0, 0.76, 0.06), gold],
  [new THREE.SphereGeometry(0.05, 8, 6).translate(0, 0.58, 0.26), gold]];
const tape = (O) => [[boxGeo(0.035, 0.5, 0.012).translate(0.09, 0.56, 0.255), O.straw], [boxGeo(0.035, 0.42, 0.012).translate(-0.09, 0.6, 0.25), O.straw],
  [cylGeo(0.2, 0.2, 0.035, 14, 4, true).translate(0, 0.83, 0), O.straw]];
const spectacles = (O) => [-0.06, 0.06].map((x) => [new THREE.TorusGeometry(0.035, 0.008, 6, 12).translate(x, 1.06, 0.18), O.felt]);
const veil = (O) => [[cylGeo(0.36, 0.3, 0.42, 16, 4, true).translate(0, 0.98, 0), O.veil]];
const soot = (O, P) => { P.head.material = O.soot; return []; };

// job -> [head piece, body pieces, robe?]; a job not listed keeps the plain cap
const OUTFITS = {
  peasant: (O) => [HATS.coif(O, O.canvas)],
  farmer: (O) => [HATS.straw(O)],
  woodcutter: (O) => [HATS.knit(O, O.wool)],
  fisherman: (O) => [HATS.knit(O, O.navy)],
  blacksmith: (O) => [HATS.bare(), apron(O.leather, 0.8, -0.1, 0.46)],
  baker: (O) => [HATS.toque(O), apron(O.white)],
  guard: (O) => [HATS.kettle(O), mailCollar(O)],
  stonemason: (O) => [HATS.coif(O, O.grey), apron(O.canvas)],
  merchant: (O, M) => [HATS.wideFelt(O, O.blue), purse(M.gold)],
  innkeeper: (O) => [HATS.coif(O), apron(O.white)],
  miller: (O) => [HATS.coif(O, O.white), apron(O.white, 0.6)],
  carpenter: (O) => [HATS.flatCap(O, O.brown), apron(O.leatherLight, 0.6, 0.0)],
  knight: (O, M) => [HATS.bascinet(O), [...mailCollar(O), ...tabard(M.clothBlue)]],
  cavalier: (O, M) => [HATS.plumed(O), [...mailCollar(O), ...tabard(M.clothRed, false)]],
  scholar: (O) => [HATS.pileus(O, O.black), [], O.black],
  physician: (O) => [HATS.pileus(O, O.wool), [], O.wool],
  apothecary: (O) => [HATS.coif(O), apron(O.linen)],
  bard: (O, M) => [HATS.beret(O, M.clothRed)],
  taxcollector: (O, M) => [HATS.chaperon(O, O.black), purse(M.gold), O.purple],
  tailor: (O) => [HATS.beret(O, O.felt, O.plume), tape(O)],
  potter: (O) => [HATS.coif(O, O.canvas), apron(O.clay)],
  cobbler: (O) => [HATS.flatCap(O, O.felt), apron(O.leather, 0.55, -0.02)],
  cooper: (O) => [HATS.knit(O, O.brown), apron(O.leather)],
  beekeeper: (O) => [[...HATS.straw(O), ...veil(O)]],
  bellfounder: (O) => [HATS.flatCap(O, O.leather), apron(O.leather, 0.8, -0.1, 0.46)],
  clockmaker: (O) => [HATS.pileus(O, O.felt), [...spectacles(O), ...apron(O.leatherLight, 0.55, 0.05, 0.36)]],
  crier: (O, M) => [HATS.beret(O, M.clothBlue), tabard(M.clothBlue, false)],
  executioner: (O) => [HATS.executioner(O)],
  fletcher: (O) => [HATS.beret(O, O.green, O.plume), quiver(O)],
  beggar: (O) => [HATS.hood(O, O.grey)],
  brewer: (O) => [HATS.knit(O, O.brown), apron(O.leatherLight)],
  apprentice: (O) => [HATS.coif(O)],
  ratcatcher: (O) => [HATS.hood(O, O.brown)],
  chimneysweep: (O, M, P) => [[...HATS.flatCap(O, O.black), ...soot(O, P)]],
  falconer: (O) => [HATS.beret(O, O.brown), [[cylGeo(0.105, 0.1, 0.3, 8).translate(0, -0.5, 0), O.leather, 'l']]],
  cook: (O) => [HATS.toque(O), apron(O.white)],
  hunter: (O) => [HATS.hood(O, O.green), quiver(O)],
  butcher: (O) => [HATS.coif(O, O.white), [...apron(O.white), [boxGeo(0.12, 0.08, 0.01).translate(0.06, 0.25, 0.3), O.blood]]],
  engineer: (O) => [HATS.flatCap(O, O.leather), apron(O.leatherLight, 0.5, 0.05, 0.36)],
  shepherd: (O) => [HATS.hood(O, O.brown)],
  tanner: (O) => [HATS.bare(), apron(O.leather, 0.8, -0.1, 0.46)],
  teacher: (O) => [HATS.pileus(O, O.navy), [], O.navy],
  philosopher: (O) => [HATS.bare(), [], O.linen],
  barber: (O) => [HATS.coif(O, O.white), apron(O.white, 0.6, 0.05)],
  astronomer: (O) => [HATS.hood(O, O.blue), [], O.blue],
  stablehand: (O) => [HATS.straw(O)],
  adviser: (O, M) => [HATS.chaperon(O, O.purple), chain(O, M.gold), O.purple],
  miner: (O) => [HATS.hood(O, O.grey), apron(O.leather, 0.55, -0.02)],
  // owner 2026-10-30: the librarian in a dark robe and a brown cap
  librarian: (O) => [HATS.pileus(O, O.brown), [], O.felt],
  // owner 2026-10-25: clergy (a red stole; the bishop a mitre with a gold band)
  priest: (O, M) => [null, [[boxGeo(0.16, 0.85, 0.04).translate(0, 0.42, 0.29), M.clothRed]]],
  bishop: (O, M) => [[[new THREE.ConeGeometry(0.23, 0.62, 4).scale(1, 1, 0.7).translate(0, 1.47, 0), M.clothIvory],
    [cylGeo(0.215, 0.225, 0.07, 12).translate(0, 1.2, 0), M.gold]], [[boxGeo(0.16, 0.85, 0.04).translate(0, 0.42, 0.29), M.clothRed]]],
  // owner 2026-10-23: the jester's cap (two-coloured horns with bells)
  jester: (O, M) => [jesterCap(M)],
};
const BY_COLOR = new Map(Object.entries(OUTFITS).map(([job, f]) => [JOBS[job].color.toLowerCase(), f]));

/** Puts on the outfit of the job whose colour the tunic has (nothing for a colour that is no job's). */
export function dress(P, color, M, { seated = false, ground = false } = {}) {
  const f = BY_COLOR.get(String(color).toLowerCase());
  if (!f) return;
  const O = mats(M);
  const [head, body = [], robeMat = null] = f(O, M, P);
  const mesh = ([geo, mat], parent) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };
  if (head) {
    // the head piece takes the plain cap's place in P.hat
    for (const c of [...P.hat.children]) c.visible = false;
    for (const part of head) mesh(part, P.hat);
  }
  for (const part of body) mesh(part, part[2] === 'l' ? P.l.g : part[2] === 'r' ? P.r.g : P.body);
  if (robeMat && !seated && !ground) for (const part of robe(robeMat)) mesh(part, P.body);
}

function jesterCap(M) {
  const parts = [[cylGeo(0.215, 0.2, 0.1, 12).translate(0, 1.17, 0), M.gold]];
  // three floppy horns (left, right, back), each going up and out and then drooping, a bell at each tip
  const horn = (dir, mat) => {
    const seg = (from, a, h, r0, r1) => {
      const geo = cylGeo(r1, r0, h, 8).translate(0, h / 2, 0);
      if (dir[2]) geo.rotateX(-a * dir[2]); else geo.rotateZ(a * dir[0]);
      parts.push([geo.translate(from.x, from.y, from.z), mat]);
      return from.clone().add(new THREE.Vector3(-Math.sin(a) * h * dir[0], Math.cos(a) * h, -Math.sin(a) * h * dir[2]));
    };
    const tip = seg(seg(new THREE.Vector3(0, 1.2, 0), 0.75, 0.26, 0.11, 0.06), 2.1, 0.2, 0.06, 0.025);
    parts.push([new THREE.SphereGeometry(0.045, 8, 6).translate(tip.x, tip.y, tip.z), M.gold]);
  };
  horn([1, 0, 0], M.clothRed); horn([-1, 0, 0], M.greens); horn([0, 0, 1], M.clothRed);
  return parts;
}
