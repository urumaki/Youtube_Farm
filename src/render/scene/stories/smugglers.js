// The smugglers (owner 2026-11-23, src/sim/stories.js `smugglers`): two nights that take the whole video, one shot after
// another (timeline.js, SMUGGLER_SHOTS), at a harbour of its own east of the map (like the Crusade's country), at night and
// in the mist. Day 1 ('watch'): the harbour at midnight, the guards hidden behind barrels and crates, a boat with no lights
// glides out of the mist to the jetty, dark figures carry crates to the shed, a guard holds back a sneeze... and sneezes;
// the smugglers freeze and turn: "To be continued...". Day 2 ('chase'): the guards leap up, the smugglers drop the crates
// and run, the chase along the quay, the smugglers off the end of the jetty into the water one after another, fished out
// in a net at dawn by the fishermen, and the crates opened: the smuggled goods (story.cargo). Then the usual wide shot,
// goal and call to action. Smugglers have no names (outfits.js BANDIT); the guards wear theirs (story.guards). Nobody
// gets hurt: a splash and a cold bath.
// Frame: x along the quay, z toward the land (the water at z < 0), y up from the quay's deck.
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { JOBS } from '../../../sim/tiers.js';
import { heightAt } from '../../../sim/world.js';
import { boxGeo, cylGeo } from '../kit.js';
import { BANDIT } from '../outfits.js';
import { particles } from '../work.js';
import { person, stride, castTag, flameMaterial, flicker, ease, clamp01, apart } from './common.js';
import { NIGHT, nightLights } from './raid.js';

export const SMUGGLER_SHOTS = {
  watch: [['harbor', 0, 4.5], ['hide', 4.5, 9], ['boat', 9, 14], ['unload', 14, 20], ['sneeze', 20, 30]],
  chase: [['caught', 0, 4], ['run', 4, 9], ['splash', 9, 13.5], ['net', 13.5, 18.5], ['crates', 18.5, 23.5]],
};
const X0 = 7000, Z0 = 0; // the set's place in the world
const JX = 6, JEND = -10; // the jetty: its x, how far out it goes
const SHED = new THREE.Vector3(-6, 0, 6.5); // the shed's door
const HIDE = new THREE.Vector3(-12, 0, 3); // the barrels the guards hide behind
const WATER = -1.3;
const lerp = THREE.MathUtils.lerp;
const span = (u, a, b) => clamp01((u - a) / (b - a));

