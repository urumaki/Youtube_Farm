// Guards up on the walls (owner 2026-10-21), on the castle's wall walk or on top of the Second Wall once it
// is finished: the day watch (a guard walks the wall, stops and looks out over the land), the night watch
// (the same at dusk, by a brazier burning on the wall walk) and the changing of the guard (the new guard
// marches up, both salute, the old guard marches off and the new one takes the post). Some guards carry a
// bow and a quiver instead of the spear. Same interface as the other away scenes: { group, labels,
// labelPos, banner, focus, cam, update, phase? }.
import * as THREE from 'three';
import { JOBS } from '../../sim/tiers.js';
import { rand01 } from '../../sim/prng.js';
import { heightAt } from '../../sim/world.js';
import { wallLayout } from '../../sim/wall.js';
import { ROYAL } from './textures.js';
import { boxGeo, cylGeo } from './kit.js';
import { toolGeo } from './work.js';
import { person, stride, castTag, flameMaterial, flicker, ease, clamp01 } from './stories/common.js';

const lerp = THREE.MathUtils.lerp;
// from one heading toward another the short way round
const turnTo = (from, to, k) => from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * k;
const WALL2_H = 9; // the Second Wall's height above the ground (buildings.js buildWall2)
const BOW_SHARE = 0.4; // about this many guards on the walls carry a bow

/** A longbow held at the side in the left hand (hand frame, arm along -y): stave upright, string inward. */
function bow(M) {
  const g = new THREE.Group();
  const stave = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.02, 5, 20, Math.PI * 0.8).rotateZ(Math.PI * 0.6).translate(0.62, 0, 0), M.woodDark);
  stave.castShadow = true;
  g.add(stave);
  const end = [0.62 + 0.62 * Math.cos(Math.PI * 0.6), 0.62 * Math.sin(Math.PI * 0.6)];
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(end[0], end[1], 0), new THREE.Vector3(end[0], -end[1], 0)]), new THREE.LineBasicMaterial({ color: '#efe6d2' })));
  g.rotation.y = Math.PI / 2; // the bow's plane along the way the guard faces
  return g;
}

/** A quiver of arrows on the back. */
function quiver(M) {
  const g = new THREE.Group();
  g.add(Object.assign(new THREE.Mesh(cylGeo(0.08, 0.07, 0.6, 8), M.woodDark), { castShadow: true }));
  for (let i = 0; i < 4; i++) g.add(new THREE.Mesh(boxGeo(0.07, 0.1, 0.01).translate((i % 2 - 0.5) * 0.06, 0.36, (i < 2 ? -1 : 1) * 0.02), M.clothIvory));
  g.position.set(0.12, 0.62, -0.24);
  g.rotation.z = -0.35;
  return g;
}

/** A guard with a helmet and a spear, or (archer) a bow and a quiver. */
function guard(M, color, archer) {
  const P = person(M, color);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 1.18, 0), M.iron);
  helm.castShadow = true;
  P.body.add(helm);
  if (archer) { P.l.hand.add(bow(M)); P.body.add(quiver(M)); } else P.r.hand.add(toolGeo('spear', M));
  P.archer = archer;
  return P;
}

/** Arms while walking: the spear upright at the shoulder, or the bow carried low at the side. */
function carry(P, ph) {
  const s = Math.sin(ph);
  if (P.archer) { P.l.g.rotation.set(-0.15 + 0.12 * s, 0, 0.08); P.r.g.rotation.set(-0.3 * s, 0, 0); }
  else { P.r.g.rotation.set(-0.35, 0, 0); P.l.g.rotation.set(0.3 * s, 0, 0); }
}

/** Standing and looking out: the free hand shades the eyes now and then. */
function lookOut(P, q, t) {
  const shade = q * clamp01(Math.sin(t * 0.9) * 3 + 1.5);
  const hand = P.archer ? P.r : P.l;
  hand.g.rotation.set(lerp(0, -2.35, shade), 0, (P.archer ? -1 : 1) * lerp(0, 0.55, shade)); // in toward the brow
  if (P.archer) P.l.g.rotation.set(-0.15, 0, 0.08);
  else P.r.g.rotation.set(-0.35, 0, 0);
}

/** A fire basket on three legs, lit at dusk. Returns { group, update(t) }. */
function brazier(M) {
  const group = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(cylGeo(0.025, 0.025, 1.0, 5), M.iron);
    leg.position.set(Math.cos(a) * 0.2, 0.48, Math.sin(a) * 0.2);
    leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    group.add(leg);
  }
  group.add(new THREE.Mesh(cylGeo(0.32, 0.18, 0.22, 10).translate(0, 1.0, 0), M.iron));
  const flames = [['#ff7a1a', 0.26, 0.6], ['#ffb347', 0.18, 0.45], ['#ffe08a', 0.1, 0.3]].map(([c, r, h], k) => {
    const f = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8).translate(0, h / 2, 0), flameMaterial(c));
    f.position.y = 1.08;
    f.userData.k = k;
    group.add(f);
    return f;
  });
  const light = new THREE.PointLight('#ff9a4a', 18, 16, 1.8);
  light.position.y = 1.5;
  group.add(light);
  return {
    group,
    update(t, on) {
      light.visible = on;
      for (const f of flames) flicker(f, t, f.userData.k * 3);
      light.intensity = 18 * (1 + 0.1 * Math.sin(t * 17) + 0.06 * Math.sin(t * 29));
    },
  };
}

