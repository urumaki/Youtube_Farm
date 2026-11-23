// The throne room (owner 2026-10-28): on the results day of the chariot race or the joust, right after the game, the winner
// walks up the red carpet between the named guards and villagers, kneels at the foot of the dais, and the King touches
// each shoulder with his sword: a Cavalier for the race, a Knight for the joust. The winner rises and turns to the hall,
// everyone cheers. Owner 2026-11-23: not always the same ceremony (awardOf, common.js): (0) the sword on each shoulder; (1) the
// King comes down from the dais, lays a red cloak on the kneeling winner's shoulders and raises the winner's arm to the hall
// under a shower of petals; (2) the King hands the kneeling winner a golden cup, the winner rises and lifts it to the hall.
// The Noble's ceremony is always the sword. A closed hall of its own (stone walls, pillars, banners, tall windows, torches) deep under the castle
// mound, so nothing outside shows; lit by its own lights while the camera is in (interior).
import * as THREE from 'three';
import { JOBS } from '../../../sim/tiers.js';
import { CASTLE } from '../../../sim/world.js';
import { Builder, boxGeo, cylGeo } from '../kit.js';
import { toolGeo } from '../work.js';
import { king, bannerGuard } from './royal.js';
import { plateArmor, nobleAttire, NOBLE } from '../outfits.js';
import { person, stride, castTag, flameMaterial, flicker, ease, clamp01, petals, awardOf } from './common.js';

const HX = 6, HZ = 11, H = 9; // the hall's inner half width and length, its height
const KNEEL = new THREE.Vector3(0, 0, -6.7); // where the winner kneels, facing the throne (-z)
const KING = new THREE.Vector3(0, 0.6, -8.15); // the King standing at the front of the dais
const WALK = 0.3, DOWN = 0.38, TAPS = [0.46, 0.58, 0.7], RISE = 0.8; // the shares of the shot