let SET = null;
/** The harbour, built once and shared by the shots (each shot's group takes it while on screen). */
function harbour(w, M, seed) {
  if (SET && SET.M === M && SET.seed === seed) return SET;
  // the deck stands above the land's own heights there, so the camera never meets the ground
  let top = -Infinity;
  for (let x = -40; x <= 40; x += 8) for (let z = -40; z <= 20; z += 8) top = Math.max(top, heightAt(w, X0 + x, Z0 + z));
  const y0 = top + 2;
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#0f1c26', roughness: 0.15, metalness: 0.4 }));
  water.position.set(0, WATER, -150);
  g.add(water);
  // the quay: a stone wall to the water, a deck of planks, the land behind
  add(boxGeo(60, 2, 1.2), M.stoneDark, 0, -1, 0.1);
  add(boxGeo(60, 0.25, 14), M.wood, 0, -0.12, 7.4);
  add(boxGeo(80, 1, 60), M.dirt, 0, -0.62, 44);
  // the jetty on posts
  add(boxGeo(2.2, 0.2, -JEND), M.wood, JX, -0.1, JEND / 2);
  for (let z = -1; z > JEND; z -= 2.2) for (const s of [-1, 1]) add(cylGeo(0.12, 0.14, 2.6, 6), M.woodDark, JX + s * 1.0, -1.2, z);
  // the shed
  add(boxGeo(7, 3.6, 5), M.timber || M.plaster, SHED.x, 1.8, SHED.z + 2.6);
  add(boxGeo(7.6, 0.25, 6).rotateZ(0), M.slate || M.roofRed, SHED.x, 3.75, SHED.z + 2.6);
  add(boxGeo(1.6, 2.4, 0.1), M.woodDark, SHED.x, 1.2, SHED.z + 0.08);
  // barrels and crates: the guards' hiding place, and stacks along the quay
  const barrel = cylGeo(0.42, 0.42, 1.0, 12);
  for (let i = 0; i < 6; i++) add(barrel, M.wood, HIDE.x - 1.5 + (i % 3) * 0.95, 0.5, HIDE.z - 1.2 + Math.floor(i / 3) * 0.9);
  for (let i = 0; i < 3; i++) add(barrel, M.wood, HIDE.x - 1.0 + i * 0.95, 1.5, HIDE.z - 0.75);
  for (let i = 0; i < 5; i++) add(boxGeo(0.9, 0.8, 0.9), M.woodDark, 12 + (i % 3) * 1.0, 0.4 + Math.floor(i / 3) * 0.8, 3 + (i % 2) * 0.3);
  // moored fishing boats, masts up
  for (const [x, z] of [[-18, -2.6], [-26, -2.6], [16, -2.6]]) {
    add(boxGeo(1.8, 0.7, 4.6), M.woodDark, x, WATER + 0.25, z, Math.PI / 2);
    add(cylGeo(0.07, 0.08, 5, 6), M.wood, x, WATER + 2.8, z);
  }
  // two lanterns on posts along the quay (warm pools of light in the mist)
  const lamps = [];
  for (const x of [-15, 9.5]) {
    add(cylGeo(0.08, 0.1, 3, 6), M.woodDark, x, 1.5, 1.2);
    const f = add(new THREE.ConeGeometry(0.1, 0.3, 8), flameMaterial('#ffb347'), x, 3.05, 1.2);
    const l = new THREE.PointLight('#ffb066', 0, 14, 1.6);
    l.position.set(x, 3.1, 1.2);
    g.add(l);
    lamps.push({ f, l });
  }
  // the smugglers' boat: dark, low, no light
  const boat = new THREE.Group();
  const bb = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; boat.add(o); return o; };
  const tar = new THREE.MeshStandardMaterial({ color: '#1a1512', roughness: 0.8 });
  bb(boxGeo(2.2, 0.9, 6.2), tar, 0, 0, 0);
  bb(boxGeo(1.6, 0.2, 5.4), M.woodDark, 0, 0.4, 0);
  bb(cylGeo(0.08, 0.09, 4.5, 6), M.woodDark, 0, 2.6, -0.5);
  bb(new THREE.PlaneGeometry(2.2, 2.6), new THREE.MeshStandardMaterial({ color: '#2d2a28', side: THREE.DoubleSide }), 0, 2.8, -0.45).rotation.y = Math.PI / 2;
  for (let i = 0; i < 4; i++) bb(boxGeo(0.7, 0.6, 0.7), M.woodDark, -0.45 + (i % 2) * 0.9, 0.75, -1.5 + Math.floor(i / 2) * 1.6);
  g.add(boat);
  const moon = nightLights(g, 1.7); // (the dark of midnight: a stronger moonlight keeps the people readable)
  const splash = particles(90, '#cfe3ee', 0.13, false);
  g.add(splash);
  SET = { M, seed, g, y0, lamps, boat, moon, splash };
  return SET;
}

/** The guards (named first) and the smugglers as rigs. */
function people(M, story, group) {
  const guards = (story.guards || []).slice(0, 4).map((c, i) => {
    const P = person(M, JOBS.guard.color);
    P.c = c || { name: null, job: 'guard' };
    P.i = i;
    group.add(P.root);
    return P;
  });
  const smugglers = Array.from({ length: story.smugglers || 4 }, (_, i) => {
    const P = person(M, BANDIT);
    P.i = i;
    const crate = new THREE.Mesh(boxGeo(0.6, 0.5, 0.5), M.woodDark);
    crate.castShadow = true;
    crate.position.set(-0.3, -0.25, 0.3);
    P.r.hand.add(crate);
    P.crate = crate;
    group.add(P.root);
    return P;
  });
  return { guards, smugglers };
}

