// The throne room (owner 2026-10-28): on the results day of the chariot race or the joust, right after the game, the winner
// walks up the red carpet between the named guards and villagers, kneels at the foot of the dais, and the King touches
// each shoulder with his sword: a Cavalier for the race, a Knight for the joust. The winner rises and turns to the hall,
// everyone cheers. A closed hall of its own (stone walls, pillars, banners, tall windows, torches) deep under the castle
// mound, so nothing outside shows; lit by its own lights while the camera is in (interior).
import * as THREE from 'three';
import { JOBS } from '../../../sim/tiers.js';
import { CASTLE } from '../../../sim/world.js';
import { Builder, boxGeo, cylGeo } from '../kit.js';
import { toolGeo } from '../work.js';
import { king, bannerGuard } from './royal.js';
import { person, stride, castTag, flameMaterial, flicker, ease, clamp01 } from './common.js';

const HX = 6, HZ = 11, H = 9; // the hall's inner half width and length, its height
const KNEEL = new THREE.Vector3(0, 0, -6.7); // where the winner kneels, facing the throne (-z)
const KING = new THREE.Vector3(0, 0.6, -8.15); // the King standing at the front of the dais
const WALK = 0.3, DOWN = 0.38, TAPS = [0.46, 0.58, 0.7], RISE = 0.8; // the shares of the shot