// Owner 2026-11-07: the same ceremony makes a villager a Noble (story 'noble', by the owner's hand only): the hero walks up
// the carpet past the newest named villagers and the King gives the title.
export function buildThrone(args) {
  const { story, M } = args;
  const winner = story.id === 'noble' ? story.hero : (story.riders || []).find((c) => c.id === story.winner);
  if (!winner) return null;
  const title = story.id === 'noble' ? 'noble' : story.id === 'race' ? 'cavalier' : 'knight';
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
  const award = title === 'noble' ? 0 : awardOf(args);
  const sword = toolGeo('sword', M);
  if (award === 0) K.r.hand.add(sword);
  // the cloak (1): red with a gold collar, carried in the King's hands, then on the winner's shoulders
  const cloak = new THREE.Group();
  const ck = (geo, m, y) => { const o = new THREE.Mesh(geo, m); o.position.y = y; o.castShadow = true; cloak.add(o); return o; };
  ck(boxGeo(0.95, 1.15, 0.05), M.clothRed, -0.55);
  ck(boxGeo(0.98, 0.1, 0.09), M.gold, 0);
  cloak.visible = award === 1;
  // the cup (2): a golden cup with a foot and two handles
  const cup = new THREE.Group();
  const lathe = new THREE.LatheGeometry([[0, 0], [0.09, 0], [0.03, 0.03], [0.025, 0.13], [0.1, 0.17], [0.12, 0.32], [0.11, 0.33]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
  const cm = new THREE.Mesh(lathe, M.gold); cm.castShadow = true; cup.add(cm);
  for (const s of [-1, 1]) { const hd = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 4, 10, Math.PI), M.gold); hd.rotation.z = -s * Math.PI / 2; hd.position.set(s * 0.12, 0.25, 0); cup.add(hd); }
  cup.visible = award === 2;
  const shower = petals(Number(args.seed || 1) + 7);
  group.add(shower.group);
  const guards = [-1, 1].map((s) => { const g = bannerGuard(M); g.P.root.position.set(s * 2.6, 0.6, -9.1); group.add(g.P.root); return g.P; });
  const W = person(M, title === 'noble' ? NOBLE : JOBS[winner.job]?.color || JOBS.guard.color);
  if (title === 'noble') nobleAttire(W, M); // owner 2026-11-07: light blue, with a cloak
  if (title === 'knight') plateArmor(W, M); // owner 2026-11-01: the new Knight comes to be knighted in shining armour
  group.add(W.root);
  const labels = [];
  const subOf = () => ({ cavalier: 'Now a Cavalier!', knight: 'Now a Knight!', noble: 'Now a Noble!' })[title];
  const wTag = { ...castTag(winner), P: W, sub0: castTag(winner).sub };
  labels.push(wTag, { pos: toWorld(new THREE.Vector3(KING.x, KING.y + 2.45, KING.z)), title: 'The King', sub: '', fixed: true });
  // the other riders and the named villagers of the stands line the carpet, facing it
  const line = [...(story.riders || []).filter((c) => c.id !== winner.id), ...(story.crowd || [])].slice(0, 8);
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
    banner: { cavalier: 'A new Cavalier!', knight: 'A new Knight!', noble: 'A new Noble!' }[title],
    focus: toWorld(new THREE.Vector3(0, 1.5, -7.4)),
    cam(u) {
      const k = ease(u);
      // (1) from the other side and lower, the cloak and the raised arms against the throne
      if (award === 1) return { pos: toWorld(new THREE.Vector3(-1.6 + 0.3 * k, 3.0, -1.6 - 0.8 * k)), look: toWorld(new THREE.Vector3(0.3, 1.3, -7.3)), fov: 56 };
      // (2) low on the carpet behind the winner, who turns round to the camera with the cup
      if (award === 2) return { pos: toWorld(new THREE.Vector3(1.5 - 0.2 * k, 2.5, -2.0 - 0.7 * k)), look: toWorld(new THREE.Vector3(-0.15, 1.5, -7.4)), fov: 56 };
      // (0) from beside the carpet, over the heads of the ones lining it, drifting in toward the dais: the King and the winner
      // side by side in the frame
      return { pos: toWorld(new THREE.Vector3(3.0 - 0.6 * k, 3.4 - 0.2 * k, 1.0 - 2.6 * k)), look: toWorld(new THREE.Vector3(0, 1.4, -7.6)), fov: 62 };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      group.visible = on;
      for (const l of lights) { l.visible = on; l.intensity = on ? (l === fill ? 14 : 10) * (1 + 0.08 * Math.sin(t * 11 + l.position.z)) : 0; }
      if (!on) return;
      const u = clamp01((t - t0) / (t1 - t0));
      flames.forEach((f, k) => flicker(f, t, k * 2));
      if (award === 1) { cloakCeremony(u, t, t0); finish(u, t, 0.66); return; }
      if (award === 2) { cupCeremony(u, t, t0); finish(u, t, 0.62); return; }
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
      finish(u, t, TAPS[2] + 0.04); // the hall cheers once the title is given
    },
  };

  /** The winner up the carpet (to z), down on one knee; `up` 0..1 rises again and turns to the hall. */
  function winnerAt(u, t, t0, z, walkEnd, downEnd, up) {
    const walk = clamp01(u / walkEnd), down = clamp01((u - walkEnd) / (downEnd - walkEnd));
    const kneel = down * (1 - up);
    W.root.position.set(0, -0.45 * kneel, lerpN(-1.5, z, ease(walk)));
    W.root.rotation.y = Math.PI + Math.PI * ease(up);
    if (walk < 1) stride(W, (t - t0) * 6, 0.45);
    else { W.legs[0].rotation.x = -1.3 * kneel; W.legs[1].rotation.x = 0.4 * kneel; }
    W.body.rotation.x = 0.35 * kneel;
    W.r.g.rotation.set(-0.1, 0, -0.05); W.l.g.rotation.set(-0.1, 0, 0.05);
  }
  // (1) the cloak: the King down the steps with it, over the winner's head onto the shoulders, then the arm raised
  function cloakCeremony(u, t, t0) {
    const up = clamp01((u - 0.62) / 0.1);
    winnerAt(u, t, t0, KNEEL.z + 0.3, 0.26, 0.33, up);
    const down = ease(clamp01((u - 0.3) / 0.12)); // the King comes down to the carpet
    const beside = ease(clamp01((u - 0.64) / 0.1)); // ...and to the winner's side, facing the hall
    K.root.position.set(0.85 * beside, lerpN(KING.y, 0.3, down), lerpN(KING.z, -7.25, down) + 0.55 * beside);
    K.root.rotation.y = (Math.PI / 2) * Math.sin(Math.PI * beside); // sideways while stepping over, then to the hall again
    if ((down > 0 && down < 1) || (beside > 0 && beside < 1)) stride(K, t * 6, 0.3);
    const lay = ease(clamp01((u - 0.44) / 0.14)); // the cloak from his hands over the head to the back
    if (u < 0.58) {
      if (cloak.parent !== group) group.add(cloak);
      const from = new THREE.Vector3(0, 1.45 + lerpN(KING.y, 0.3, down), K.root.position.z + 0.35);
      const over = new THREE.Vector3(0, 1.85, KNEEL.z + 0.3);
      cloak.position.copy(lay < 0.5 ? from.lerp(over, lay * 2) : over.lerp(new THREE.Vector3(0, 0.95, KNEEL.z + 0.62), lay * 2 - 1));
      cloak.rotation.set(0, 0, 0);
      K.r.g.rotation.set(-1.5 - 0.9 * Math.sin(Math.PI * lay), 0, -0.2); K.l.g.rotation.set(-1.5 - 0.9 * Math.sin(Math.PI * lay), 0, 0.2);
    } else {
      if (cloak.parent !== W.body) W.body.add(cloak);
      cloak.position.set(0, 0.78, -0.36); cloak.rotation.set(0.05, 0, 0);
      K.r.g.rotation.set(-0.3, 0, -0.2); K.l.g.rotation.set(beside > 0.9 ? -2.7 : -0.3, 0, 0.35); // the winner's arm up with the King's
      if (beside > 0.9) W.r.g.rotation.set(-2.7, 0, -0.3);
      if (u > 0.78) W.l.g.rotation.set(-2.6 + 0.2 * Math.sin(t * 8), 0, 0.3);
    }
    K.body.rotation.x = 0;
    wTag.sub = u > 0.58 ? subOf() : wTag.sub0;
    shower.at(t, clamp01((u - 0.64) / 0.1), 0.4, 0.3, KNEEL.z + 0.3, 2.4);
  }
  // (2) the cup: the King holds it out from the step, the kneeling winner takes it, rises, turns and lifts it high
  function cupCeremony(u, t, t0) {
    const up = clamp01((u - 0.56) / 0.1);
    winnerAt(u, t, t0, KNEEL.z, 0.28, 0.36, up);
    const reach = ease(clamp01((u - 0.36) / 0.12));
    K.r.g.rotation.set(lerpN(-0.4, -1.45, reach), 0, -0.1); K.l.g.rotation.set(-0.3, 0, 0.15);
    K.body.rotation.x = u < 0.56 ? 0.15 * reach : 0;
    if (u < 0.5) { if (cup.parent !== K.r.hand) K.r.hand.add(cup); cup.position.set(0, -0.12, 0.1); cup.rotation.set(-K.r.g.rotation.x, 0, 0); } // held upright
    else {
      if (cup.parent !== W.r.hand) W.r.hand.add(cup);
      cup.position.set(0, -0.12, 0.1);
      W.r.g.rotation.set(u > 0.66 ? -2.9 + 0.12 * Math.sin(t * 7) : -1.3, 0, -0.1);
      if (u > 0.66) W.l.g.rotation.set(-2.5, 0, 0.3);
      cup.rotation.set(-W.r.g.rotation.x, 0, 0);
      if (u > 0.68) { K.r.g.rotation.set(-1.7 + 0.25 * Math.sin(t * 10), 0, 0.3); K.l.g.rotation.set(-1.7 - 0.25 * Math.sin(t * 10), 0, -0.3); } // the King claps
    }
    wTag.sub = u > 0.5 ? subOf() : wTag.sub0;
    shower.at(t, clamp01((u - 0.62) / 0.1), 0, 0.3, KNEEL.z + 0.5, 2.6);
  }
  /** The guards, the hall cheering from `from`, the tags. */
  function finish(u, t, from) {
    guards.forEach((P) => { P.r.g.rotation.set(-0.35, 0, 0); });
    for (const { P, i } of crowd) {
      const cheer = u > from;
      const ph = t * 8 + i;
      P.r.g.rotation.set(cheer ? -2.7 + 0.3 * Math.sin(ph) : -0.15, 0, -0.2);
      P.l.g.rotation.set(cheer && i % 2 ? -2.5 : -0.15, 0, 0.2);
    }
    if (award === 0) shower.at(t, 0, 0, 0, 0);
    for (const l of labels) if (!l.fixed) l.pos.copy(toWorld(tmp.copy(l.P.root.position).setY(l.P.root.position.y + 2.3)));
  }
}

const lerpN = THREE.MathUtils.lerp;