function base(args) {
  const { story, M, w, seed } = args;
  const S = harbour(w, M, seed);
  const group = new THREE.Group();
  group.position.set(X0, S.y0, Z0);
  group.visible = false;
  const { guards, smugglers } = people(M, story, group);
  const toWorld = (x, y, z) => new THREE.Vector3(X0 + x, S.y0 + y, Z0 + z);
  const tags = guards.filter((P) => P.c?.name).map((P) => ({ P, ...castTag(P.c), pos: new THREE.Vector3() }));
  const tmp = new THREE.Vector3();
  const place = (ls) => { group.updateMatrixWorld(true); for (const l of ls) l.pos.copy(l.P.root.getWorldPosition(tmp)).setY(tmp.y + 2.3); };
  return { S, group, guards, smugglers, toWorld, tags, place, seed, sneezer: story.sneezer ?? 0, story, M };
}

const pose0 = (P) => { P.body.rotation.set(0, 0, 0); for (const l of P.legs) l.rotation.set(0, 0, 0); P.r.g.rotation.set(0, 0, 0); P.l.g.rotation.set(0, 0, 0); P.root.rotation.set(0, 0, 0); };
const at = (P, x, z, dx, dz, y = 0) => { P.root.position.set(x, y, z); P.root.rotation.y = Math.atan2(dx, dz); };
/** Crouched behind the barrels (k 1) or standing (0). */
const crouch = (P, k) => { P.root.position.y -= 0.45 * k; P.body.rotation.x = 0.5 * k; for (const l of P.legs) l.rotation.x = -0.9 * k; };
/** Where the smugglers' boat is: gliding in out of the mist (k 0..1) to the end of the jetty. */
function boatAt(S, k, bob = 0) {
  S.boat.position.set(JX + 2.4, WATER + 0.35 + bob, lerp(-45, JEND + 1.5, ease(k)));
  S.boat.rotation.set(0, 0, 0.03 * Math.sin(bob * 20));
}
function splashAt(S, seed, x, z, age) {
  const arr = S.splash.geometry.attributes.position.array;
  for (let i = 0; i < 90; i++) {
    if (age < 0 || age > 1.1) { arr[i * 3 + 1] = -1e4; continue; }
    const a = rand01(seed, 'smsp', i) * 6.28, v = 0.6 + rand01(seed, 'smsp', i, 1) * 1.6;
    arr[i * 3] = x + Math.cos(a) * v * age;
    arr[i * 3 + 1] = WATER + (2.5 + rand01(seed, 'smsp', i, 2) * 2.5) * age - 4.9 * age * age;
    arr[i * 3 + 2] = z + Math.sin(a) * v * age;
  }
  S.splash.geometry.attributes.position.needsUpdate = true;
}

function shot(args, def) {
  const B = base(args);
  const { seed } = args;
  def.setup?.(B);
  return {
    group: B.group, labels: def.labels ? def.labels(B) : B.tags, banner: def.banner ?? null, phase: def.phase ?? NIGHT, fog: def.fog ?? 0.018,
    deep: def.deep ?? ((def.phase ?? NIGHT) >= 0.9 ? 1 : 0), // the moonlit dark of midnight (env.js), not the purple of dusk
    ...(def.bannerAt ? { bannerAt: def.bannerAt } : {}), ...(def.low ? { low: true } : {}), ...(def.phaseAt ? { phaseAt: def.phaseAt } : {}),
    focus: B.toWorld(...def.focus),
    cam: (u) => { const c = def.cam(u); return { pos: B.toWorld(...c[0]), look: B.toWorld(...c[1]) }; },
    update(t, t0, t1) {
      const on = t >= t0 - 0.05 && t <= t1 + 0.05;
      if (on && B.S.g.parent !== B.group) B.group.add(B.S.g);
      B.group.visible = on;
      for (const { f, l } of B.S.lamps) { l.visible = on; l.intensity = on ? 9 : 0; flicker(f, t, l.position.x); }
      B.S.moon.visible = on && (def.phase ?? NIGHT) > 0.5;
      if (!on) return;
      const u = clamp01((t - t0) / (t1 - t0));
      for (const P of [...B.guards, ...B.smugglers]) pose0(P);
      splashAt(B.S, seed, 0, 0, -1);
      boatAt(B.S, 0);
      def.play(B, t, u, t1 - t0);
      apart([...B.guards, ...B.smugglers, ...(B.nets || []), ...(B.crowd || [])], 0.55); // nobody through anybody (owner 2026-11-23)
      B.place(def.labels ? def.labels(B) : B.tags);
    },
  };
}