/**
 * The stretch of wall walk the scene uses: { a, dir, len, inside } (a at the walking height, dir along the
 * walk, inside: across it toward the town or the courtyard). The castle: one of its three long wall walks;
 * the Second Wall: a long straight piece near the town, picked per day.
 */
function walkOf({ where, castle, w, state, pick }) {
  if (where === 'wall2') {
    const pieces = wallLayout(w, state.wall2.pts).pieces.filter((s) => s.hw * 2 >= 12)
      .sort((p, q) => Math.hypot(p.x - 102, p.z) - Math.hypot(q.x - 102, q.z)).slice(0, 6);
    const s = pieces[Math.floor(pick * pieces.length)];
    const c = Math.cos(s.rot), sn = Math.sin(s.rot);
    const y = Math.max(heightAt(w, s.x, s.z), 1.6) + WALL2_H;
    const out = ((s.x - 150) * -sn + s.z * c) > 0 ? 1 : -1; // as the battlements in buildWall2
    return { a: new THREE.Vector3(s.x - c * s.hw, y, s.z - sn * s.hw), dir: new THREE.Vector3(c, 0, sn), len: s.hw * 2, inside: new THREE.Vector3(sn * out, 0, -c * out), lane: 0.4 };
  }
  const walk = castle.guardWalks[Math.floor(pick * 3)];
  const a = new THREE.Vector3(...walk.a), b = new THREE.Vector3(...walk.b);
  const dir = b.clone().sub(a).normalize();
  const mid = a.clone().lerp(b, 0.5);
  const inside = new THREE.Vector3(-dir.z, 0, dir.x);
  if (inside.x * -mid.x + inside.z * -mid.z < 0) inside.negate(); // toward the keep
  return { a, dir, len: a.distanceTo(b), inside, lane: 0.5 };
}

/**
 * @param where  'castle' | 'wall2'
 * @param mode   'day' | 'night' | 'change'
 * @param hero   the named guard shown (or null); `tag` puts a small name tag on them (everyday shots)
 */