export function buildThrone({ story, M }) {
  const winner = (story.riders || []).find((c) => c.id === story.winner);
  if (!winner) return null;
  const title = story.id === 'race' ? 'cavalier' : 'knight';
  const group = new THREE.Group();
  group.position.set(0, CASTLE.ground - 60, 0); // under the castle
  group.visible = false;
  const toWorld = (v) => v.clone().add(group.position);
  // ------------------------------------------------------------------ the hall
  const b = new Builder();
  const daylight = new THREE.MeshBasicMaterial({ color: '#dfe6ee' });
  b.add('stoneDark', boxGeo(2 * HX, 0.3, 2 * HZ), 0, -0.15, 0);
  b.add('clothRed', boxGeo(2.2, 0.03, 17.5), 0, 0.015, 1.5); // the carpet, from the door to the dais
  for (const s of [-1, 1]) {
    b.add('stone', boxGeo(0.4, H, 2 * HZ), s * (HX + 0.2), H / 2, 0);
    for (const z of [-6, -2, 2, 6]) {
      b.add('stone', cylGeo(0.38, 0.44, H - 1.2, 14), s * 3.8, (H - 1.2) / 2, z); // the pillars
      b.add('stoneDark', boxGeo(1.1, 0.4, 1.1), s * 3.8, H - 1.0, z);
      b.add('stoneDark', boxGeo(1.0, 0.3, 1.0), s * 3.8, 0.15, z);
    }
  }
  b.add('stone', boxGeo(2 * HX, H, 0.4), 0, H / 2, -HZ - 0.2);
  b.add('stone', boxGeo(2 * HX, H, 0.4), 0, H / 2, HZ + 0.2);
  b.add('woodDark', boxGeo(2 * HX + 0.8, 0.3, 2 * HZ + 0.8), 0, H + 0.15, 0);
  for (let z = -10; z <= 10; z += 2.5) b.add('woodDark', boxGeo(2 * HX, 0.35, 0.3), 0, H - 0.2, z); // the beams
  b.add('woodDark', boxGeo(2.6, 4.2, 0.3), 0, 2.1, HZ - 0.05); // the great door
  // the dais: two steps, the throne at the back under the royal arms
  b.add('stone', boxGeo(6.2, 0.3, 3.4), 0, 0.15, -8.7);
  b.add('stone', boxGeo(4.6, 0.3, 2.4), 0, 0.45, -9.2);
  b.add('clothRed', boxGeo(2.2, 0.03, 3.2), 0, 0.615, -8.9);
  b.add('gold', boxGeo(1.3, 0.55, 1.0), 0, 0.88, -9.7); // the throne's seat, its back, its arms
  b.add('clothRed', boxGeo(1.1, 0.1, 0.85), 0, 1.2, -9.65);
  b.add('gold', boxGeo(1.4, 2.6, 0.25), 0, 1.9, -10.15);
  b.add('clothRed', boxGeo(1.0, 1.7, 0.05), 0, 2.0, -10.0);
  for (const s of [-1, 1]) b.add('gold', boxGeo(0.18, 0.5, 0.9), s * 0.65, 1.35, -9.7);
  b.add('gold', new THREE.SphereGeometry(0.16, 10, 8), 0, 3.35, -10.15);
  const hall = b.build(M);
  group.add(hall);
  const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; group.add(m); return m; };
  add(new THREE.PlaneGeometry(3.2, 3.2), M.arms, 0, 5.4, -HZ + 0.02); // the royal arms over the throne
  for (const s of [-1, 1]) {
    add(new THREE.PlaneGeometry(1.6, 3.4), M.cloth, s * 2.6, 5.0, -HZ + 0.03); // banners either side of the arms
    for (const z of [-4, 0, 4]) {
      add(new THREE.PlaneGeometry(1.4, 3.0), M.cloth, s * (HX - 0.02), 4.6, z, -s * Math.PI / 2); // banners on the side walls
      add(new THREE.PlaneGeometry(1.1, 3.4), daylight, s * (HX - 0.01), 6.6, z + 2, -s * Math.PI / 2); // tall windows
    }
  }
  // torches on the pillars, their light only while the camera is here
  const flames = [], lights = [];
  for (const s of [-1, 1]) for (const z of [-6, 2]) {
    const f = add(new THREE.ConeGeometry(0.12, 0.38, 8).translate(0, 0.19, 0), flameMaterial('#ffb347'), s * 3.35, 3.2, z);
    add(cylGeo(0.05, 0.04, 0.5, 6), M.iron, s * 3.4, 2.95, z);
    flames.push(f);
    const l = new THREE.PointLight('#ffb066', 0, 16, 1.6);
    l.position.set(s * 3.0, 3.6, z);
    group.add(l);
    lights.push(l);
  }
  const fill = new THREE.PointLight('#ffe2b8', 0, 14, 1.4); // over the dais
  fill.position.set(0, 5.5, -6.5);
  group.add(fill);
  lights.push(fill);
  // ------------------------------------------------------------------ the people
  const K = king(M, { seated: false });
  K.root.position.copy(KING);
  group.add(K.root);
  const sword = toolGeo('sword', M);
  K.r.hand.add(sword);
  const guards = [-1, 1].map((s) => { const g = bannerGuard(M); g.P.root.position.set(s * 2.6, 0.6, -9.1); group.add(g.P.root); return g.P; });
  const W = person(M, JOBS[winner.job]?.color || JOBS.guard.color);
  group.add(W.root);
  const labels = [];
  const subOf = () => (title === 'cavalier' ? 'Now a Cavalier!' : 'Now a Knight!');
  const wTag = { ...castTag(winner), P: W, sub0: castTag(winner).sub };
  labels.push(wTag, { pos: toWorld(new THREE.Vector3(KING.x, KING.y + 2.45, KING.z)), title: 'The King', sub: '', fixed: true });
  // the other riders and the named villagers of the stands line the carpet, facing it
  const line = [...story.riders.filter((c) => c.id !== winner.id), ...(story.crowd || [])].slice(0, 8);
  const crowd = line.map((c, i) => {
    const s = i % 2 ? 1 : -1, z = -4.4 + Math.floor(i / 2) * 2.1;
    const P = person(M, JOBS[c.job]?.color || '#7a6a55');
    P.root.position.set(s * 2.0, 0, z);
    P.root.rotation.y = -s * Math.PI / 2 + s * 0.35; // toward the carpet and a little toward the throne
    group.add(P.root);
    labels.push({ ...castTag(c), P });
    return { P, i };
  });
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    interior: true,
    banner: title === 'cavalier' ? 'A new Cavalier!' : 'A new Knight!',
    focus: toWorld(new THREE.Vector3(0, 1.5, -7.4)),
    cam(u) {
      // from beside the carpet, over the heads of the ones lining it, drifting in toward the dais: the King and the winner
      // side by side in the frame
      const k = ease(u);
      return { pos: toWorld(new THREE.Vector3(3.0 - 0.6 * k, 3.4 - 0.2 * k, 1.0 - 2.6 * k)), look: toWorld(new THREE.Vector3(0, 1.4, -7.6)), fov: 62 };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      group.visible = on;
      for (const l of lights) { l.visible = on; l.intensity = on ? (l === fill ? 14 : 10) * (1 + 0.08 * Math.sin(t * 11 + l.position.z)) : 0; }
      if (!on) return;
      const u = clamp01((t - t0) / (t1 - t0));
      flames.forEach((f, k) => flicker(f, t, k * 2));
      // the winner: up the carpet, down on one knee, the taps, up again and round to the hall
      const walk = clamp01(u / WALK), down = clamp01((u - WALK) / (DOWN - WALK)), up = clamp01((u - RISE) / 0.08);
      const kneel = down * (1 - up);
      W.root.position.set(0, -0.45 * kneel, lerpN(-1.5, KNEEL.z, ease(walk)));
      W.root.rotation.y = Math.PI + Math.PI * ease(up); // facing the throne, then the hall
      if (walk < 1) stride(W, (t - t0) * 6, 0.45);
      else { W.legs[0].rotation.x = -1.3 * kneel; W.legs[1].rotation.x = 0.4 * kneel; }
      W.body.rotation.x = 0.35 * kneel;
      if (u > RISE + 0.08) { W.r.g.rotation.set(-2.8 + 0.2 * Math.sin(t * 8), 0, -0.3); W.l.g.rotation.set(-2.7, 0, 0.3); } // arms up
      else { W.r.g.rotation.set(-0.1, 0, -0.05); W.l.g.rotation.set(-0.1, 0, 0.05); }
      wTag.sub = u > TAPS[2] + 0.04 ? subOf() : wTag.sub0;
      // the King: the sword raised, then down on the right shoulder, over the head, the left shoulder; then held up
      let tap = 0, side = 0;
      TAPS.forEach((x, i) => { const d = Math.exp(-(((u - x) / 0.035) ** 2)); if (d > tap) { tap = d; side = [1, 0, -1][i]; } });
      const raised = u > DOWN - 0.04 && u < TAPS[2] + 0.06;
      K.r.g.rotation.set(raised ? -1.9 + 0.55 * tap : u > RISE ? -2.6 : -0.3, 0, raised ? -0.15 + 0.45 * side * tap : -0.2);
      K.l.g.rotation.set(-0.3, 0, 0.15);
      K.body.rotation.x = raised ? 0.12 * tap : 0;
      guards.forEach((P) => { P.r.g.rotation.set(-0.35, 0, 0); });
      // the hall cheers once the title is given
      for (const { P, i } of crowd) {
        const cheer = u > TAPS[2] + 0.04;
        const ph = t * 8 + i;
        P.r.g.rotation.set(cheer ? -2.7 + 0.3 * Math.sin(ph) : -0.15, 0, -0.2);
        P.l.g.rotation.set(cheer && i % 2 ? -2.5 : -0.15, 0, 0.2);
      }
      for (const l of labels) if (!l.fixed) l.pos.copy(toWorld(tmp.copy(l.P.root.position).setY(l.P.root.position.y + 2.3)));
    },
  };
}

const lerpN = THREE.MathUtils.lerp;