// guards behind the barrels, where each one crouches
const HIDDEN = [[-12.8, 4.6], [-11.8, 4.9], [-10.8, 4.6], [-12.2, 5.6]];
const hidden = (B, k = 1, look = 0) => B.guards.forEach((P, i) => { at(P, ...HIDDEN[i], 0.4 + look, -1); crouch(P, k); });
/** The smugglers along their way from the boat to the shed (s 0..1 each, staggered). */
function carry(B, t, u, { from = 0, to = 1 } = {}) {
  B.smugglers.forEach((P, i) => {
    const s = clamp01(lerp(from, to, u) * 1.6 - i * 0.18);
    // the jetty from its end to the quay, then along the quay to the shed's door
    const leg1 = clamp01(s / 0.55), leg2 = clamp01((s - 0.55) / 0.45);
    const x = leg2 > 0 ? lerp(JX, SHED.x + 0.5, leg2) : JX + (i % 2 ? 0.35 : -0.35);
    const z = leg2 > 0 ? lerp(0.8, SHED.z - 0.4, leg2) : lerp(JEND + 1, 0.8, leg1);
    at(P, x, z, leg2 > 0 ? -1 : 0, leg2 > 0 ? 0.4 : 1);
    if (s > 0 && s < 1) stride(P, t * 7 + i, 0.4);
    P.r.g.rotation.set(-1.3, 0, 0.3); P.l.g.rotation.set(-1.3, 0, -0.3); // the crate held in both arms
    P.root.visible = s > 0;
  });
}

const WATCH = {
  harbor: {
    banner: 'The harbour, at midnight', focus: [0, 1, 0], fog: 0.016,
    cam: (u) => [[-5 + 4 * u, 3.0, 11.5 - u], [2, 0.4, -6]],
    labels: () => [],
    play(B, t) { hidden(B); for (const P of B.smugglers) P.root.visible = false; boatAt(B.S, 0); },
  },
  hide: {
    banner: 'The guards lie in wait', focus: [HIDE.x, 0.8, HIDE.z + 1.5], low: true,
    cam: (u) => [[HIDE.x + 7 - 0.8 * u, 2.0, HIDE.z + 5.5], [HIDE.x - 0.6, 0.7, HIDE.z + 2.4]],
    play(B, t, u) {
      hidden(B);
      B.guards[1] && (B.guards[1].root.rotation.y += 0.8 * Math.sin(Math.PI * span(u, 0.3, 0.7))); // a whisper to the next one
      B.guards[0] && B.guards[0].r.g.rotation.set(-2.2, 0, 0.4); // "shh"
      for (const P of B.smugglers) P.root.visible = false;
    },
  },
  boat: {
    banner: 'A boat with no lights...', focus: [JX + 2, 0, -8], fog: 0.022,
    cam: (u) => [[JX - 3, 1.4, 3.5], [JX + 2.4, 0.4, lerp(-30, -9, ease(u))]],
    labels: () => [],
    play(B, t, u) { hidden(B); boatAt(B.S, u, 0.05 * Math.sin(t * 2)); for (const P of B.smugglers) P.root.visible = false; },
  },
  unload: {
    banner: 'Smugglers!', focus: [0, 1, 2],
    cam: (u) => [[HIDE.x + 1.5, 1.3, HIDE.z + 2.4], [lerp(JX, SHED.x, u), 0.9, lerp(-4, 4, u)]],
    labels: (B) => B.tags.slice(0, 2),
    play(B, t, u) { hidden(B, 1, -0.3); boatAt(B.S, 1, 0.04 * Math.sin(t * 2)); carry(B, t, u, { from: 0, to: 0.8 }); },
  },
  sneeze: {
    banner: null, focus: [HIDE.x, 1, HIDE.z],
    bannerAt: (t, t0, t1) => { const u = (t - t0) / (t1 - t0); return u < 0.3 ? 'Ah... ah...' : u < 0.5 ? 'ACHOO!' : 'To be continued...'; },
    // close on the sneezing guard, then from behind the smugglers frozen on the quay, staring at the barrels
    cam: (u) => (u < 0.42 ? [[HIDE.x + 4.6, 1.5, HIDE.z + 5.0], [HIDE.x - 0.6, 0.8, HIDE.z + 2.2]] : [[2.5 - 2 * u, 2.1, -2 - u], [HIDE.x, 0.8, HIDE.z]]),
    labels: (B) => B.tags.filter((l) => l.P.i === (B.sneezer ?? 0)),
    play(B, t, u) {
      hidden(B);
      const S = B.guards[B.sneezer ?? 0] || B.guards[0];
      // the sneeze: head back, back, back... then forward
      const build = span(u, 0.05, 0.3), snap = span(u, 0.3, 0.34);
      S.body.rotation.x = 0.5 - 0.6 * build + 1.0 * snap * (1 - span(u, 0.34, 0.45));
      S.r.g.rotation.set(-2.4 * (1 - snap), 0, 0.3);
      boatAt(B.S, 1, 0.04 * Math.sin(t * 2));
      // the smugglers stop dead, turn their heads to the barrels
      B.smugglers.forEach((P, i) => {
        at(P, -2 + i * 1.4, 1.5 + (i % 2) * 0.6, u > 0.36 ? -1 : -0.2, u > 0.36 ? 0.35 : 1);
        P.r.g.rotation.set(-1.3, 0, 0.3); P.l.g.rotation.set(-1.3, 0, -0.3);
        P.root.visible = true;
      });
    },
  },
};