export function buildWallWatch({ where = 'castle', mode = 'day', castle, w, state, M, seed, hero, lang, tag = true }) {
  const it = lang === 'it';
  const pick = rand01(seed, 'wallwatch', state.day, hero?.id ?? -1);
  const { a, dir, len, inside, lane } = walkOf({ where, castle, w, state, pick });
  const at = (s, side = lane) => a.clone().addScaledVector(dir, s).addScaledVector(inside, side);
  const faceAlong = Math.atan2(dir.x, dir.z), faceBack = Math.atan2(-dir.x, -dir.z), faceOut = Math.atan2(-inside.x, -inside.z);
  const group = new THREE.Group();
  group.visible = false;
  const archer = (id) => hero?.job === 'guard' && rand01(seed, 'bow', id) < BOW_SHARE;
  const heroColor = hero ? JOBS[hero.job]?.color || ROYAL.blue : ROYAL.blue;
  const H = guard(M, heroColor, hero ? archer(hero.id) : rand01(seed, 'bow', state.day) < BOW_SHARE);
  group.add(H.root);
  const mid = len / 2;
  // the post: where the guard stops and looks out (by the brazier at night)
  const post = mid + 0.8;
  const fire = mode === 'night' ? brazier(M) : null;
  if (fire) {
    fire.group.position.copy(at(post + 1.1, lane - 0.9));
    group.add(fire.group);
  }
  // the changing of the guard: the old guard stands at the post when the new one marches up
  const old = mode === 'change' ? guard(M, ROYAL.blue, !H.archer && rand01(seed, 'bow2', state.day) < 0.5) : null;
  if (old) group.add(old.root);
  const sub = mode === 'change' ? (it ? 'Cambio della guardia' : 'Changing of the guard') : mode === 'night' ? (it ? 'Guardia notturna' : 'Night watch') : it ? 'Di ronda' : 'On patrol';
  const labels = hero && tag ? [castTag(hero, lang, sub)] : [];
  const labelPos = new THREE.Vector3();
  const second = where === 'wall2';
  const banner = mode === 'change' ? (it ? 'Il cambio della guardia' : 'Changing of the guard')
    : mode === 'night' ? (it ? (second ? 'Di notte sulle seconde mura' : 'Di notte sulle mura') : second ? 'Night on the Second Wall' : 'Night on the walls')
      : it ? (second ? 'Di ronda sulle seconde mura' : 'Ronda sulle mura') : second ? 'Watch on the Second Wall' : 'Watch on the walls';
  // the day and night watch: walk 3.5 m to the post (60% of the shot), turn and look out
  const WALK = 3.5, STOP = 0.6;
  const walkS = (u) => post - WALK + WALK * ease(clamp01(u / STOP));
  // the changing of the guard: the new guard marches up (to 35%), both salute (to 60%), the old guard
  // marches off along the wall while the new one steps onto the post and turns to look out
  const newS = (u) => (u < 0.35 ? lerp(post - 6.5, post - 1.4, u / 0.35) : u < 0.6 ? post - 1.4 : lerp(post - 1.4, post, ease(clamp01((u - 0.6) / 0.2))));
  const oldS = (u) => (u < 0.62 ? post : post + (u - 0.62) * 9);
  const focus = at(post - 1, 0).setY(a.y + 1.2);
  const tmp = new THREE.Vector3();
  return {
    group,
    labels,
    labelPos,
    banner,
    phase: mode === 'night' ? 1 : undefined, // dusk, the windows lit
    quietCastle: where === 'castle', // the castle's own walking guards keep off (main.js)
    focus,
    cam(u) {
      if (mode === 'change') {
        // down the wall walk from ahead, above the inner parapet: the new guard marching up, both guards
        // face to face, the old one leaving past the camera on the outer side
        const c = at(post + 5.5 - 1.0 * u, 1.3);
        return { pos: c.setY(a.y + 2.6), look: at(post - 1.5, 0).setY(a.y + 1.0) };
      }
      // ahead of the guard and over the town side, looking back at them; it slows with them at the post
      const g = at(walkS(u), 0);
      return { pos: g.clone().addScaledVector(dir, 5 - 0.8 * u).addScaledVector(inside, 2.4).setY(a.y + 2.3), look: g.clone().addScaledVector(inside, -0.6).setY(a.y + 1.1) };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.1 && t <= t1 + 0.1;
      group.visible = on;
      fire?.update(t, on);
      if (!on) return;
      const u = clamp01((t - t0) / (t1 - t0));
      if (mode !== 'change') {
        const s = walkS(u), moving = u < STOP;
        H.root.position.copy(at(s));
        const turn = ease(clamp01((u - STOP) / 0.12));
        H.root.rotation.y = turnTo(faceAlong, faceOut, turn);
        stride(H, s * 3.2, moving ? 0.45 * (1 - clamp01((u - STOP + 0.08) / 0.08)) : 0, { arms: false });
        if (turn < 0.5) carry(H, s * 3.2); else lookOut(H, clamp01((u - STOP - 0.12) / 0.1), t);
      } else {
        // the new guard (the hero)
        const s = newS(u);
        H.root.position.copy(at(s));
        const walking = u < 0.35 || (u > 0.6 && u < 0.8);
        const turnOut = ease(clamp01((u - 0.8) / 0.1));
        H.root.rotation.y = turnTo(faceAlong, faceOut, turnOut);
        stride(H, s * 3.2, walking ? 0.45 : 0, { arms: false });
        const salute = Math.sin(Math.PI * clamp01((u - 0.4) / 0.18));
        if (turnOut > 0.5) lookOut(H, clamp01((u - 0.9) / 0.08), t);
        else if (salute > 0) salute1(H, salute);
        else carry(H, s * 3.2);
        // the old guard: looking out, turns to face the new one, salutes, then turns and marches off
        const so = oldS(u);
        old.root.position.copy(at(so, lerp(lane, -0.5, ease(clamp01((u - 0.62) / 0.1))))); // leaves on the outer side
        const toNew = ease(clamp01((u - 0.28) / 0.08)), away = ease(clamp01((u - 0.6) / 0.06));
        old.root.rotation.y = u < 0.6 ? turnTo(faceOut, faceBack, toNew) : faceBack + Math.PI * away; // an about-turn
        stride(old, so * 3.2, u > 0.64 ? 0.45 : 0, { arms: false });
        if (u < 0.3) lookOut(old, 1, t + 2);
        else if (salute > 0) salute1(old, salute);
        else carry(old, so * 3.2);
      }
      H.root.getWorldPosition(tmp);
      labelPos.copy(tmp).setY(a.y + 2.45);
      if (labels[0]) labels[0].pos.copy(labelPos);
    },
  };
}

/** The salute: the spear raised in front, or the right hand to the brow (an archer). */
function salute1(P, q) {
  if (P.archer) { P.r.g.rotation.set(lerp(0, -2.5, q), 0, lerp(0, 0.6, q)); P.l.g.rotation.set(-0.15, 0, 0.08); }
  else { P.r.g.rotation.set(lerp(-0.35, -1.05, q), 0, 0); P.l.g.rotation.set(0, 0, 0); }
}