const CHASE = {
  caught: {
    banner: 'In the name of the King!', focus: [-6, 1, 2],
    cam: (u) => [[-3, 1.8, 7.5 - u], [-8, 1.1, 2.5]],
    play(B, t, u) {
      const up = ease(span(u, 0, 0.3));
      B.guards.forEach((P, i) => { at(P, ...HIDDEN[i], 0.5, -1); crouch(P, 1 - up); if (up >= 1) P.r.g.rotation.set(-2.6, 0, 0.1); });
      boatAt(B.S, 1, 0.04 * Math.sin(t * 2));
      const drop = span(u, 0.35, 0.5), run = span(u, 0.5, 1);
      B.smugglers.forEach((P, i) => {
        at(P, -2 + i * 1.4 + 5 * run * run, 1.5 + (i % 2) * 0.6, run > 0 ? 1 : -1, run > 0 ? -0.3 : 0.35);
        P.crate.visible = drop < 1;
        if (drop >= 1 && !P.dropped) P.crate.position.y = -0.25;
        P.r.g.rotation.set(drop < 1 ? -1.3 : -2.6, 0, 0.3); P.l.g.rotation.set(drop < 1 ? -1.3 : -2.6, 0, -0.3); // hands up... then run
        if (run > 0) stride(P, t * 12 + i, 0.8);
      });
    },
  },
  run: {
    banner: 'After them!', focus: [2, 1, 2], low: true,
    cam: (u) => { const x = lerp(-6, 3, u); return [[x - 1, 1.8, 9.5], [x + 0.5, 0.9, 1.6]]; },
    play(B, t, u) {
      boatAt(B.S, 1, 0.04 * Math.sin(t * 2));
      B.smugglers.forEach((P, i) => { P.crate.visible = false; at(P, lerp(0, JX - 0.5, u) + 1.2 - i * 0.9, 1.2 + (i % 2) * 0.7, 1, -0.2); stride(P, t * 12 + i, 0.85); P.body.rotation.x = 0.2; });
      B.guards.forEach((P, i) => {
        at(P, lerp(-6, JX - 3, u) - i * 1.1, 1.6 + (i % 2) * 0.5, 1, 0);
        // one slips on a fish and slides on his back, the others jump over him
        if (i === 2 && u > 0.45) { P.root.rotation.z = 1.2 * ease(span(u, 0.45, 0.55)); P.root.position.y = -0.5 * span(u, 0.45, 0.55); P.root.position.x += 1.2 * span(u, 0.45, 0.9); }
        else { stride(P, t * 12 + i, 0.85); P.body.rotation.x = 0.2; P.r.g.rotation.set(-1.5, 0, 0); }
      });
    },
  },
  splash: {
    banner: 'SPLASH!', focus: [JX, 0, JEND + 2],
    cam: (u) => [[JX - 5.5, 1.6, JEND + 6 - u], [JX + 1, 0, JEND + 0.5]],
    play(B, t, u, T) {
      // the boat has drifted off the jetty: one after another they run off the end into the water
      B.S.boat.position.set(JX + 5, WATER + 0.35, JEND - 3);
      B.smugglers.forEach((P, i) => {
        P.crate.visible = false;
        const s = clamp01(u * 1.7 - i * 0.22);
        const off = clamp01((s - 0.5) / 0.3);
        const z = lerp(-2, JEND - 0.2, Math.min(1, s / 0.5)) - 1.2 * off;
        at(P, JX + (i % 2 ? 0.3 : -0.3), z, 0, -1, -0.3 - 2.6 * off * off + (off >= 1 ? 0 : 0));
        if (off >= 1) { P.root.position.y = WATER - 0.9 + 0.1 * Math.sin(t * 3 + i); P.r.g.rotation.set(-2.8, 0, 0); P.l.g.rotation.set(-2.8, 0, 0); P.root.position.z = JEND - 1.6 - i * 0.6; P.root.position.x = JX + (i - 1.5) * 0.9; }
        else if (s > 0) { stride(P, t * 12 + i, 0.85); P.r.g.rotation.set(-2.4 * off, 0, 0); }
      });
      const first = clamp01(u * 1.7) >= 0.8 ? (u - 0.8 / 1.7) * T : -1;
      splashAt(B.S, B.seed, JX, JEND - 1.6, first);
      B.guards.forEach((P, i) => { at(P, JX + (i % 2 ? 0.5 : -0.5), -1.5 - i * 0.9, 0, -1); P.r.g.rotation.set(u > 0.6 ? -2.6 : -1.4, 0, 0); if (u < 0.6) stride(P, t * 10 + i, 0.6); });
    },
  },
  net: {
    banner: 'Fished out!', focus: [JX, 0, JEND], phase: 0.72, fog: 0.02,
    cam: (u) => [[JX - 4.5 + u, 1.5, JEND + 4.5], [JX + 0.5, -0.4, JEND - 0.5]],
    labels: (B) => [...B.tags.slice(0, 2), ...(B.netTags || [])],
    setup(B) {
      B.nets = (B.story.nets || []).slice(0, 2).map((c) => { const P = person(B.M, JOBS.fisherman?.color || '#4a6a7a'); P.c = c; B.group.add(P.root); return P; });
      B.netTags = B.nets.filter((P) => P.c?.name).map((P) => ({ P, ...castTag(P.c), pos: new THREE.Vector3() }));
    },
    play(B, t, u) {
      // the fishermen haul the net up onto the jetty, the smugglers in it, dripping
      const haul = ease(span(u, 0.1, 0.75));
      B.smugglers.forEach((P, i) => {
        P.crate.visible = false;
        at(P, JX - 0.85 + i * 0.57, JEND - 1.2 + haul * 1.6 + (i % 2) * 0.3, 0, 1, lerp(WATER - 0.9, 0.05, haul));
        P.body.rotation.x = 0.3; P.r.g.rotation.set(-1.0, 0, 0.6);
      });
      B.guards.forEach((P, i) => { at(P, JX + (i % 2 ? 0.6 : -0.6), JEND + 2.5 + i * 0.7, 0, -1); P.r.g.rotation.set(-0.4, 0, 0); P.body.rotation.x = -0.1 * Math.abs(Math.sin(t * 8 + i)); }); // laughing
      B.nets.forEach((P, i) => { pose0(P); at(P, JX + (i ? 0.9 : -0.9), JEND + 0.6, 0, -1); P.body.rotation.x = -0.25; P.r.g.rotation.set(-1.4 - 0.4 * Math.sin(t * 4), 0, 0); P.l.g.rotation.set(-1.4 - 0.4 * Math.sin(t * 4), 0, 0); });
    },
  },
  crates: {
    banner: null, focus: [-3, 1, 3], phase: 0.5, fog: 0.012,
    bannerAt: () => 'Seized!',
    cam: (u) => [[2.2 - 0.6 * u, 2.2, 8.4 - 0.6 * u], [-3.2, 1.0, 3.6]],
    labels: (B) => [...B.tags, ...(B.crowdTags || [])],
    setup(B) {
      const args0 = B;
      {
        B.goods = [];
        const cheese = new THREE.MeshStandardMaterial({ color: '#e8c04a' }), wine = new THREE.MeshStandardMaterial({ color: '#6b1f2a' });
        const kind = /cheese/.test(args0.story.cargo) ? 'cheese' : /wine/.test(args0.story.cargo) ? 'wine' : /silk/.test(args0.story.cargo) ? 'silk' : 'pepper';
        for (let i = 0; i < 4; i++) {
          const c = new THREE.Mesh(boxGeo(0.9, 0.7, 0.9), args0.M.woodDark);
          c.position.set(-5 + i * 1.3, 0.35, 3.5);
          B.group.add(c);
          const lid = new THREE.Mesh(boxGeo(0.95, 0.08, 0.95), args0.M.wood);
          lid.position.set(-5 + i * 1.3 + 0.2, 0.05, 4.4);
          B.group.add(lid);
          const g = kind === 'cheese' ? new THREE.Mesh(cylGeo(0.35, 0.35, 0.22, 14), cheese) : kind === 'wine' ? new THREE.Mesh(cylGeo(0.06, 0.08, 0.4, 8), wine)
            : new THREE.Mesh(boxGeo(0.6, 0.15, 0.6), new THREE.MeshStandardMaterial({ color: kind === 'silk' ? '#c23b6b' : '#6a4a2a' }));
          g.position.set(-5 + i * 1.3, 0.8, 3.5);
          B.group.add(g);
          B.goods.push(g);
        }
        B.crowd = (args0.story.crowd || []).slice(0, 6).map((c, i) => { const P = person(args0.M, JOBS[c.job]?.color || '#7a6a55'); P.c = c; B.group.add(P.root); return P; });
        B.crowdTags = B.crowd.slice(0, 3).map((P) => ({ P, ...castTag(P.c), pos: new THREE.Vector3() }));
      }
    },
    play(B, t, u) {
      // the crates opened on the quay, the smugglers marched off between two guards, the town come to look
      B.goods.forEach((g, i) => { g.position.y = 0.8 + 0.1 * Math.sin(t * 2 + i); g.rotation.y = t * 0.3; });
      B.smugglers.forEach((P, i) => { P.crate.visible = false; at(P, 3 - 6 * u + i * 0.9, 5.5, -1, 0); stride(P, t * 5 + i, 0.3); P.body.rotation.x = 0.35; P.r.g.rotation.set(0.3, 0, 0); });
      B.guards.forEach((P, i) => { at(P, 3.5 - 6 * u + i * 1.6, i % 2 ? 6.3 : 4.8, -1, 0); stride(P, t * 5 + i, 0.3); P.r.g.rotation.set(-0.2, 0, 0); });
      B.crowd.forEach((P, i) => { pose0(P); at(P, -7 + i * 1.5, 1.4 + (i % 2) * 0.5, 0.2, 1); P.r.g.rotation.set(-2.4 + 0.3 * Math.sin(t * 9 + i), 0, -0.2); });
    },
  },
};

const DAYS = { watch: WATCH, chase: CHASE };

/** The scene of one shot of the smugglers' two nights (args.story.step, args.story.shot). */
export function buildSmugglers(args) {
  const def = DAYS[args.story.step]?.[args.story.shot];
  if (!def) return null;
  return shot(args, def);
}
