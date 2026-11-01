// A day in the life (owner 2026-11-01, src/sim/stories.js `dayinlife`): one named villager's day takes the whole video
// (timeline.js, DAY_SHOTS), keeping the counter and the day line at the start. So far the scholar: the camera looks at the
// sun, tilts down over the lane to the University and drops in behind the scholar's head and into his eyes (the name tag
// over it); from then on we see through his eyes (owner's first look): reading the open book in his hands along the lane,
// the great doors of the gatehouse opening before him, a vaulted corridor past the kingdom's other named scholars talking,
// his own page and quill in a lecture (room.js), his page by candlelight at night and the moon in a closed arched window.
// Then the camera leaves his eyes and flies out of the window toward the moon, the moon turns into the sun, and the last
// frame is the first one again: the video loops.
// The University's lot frame (buildings.js `university`): the gatehouse on the lane at x 20.5..29.5, its doors in the face
// at x 29.5 (z -2.1..2.1, 6 m tall), the lane running along +x at z 0. The corridor and the lecture room are sets far above
// the lot, seen only during their shots; the candle room stands inside the gatehouse, its window in the gatehouse's face.
import * as THREE from 'three';
import { rig, toolGeo, nod } from '../work.js';
import { person, stride, flameMaterial, flicker, ease, clamp01 } from './common.js';
import { Builder, boxGeo, cylGeo, archGeo, lancetGeo } from '../kit.js';
import { buildLectureRoom, quill } from '../room.js';
import { povCamera } from '../pov.js';
import { JOBS } from '../../../sim/tiers.js';
import { rand01 } from '../../../sim/prng.js';

export const DAY_SHOTS = {
  scholar: [['dive', 0, 4.5], ['walk', 4.5, 8.3], ['gate', 8.3, 12.5], ['corridor', 12.5, 17], ['lecture', 17, 21.5], ['candle', 21.5, 26], ['loop', 26, 30]],
};
const COLOR = JOBS.scholar.color;
const lerp = THREE.MathUtils.lerp;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// where the sun stands at the start of the video (env.js, phase 0): the first and the last frame look straight at it
const EL = THREE.MathUtils.degToRad(33), AZ = 0.95 + 0.6;
const SUN = V(Math.cos(EL) * Math.sin(AZ), Math.sin(EL), Math.cos(EL) * Math.cos(AZ)).normalize();
// the candle room inside the gatehouse (lot frame): the floor, the window in the gatehouse's face, where the camera goes out
const ROOM = { X0: 25.6, X1: 29.05, Z0: -1.8, Z1: 1.8, FLOOR: 8.4, CEIL: 12.0, SILL: 9.1, SPRING: 11.05, HW: 0.65 };
const CROSS = V(29.25, 10.225, 0.165); // between the lead bars
const OUT = 45; // metres from the window to the first (and last) camera place, toward the sun

/** The University's lot frame for a shot: a group in it, local to world, the lane's ground (local y) and the first camera place. */
function frame(buildings, yFn) {
  const it = buildings.items.university;
  if (!it) return null;
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(it.group.matrix);
  group.matrixWorld.copy(group.matrix); // the eyes are read (pov.js) before the first render works it out
  group.visible = false;
  const inv = it.group.matrix.clone().invert();
  const toWorld = (x, y, z) => V(x, y, z).applyMatrix4(group.matrix);
  const toLocal = (p) => p.clone().applyMatrix4(inv);
  const base = toWorld(0, 0, 0).y;
  const ground = (x, z) => { const p = toWorld(x, 0, z); return yFn(p.x, p.z) - base; };
  const start = toWorld(CROSS.x, CROSS.y, CROSS.z).addScaledVector(SUN, OUT);
  return { group, toWorld, toLocal, ground, start };
}

/** An open book (body space), placed between his hands each frame (reading). */
function openBook(M, P) {
  const g = new THREE.Group();
  for (const sd of [-1, 1]) {
    const page = new THREE.Mesh(boxGeo(0.2, 0.02, 0.28).translate(sd * 0.1, 0, 0), M.clothIvory);
    page.rotation.z = -sd * 0.18;
    const cover = new THREE.Mesh(boxGeo(0.21, 0.012, 0.29).translate(sd * 0.105, -0.016, 0), M.clothRed);
    cover.rotation.z = -sd * 0.18;
    g.add(page, cover);
  }
  P.body.add(g);
  return g;
}

/** The arms holding the open book (owner 2026-11-01: in the hands, not floating), tipped up a little as he looks ahead. */
const hand = new THREE.Vector3(), hand2 = new THREE.Vector3();
function reading(P, book, t, lookUp = 0) {
  P.r.g.rotation.set(-1.05 + 0.15 * lookUp, 0, -0.24);
  P.l.g.rotation.set(-1.05 + 0.15 * lookUp, 0, 0.24);
  nod(P, lerp(0.42, 0.05, lookUp) + 0.04 * Math.sin(t * 1.3));
  P.root.updateMatrixWorld(true);
  P.body.worldToLocal(P.r.hand.getWorldPosition(hand));
  P.body.worldToLocal(P.l.hand.getWorldPosition(hand2));
  book.position.copy(hand).add(hand2).multiplyScalar(0.5).add(V(0, 0.035, 0.03));
  book.rotation.x = -0.55 + 0.3 * lookUp;
}

/** The flame-lit stub of a candle in its holder at p (local), with a warm light. Returns update(t). */
function candle(group, M, p, power = 7) {
  const holder = new THREE.Mesh(cylGeo(0.07, 0.08, 0.03, 10), M.gold);
  holder.position.copy(p);
  const wax = new THREE.Mesh(cylGeo(0.03, 0.033, 0.16, 10).translate(0, 0.095, 0), M.clothIvory);
  wax.position.copy(p);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.07, 8).translate(0, 0.035, 0), flameMaterial('#ffc768'));
  flame.position.copy(p).add(V(0, 0.18, 0));
  const light = new THREE.PointLight('#ffb35c', power, 7, 1.6);
  light.position.copy(p).add(V(0, 0.32, 0));
  group.add(holder, wax, flame, light);
  return (t) => { flicker(flame, t, 1); light.intensity = power * (1 + 0.1 * Math.sin(t * 13) + 0.06 * Math.sin(t * 31)); };
}

/** The night outside (world space round `c`): a dark sky, stars and the moon where the sun will be. Returns update(night, sun). */
function nightSky(group, c) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(12000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false, uniforms: { k: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float k; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(vec3(0.11,0.15,0.3), vec3(0.015,0.025,0.08), pow(h, 0.5)); gl_FragColor = vec4(c, k); }`,
  }));
  dome.position.copy(c);
  dome.renderOrder = -2; // first: by distance it would sort last (its centre is by the camera) and cover the moon
  const N = 420, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = rand01(7, 'star', i) * Math.PI * 2, y = 0.08 + 0.92 * rand01(7, 'stary', i), r = Math.sqrt(1 - y * y);
    pos.set([c.x + Math.cos(a) * r * 11000, c.y + y * 11000, c.z + Math.sin(a) * r * 11000], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }));
  // the moon: a pale disc with darker seas; it warms and grows into the sun
  const moonMat = new THREE.MeshBasicMaterial({ map: moonTexture(), transparent: true, depthWrite: false, fog: false });
  const moon = new THREE.Mesh(new THREE.CircleGeometry(260, 48), moonMat);
  moon.position.copy(c).addScaledVector(SUN, 10000);
  moon.lookAt(c);
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: '#bcd0ff', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Sprite(glowMat);
  glow.position.copy(c).addScaledVector(SUN, 9990);
  stars.renderOrder = moon.renderOrder = glow.renderOrder = -1;
  group.add(dome, stars, moon, glow);
  const moonCol = new THREE.Color('#f2f4ff'), sunCol = new THREE.Color('#fff2c4');
  const glowMoon = new THREE.Color('#9fb8ff'), glowSun = new THREE.Color('#ffc46a');
  return (night, sun) => {
    dome.material.uniforms.k.value = night;
    stars.material.opacity = night;
    moonMat.color.copy(moonCol).lerp(sunCol, sun);
    moonMat.opacity = night;
    moon.scale.setScalar(1 + 0.35 * sun);
    glowMat.color.copy(glowMoon).lerp(glowSun, sun);
    glowMat.opacity = 0.5 + 0.5 * sun * night;
    glow.scale.setScalar(1500 + 2600 * sun);
  };
}

let moonTex = null, glowTex = null, passTex = null;
/** A vaulted passage seen head on: dark walls closing in, a bright arch at the end with the lawn in the sun. */
function passageTexture() {
  if (passTex || typeof document === 'undefined') return passTex;
  const cv = document.createElement('canvas');
  cv.width = 768; cv.height = 1068;
  const g = cv.getContext('2d');
  g.scale(3, 3); // drawn at 256 x 356, sharp up close
  g.fillStyle = '#100b07';
  g.fillRect(0, 0, 256, 356);
  // the walls and the vault, lighter toward the end
  for (let i = 0; i < 9; i++) {
    const k = i / 9, w = 256 * (1 - k * 0.75), h = 356 * (1 - k * 0.72), x = (256 - w) / 2, y = 356 - h - k * 30;
    g.fillStyle = `rgb(${18 + 60 * k * k},${13 + 45 * k * k},${9 + 30 * k * k})`;
    g.beginPath(); g.moveTo(x, 356); g.lineTo(x, y + w / 2); g.arc(128, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, 356); g.fill();
  }
  // the opening at the end: sky, lawn, the light on the floor
  g.fillStyle = '#e9e2c8';
  g.beginPath(); g.moveTo(104, 300); g.lineTo(104, 228); g.arc(128, 228, 24, Math.PI, 0); g.lineTo(152, 300); g.fill();
  g.fillStyle = '#6f8f4a';
  g.fillRect(104, 280, 48, 20);
  const gr = g.createLinearGradient(0, 300, 0, 356);
  gr.addColorStop(0, 'rgba(233,220,180,0.55)'); gr.addColorStop(1, 'rgba(233,220,180,0)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(104, 300); g.lineTo(152, 300); g.lineTo(200, 356); g.lineTo(56, 356); g.fill();
  passTex = new THREE.CanvasTexture(cv);
  passTex.colorSpace = THREE.SRGBColorSpace;
  return passTex;
}
function moonTexture() {
  if (moonTex || typeof document === 'undefined') return moonTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#f4f2ea';
  g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(150,150,165,0.45)';
  for (const [x, y, r] of [[92, 98, 34], [150, 84, 22], [160, 150, 40], [100, 168, 18], [128, 120, 12], [76, 140, 14]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  moonTex = new THREE.CanvasTexture(cv);
  moonTex.colorSpace = THREE.SRGBColorSpace;
  return moonTex;
}
function glowTexture() {
  if (glowTex || typeof document === 'undefined') return glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(cv);
  return glowTex;
}

/** The shot's window: shown from t0 to t1 only (the sets of two shots may stand in the same place). */
const within = (t, t0, t1) => t >= t0 && t < t1;

// ---------------------------------------------------------------- shots
// Owner 2026-11-01 (first look): the camera stays in the scholar's eyes from the drop into his head to the flight out of
// the window (pov.js: the eye, the head hidden while the camera is in it).
const FOV = 70;
const BOB = (t) => 0.03 * Math.abs(Math.cos(t * 5.2)); // the eyes rise and fall a little with the stride

/** The scholar's eyes on a rig (pov.js): eye(out) and hide(on). */
const eyesOf = (P) => povCamera(P, () => {});

/** Along the lane (dive and walk, one path in video seconds): the hero's place, the eyes, the way he faces. */
function lane(F) {
  const { toWorld, ground, toLocal, group } = F;
  const s0 = toLocal(F.start);
  const x = (t) => s0.x + 1.8 - 1.3 * t;
  const fwd = V(-1, 0, 0).transformDirection(group.matrix);
  const eye = (t, bob = 1) => toWorld(x(t) - 0.08, ground(x(t), 0.3) + 1.69 + BOB(t) * bob, 0.3);
  // reading: the eyes on the book in his hands; `up` 0..1 lifts them to the lane ahead
  const gaze = (up) => fwd.clone().add(V(0, -lerp(0.62, 0.06, up), 0)).normalize();
  return { x, fwd, eye, gaze };
}

/** The scholar walking the lane, reading the open book in his hands. */
function laneWalker(M, F, L, group) {
  const P = person(M, COLOR);
  group.add(P.root);
  const book = openBook(M, P);
  const eyes = eyesOf(P);
  return {
    eyes,
    update(t, lookUp = 0) {
      const x = L.x(t);
      P.root.position.set(x, F.ground(x, 0.3), 0.3);
      P.root.rotation.y = -Math.PI / 2;
      stride(P, t * 5.2, 0.32, { arms: false });
      reading(P, book, t, lookUp);
    },
  };
}

/** The sun, a tilt down to the lane below, a long smooth drop in behind the scholar's head and into his eyes. */
function dive(args, F) {
  const { M, story } = args;
  const { group } = F;
  const L = lane(F);
  const W = laneWalker(M, F, L, group);
  const T = 4.5, TILT = 1.4;
  const up = V(0, 1, 0), DOWN = V(-0.2, -1, 0).normalize(); // nearly straight down, his way ahead at the top of the frame
  const A = F.start.clone().sub(L.eye(TILT, 0)); // from his eyes to the first camera place
  const B = L.fwd.clone().multiplyScalar(-1.5).addScaledVector(up, 1.3); // behind and over his head
  const labelPos = new THREE.Vector3();
  // the drop: a curve from the first place through the point behind his head into his eyes, slow at both ends
  const drop = (s) => {
    const k0 = clamp01((s - TILT) / (T - TILT)), k = k0 * k0 * k0 * (k0 * (k0 * 6 - 15) + 10);
    const off = A.clone().multiplyScalar((1 - k) ** 2).addScaledVector(B, 2 * k * (1 - k));
    return { k, off };
  };
  return {
    group,
    low: true,
    focus: L.eye(2),
    label: { title: story.hero.name, sub: JOBS.scholar.label },
    labelPos,
    labelFrom: 0.42, // once the counter has gone (overlay.js)
    cam(u) {
      const s = u * T, eye = L.eye(s, 0);
      if (s < TILT) {
        const dir = SUN.clone().lerp(DOWN, ease(s / TILT)).normalize();
        labelPos.copy(eye).addScaledVector(up, 0.8);
        return { pos: F.start.clone(), look: F.start.clone().addScaledVector(dir, 30) };
      }
      const { k, off } = drop(s);
      const bob = L.eye(s).sub(eye).multiplyScalar(k * k);
      const pos = eye.clone().add(off).add(bob);
      // the eyes go from straight down to his own look at the book, as the camera comes in behind him
      const look = F.start.clone().addScaledVector(DOWN, 30).lerp(eye.clone().addScaledVector(L.gaze(0), 1.2), THREE.MathUtils.smoothstep(k, 0, 0.6));
      const d = off.length();
      // the name over his head, then ahead in the view as the camera goes in
      const near = clamp01((2.5 - d) / 2);
      labelPos.copy(eye).addScaledVector(up, 0.8).lerp(pos.clone().addScaledVector(L.gaze(0.6), 3).addScaledVector(up, 0.9), near);
      return { pos, look, fov: lerp(52, FOV, THREE.MathUtils.smoothstep(k, 0.7, 1)), near: d < 4 ? 0.05 : undefined };
    },
    update(t, t0, t1) {
      group.visible = within(t, t0, t1);
      if (!group.visible) return;
      W.update(t);
      W.eyes.hide(drop(t - t0).off.length() < 0.45);
    },
  };
}

/** Along the lane through his eyes: the book in his hands, then a look up the lane to the University ahead. */
function walk(args, F) {
  const { M } = args;
  const { group } = F;
  const L = lane(F);
  const W = laneWalker(M, F, L, group);
  const T = 3.8;
  const lift = (u) => THREE.MathUtils.smoothstep(u, 0.4, 0.75);
  return {
    group,
    low: true,
    focus: L.eye(6.5),
    cam(u) {
      const t = 4.5 + u * T, pos = L.eye(t);
      const dir = L.gaze(lift(u)).add(V(0, 0, 0.06 * Math.sin(t * 1.3))).normalize();
      return { pos, look: pos.clone().addScaledVector(dir, 4), fov: FOV, near: 0.05 };
    },
    update(t, t0, t1) {
      group.visible = within(t, t0, t1);
      if (!group.visible) return;
      W.update(t, lift((t - t0) / T));
      W.eyes.hide(true);
    },
  };
}

/** Up to the gatehouse: its great doors swing open before him and he walks into the dark of the passage. */
function gate(args, F) {
  const { M } = args;
  const { group, toWorld, ground } = F;
  const P = person(M, COLOR);
  group.add(P.root);
  P.r.hand.add(toolGeo('book', M));
  const eyes = eyesOf(P);
  const b = new Builder();
  // the passage behind the doors (painted over the gatehouse's own door): dark vaulted walls, the cloister's light at the end
  const mats = { ...M, dark: new THREE.MeshBasicMaterial({ map: passageTexture() }) };
  b.add('dark', new THREE.PlaneGeometry(4.2, 5.85).rotateY(Math.PI / 2), 29.77, 2.92, 0);
  group.add(b.build(mats, { castShadow: false }));
  const leaves = [1, -1].map((side) => {
    const hinge = new THREE.Group();
    hinge.position.set(29.84, 0, side * 2.1);
    const lb = new Builder();
    lb.add('woodDark', boxGeo(0.12, 5.85, 2.08), 0, 2.925, -side * 1.04);
    for (const y of [0.9, 2.9, 4.9]) lb.add('iron', boxGeo(0.03, 0.12, 1.9), 0.075, y, -side * 1.04);
    lb.add('iron', new THREE.TorusGeometry(0.11, 0.022, 6, 16).rotateY(Math.PI / 2), 0.09, 2.6, -side * 1.85);
    hinge.add(lb.build(M));
    group.add(hinge);
    return { hinge, side };
  });
  // up the lane to the doors, a pause while they swing open, then in
  const T = 4.2;
  // up the lane, a pause while the doors swing open, then on into the doorway
  const x = (s) => (s < 1.2 ? 37 - 2 * s : s < 1.8 ? 34.6 : 34.6 - 1.375 * (s - 1.8));
  const going = (s) => (s < 1.2 ? 1 : s < 1.8 ? 0 : 1);
  const floor = (px, z) => Math.max(ground(px, z), px < 34 ? 0.12 : -Infinity); // the lot's paving in front of the doors
  return {
    group,
    low: true,
    focus: toWorld(31, 2, 0),
    cam(u) {
      const s = u * T, px = x(s), e = ease(u);
      const pos = toWorld(px - 0.08, floor(px, 0.2) + 1.69 + BOB(s) * going(s), 0.2);
      // up at the doors as they open, then straight ahead into the passage
      return { pos, look: toWorld(29.6, floor(px, 0.2) + lerp(3.6, 1.7, e), 0.2), fov: FOV, near: 0.05 };
    },
    update(t, t0, t1) {
      group.visible = within(t, t0, t1);
      if (!group.visible) return;
      const s = t - t0, px = x(s);
      const open = ease(clamp01((s - 0.2) / 1.5)) * 1.45;
      for (const { hinge, side } of leaves) hinge.rotation.y = side * -open;
      P.root.position.set(px, floor(px, 0.2), 0.2);
      P.root.rotation.y = -Math.PI / 2;
      stride(P, s * 5.6, 0.38 * going(s));
      eyes.hide(true);
    },
  };
}

/** A vaulted corridor of the University through his eyes: the named scholars talking in twos and threes as he passes. */
function corridor(args, F) {
  const { M, seed, story } = args;
  const { group, toWorld } = F;
  const O = V(0, 150, 0); // the set, far above the lot
  const set = new THREE.Group();
  set.position.copy(O);
  group.add(set);
  const L = 26, HW = 1.9, H = 4.7;
  const mats = { ...M, daylight: new THREE.MeshBasicMaterial({ color: '#e4edf4' }) };
  const b = new Builder();
  b.add('stoneDark', boxGeo(L, 0.1, 2 * HW, 2), L / 2, -0.05, 0);
  for (const z of [-HW - 0.15, HW + 0.15]) b.add('stone', boxGeo(L, H, 0.3), L / 2, H / 2, z);
  for (const x of [-0.15, L + 0.15]) b.add('stone', boxGeo(0.3, H, 2 * HW + 0.6), x, H / 2, 0);
  b.add('plaster', boxGeo(L, 0.2, 2 * HW + 0.6), L / 2, H + 0.1, 0);
  for (let x = 1.5; x < L; x += 3) {
    b.add('stone', archGeo(2 * HW, 2.1, 0.35), x, 2.6, 0); // the rib of the vault, springing from pilasters
    for (const z of [-HW + 0.15, HW - 0.15]) b.add('stone', boxGeo(0.4, 2.6, 0.3), x, 1.3, z);
  }
  for (let x = 3; x < L; x += 3) {
    b.add('daylight', lancetGeo(0.9, 2.3, 0.04), x, 1.35, -HW + 0.01); // tall pointed windows down one side
    if ((x / 3) % 2) b.add('woodDark', boxGeo(1.1, 2.2, 0.08), x, 1.1, HW - 0.03); // doors down the other
    else b.add('woodDark', boxGeo(1.6, 0.45, 0.4), x, 0.22, HW - 0.25); // a bench
  }
  b.add('daylight', lancetGeo(1.6, 3.2, 0.04), 0.01, 0.9, 0, Math.PI / 2); // the window at the far end, ahead of him
  set.add(b.build(mats));
  const lamps = [];
  for (let x = 1.5; x < L; x += 6) {
    const l = new THREE.PointLight('#ffcf95', 5, 9, 1.5);
    l.position.set(x, 3.1, HW - 0.4);
    set.add(l);
    lamps.push(l);
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), M.flame);
    s.position.set(x, 2.75, HW - 0.12);
    set.add(s);
  }
  for (let x = 3; x < L; x += 6) { const l = new THREE.PointLight('#dfe8f2', 7, 10, 1.4); l.position.set(x, 2.4, -HW + 0.6); set.add(l); lamps.push(l); }
  const w = (x, y, z) => toWorld(O.x + x, O.y + y, O.z + z);
  // the scholars talking ahead of him, against the walls on both sides; the kingdom's other named scholars wear their
  // names, nearest first (story.others, src/sim/stories.js)
  const names = [...(story.others || [])];
  const talkers = [], labels = [];
  [[13, -1, 2], [11.2, 1, 3], [9.2, -1, 2], [7.4, 1, 2], [5.4, -1, 3], [3.4, 1, 2]].forEach(([x, side, n], g) => {
    for (let i = 0; i < n; i++) {
      const P = rig(M, COLOR);
      const a = (i / n) * Math.PI * 2 + g;
      const cz = side * 1.2;
      P.root.position.set(x + Math.cos(a) * 0.5, 0, cz + Math.sin(a) * 0.3);
      P.root.rotation.y = Math.atan2(x - P.root.position.x, cz - P.root.position.z);
      if (rand01(seed, 'talkb', g, i) < 0.4) P.l.hand.add(toolGeo('book', M));
      set.add(P.root);
      talkers.push({ P, k: g * 3 + i });
      const who = names.shift();
      if (who) labels.push({ pos: w(P.root.position.x, 2.15, P.root.position.z), title: who.name, sub: JOBS.scholar.label });
    }
  });
  const P = person(M, COLOR);
  set.add(P.root);
  P.l.hand.add(toolGeo('book', M));
  const eyes = eyesOf(P);
  const T = 4.5;
  const at = (s) => 15 - 1.5 * s;
  return {
    group,
    labels,
    interior: true,
    focus: w(10, 1.5, 0),
    cam(u) {
      const s = u * T, x = at(s);
      const pos = w(x - 0.08, 1.69 + BOB(s), 0.05);
      // a look at one side, then the other, at the scholars he passes
      const yaw = 0.42 * Math.sin(s * 1.25 + 0.3);
      return { pos, look: pos.clone().add(V(-Math.cos(yaw), -0.06, Math.sin(yaw))), fov: FOV, near: 0.05 };
    },
    update(t, t0, t1) {
      group.visible = within(t, t0, t1);
      for (const l of lamps) l.visible = group.visible;
      if (!group.visible) return;
      const s = t - t0;
      P.root.position.set(at(s), 0, 0.05);
      P.root.rotation.y = -Math.PI / 2;
      stride(P, s * 5.2, 0.34);
      P.l.g.rotation.x = -0.25; // the book held a little forward
      eyes.hide(true);
      for (const { P: Q, k } of talkers) {
        const talk = Math.max(0, Math.sin(t * 1.6 + k * 1.9));
        Q.r.g.rotation.set(-0.35 - 0.75 * talk + 0.15 * Math.sin(t * 7 + k), 0, 0.15 * talk);
        Q.l.g.rotation.set(-0.15 - 0.2 * Math.max(0, Math.sin(t * 1.3 + k)), 0, 0);
        nod(Q, 0.08 * Math.sin(t * 2.1 + k));
        Q.head.rotation.y = 0.3 * Math.sin(t * 0.9 + k * 2.3);
      }
    },
  };
}

/** The lecture (room.js) from his seat in the front row: the master at the slate, then down at his own page as he writes. */
function lecture(args, F) {
  const { M, seed, story } = args;
  const { toWorld } = F;
  const anchor = toWorld(0, 150, 60);
  let id = story.hero.id + 7;
  if (id % 5 === 0) id++; // the student who raises a hand now and then (room.js: 1 + id % 5) is never him
  const lr = buildLectureRoom({ variant: 'lecture', anchor, away: 0, M, seed, id, heightAt: () => anchor.y, rig, color: COLOR });
  const w = (x, y, z) => lr.room.localToWorld(V(x, y, z));
  const me = lr.students.find((s) => s.i === 1).P; // the middle seat of the front row
  const eyes = eyesOf(me);
  return {
    group: new THREE.Group().add(lr.room), // placed in world space by room.js, not in the lot's frame
    interior: true,
    focus: lr.focus,
    cam(u) {
      const pos = eyes.eye(new THREE.Vector3());
      const down = THREE.MathUtils.smoothstep(u, 0.38, 0.55) * (1 - 0.6 * THREE.MathUtils.smoothstep(u, 0.86, 0.93));
      const look = w(0, 1.62, 0.3).lerp(w(-0.05, 0.86, 1.55), down); // past the hand, so the quill and the page are in view
      return { pos, look, fov: FOV, near: 0.05 };
    },
    update(t, t0, t1) {
      const on = within(t, t0, t1);
      lr.update(t, on);
      eyes.hide(on);
    },
  };
}

/** The scholar's room in the gatehouse (lot frame): night, the candle, the closed arched window and the moon in it. */
function candleRoom(group, M, seed) {
  const { X0, X1, Z0, Z1, FLOOR, CEIL, SILL, SPRING, HW } = ROOM;
  const b = new Builder();
  const W = X1 - X0, D = Z1 - Z0, cx = (X0 + X1) / 2;
  b.add('wood', boxGeo(W, 0.08, D, 2), cx, FLOOR - 0.04, 0);
  b.add('plaster', boxGeo(W, 0.12, D), cx, CEIL + 0.06, 0);
  for (let x = X0 + 0.5; x < X1; x += 0.9) b.add('woodDark', boxGeo(0.18, 0.2, D), x, CEIL - 0.1, 0);
  for (const z of [Z0 - 0.2, Z1 + 0.2]) b.add('plaster', boxGeo(W + 0.8, CEIL - FLOOR, 0.4), cx, (FLOOR + CEIL) / 2, z);
  b.add('plaster', boxGeo(0.4, CEIL - FLOOR, D), X0 - 0.2, (FLOOR + CEIL) / 2, 0);
  // the window wall (its outer face just inside the gatehouse's), the opening with a round arch
  const wx = X1 + 0.2;
  b.add('plaster', boxGeo(0.4, SILL - FLOOR, D), wx, (FLOOR + SILL) / 2, 0);
  for (const s of [-1, 1]) b.add('plaster', boxGeo(0.4, CEIL - FLOOR, Z1 - HW), wx, (FLOOR + CEIL) / 2, s * (HW + Z1) / 2);
  b.add('plaster', archGeo(2 * HW, CEIL - SPRING, 0.4), wx, SPRING, 0);
  b.add('stone', boxGeo(0.5, 0.08, 2 * HW + 0.2), X1 + 0.05, SILL - 0.04, 0); // the stone sill
  // the desk under the window, a stool, the open book, a pile of books, the ink and the quill
  const top = FLOOR + 0.78;
  b.add('woodDark', boxGeo(0.75, 0.06, 1.8), 28.62, top - 0.03, 0);
  for (const [x, z] of [[28.3, -0.85], [28.3, 0.85], [28.95, -0.85], [28.95, 0.85]]) b.add('woodDark', boxGeo(0.06, 0.75, 0.06), x, FLOOR + 0.375, z);
  b.add('woodDark', cylGeo(0.2, 0.22, 0.45, 10), 27.8, FLOOR + 0.225, 0.15);
  b.add('clothIvory', boxGeo(0.3, 0.02, 0.42).rotateZ(0.12), 28.45, top + 0.02, 0.15);
  b.add('clothRed', boxGeo(0.31, 0.012, 0.43).rotateZ(0.12), 28.45, top + 0.005, 0.15);
  for (let i = 0; i < 4; i++) b.add(['clothRed', 'clothBlue', 'woodDark', 'clothIvory'][i], boxGeo(0.26 - i * 0.02, 0.07, 0.34), 28.75, top + 0.035 + i * 0.07, -0.66, 0.2 * i);
  b.add('iron', cylGeo(0.035, 0.042, 0.07, 8), 28.7, top + 0.035, 0.58); // the ink bottle at his right hand
  // a shelf of books on the side wall, a chest at the back
  for (const y of [9.6, 10.35]) {
    b.add('woodDark', boxGeo(1.6, 0.05, 0.28), 26.9, y, Z0 + 0.14);
    for (let i = 0; i < 11; i++) {
      const h = 0.22 + 0.1 * rand01(seed, 'bh', y, i);
      b.add(['clothRed', 'clothBlue', 'woodDark', 'clothIvory', 'wood'][i % 5], boxGeo(0.09, h, 0.22), 26.2 + i * 0.13, y + 0.025 + h / 2, Z0 + 0.15, 0, 0, i % 4 === 3 ? 0.2 : 0);
    }
  }
  b.add('woodDark', boxGeo(0.6, 0.5, 1.1), X0 + 0.35, FLOOR + 0.25, 0.8);
  b.add('iron', boxGeo(0.62, 0.05, 1.12), X0 + 0.35, FLOOR + 0.42, 0.8);
  group.add(b.build(M));
  // the closed window: an arched frame, leaded panes of pale glass, a mullion and a transom
  const win = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-HW, 0); shape.lineTo(HW, 0); shape.lineTo(HW, SPRING - SILL); shape.absarc(0, SPRING - SILL, HW, 0, Math.PI, false); shape.lineTo(-HW, 0);
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(shape, 16).rotateY(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#a8bed6', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, roughness: 0.1 }));
  glass.position.set(X1 + 0.12, SILL, 0);
  win.add(glass);
  const wb = new Builder(), gx = X1 + 0.1;
  for (const z of [-0.33, 0, 0.33]) wb.add(z ? 'iron' : 'woodDark', boxGeo(z ? 0.012 : 0.06, SPRING - SILL, z ? 0.012 : 0.06), gx, (SILL + SPRING) / 2, z);
  for (let y = SILL + 0.45; y < SPRING; y += 0.45) wb.add(Math.abs(y - (SILL + 1.35)) < 0.01 ? 'woodDark' : 'iron', boxGeo(0.012, Math.abs(y - (SILL + 1.35)) < 0.01 ? 0.06 : 0.012, 2 * HW), gx, y, 0);
  wb.add('woodDark', boxGeo(0.08, 0.08, 2 * HW + 0.1), gx, SILL + 0.04, 0);
  for (const s of [-1, 1]) wb.add('woodDark', boxGeo(0.08, SPRING - SILL, 0.07), gx, (SILL + SPRING) / 2, s * HW);
  win.add(wb.build(M, { castShadow: false }));
  group.add(win);
  // moonlight through the glass
  const moonlight = new THREE.PointLight('#8fa6e8', 2.2, 6, 1.4);
  moonlight.position.set(X1 - 0.3, SPRING, 0);
  group.add(moonlight);
  // the scholar at the desk facing the window, the quill in his hand; in line with a pane, so the moon is in his view
  const P = rig(M, COLOR, { seated: true });
  P.root.position.set(27.85, FLOOR, 0.15);
  P.root.rotation.y = Math.PI / 2;
  P.l.hand.add(quill(M)); // the rig's `l` arm is the right hand
  group.add(P.root);
  const flame = candle(group, M, V(28.8, top, -0.35), 3);
  return {
    win,
    eyes: eyesOf(P),
    page: V(28.68, top + 0.02, 0.15).applyMatrix4(group.matrix), // past the hand, so the quill and the page are in view
    /** writing 1: the quill moving along the line; 0: the hand at rest on the page. */
    update(t, writing = 1) {
      flame(t);
      P.body.rotation.x = 0.25; // bent over the desk, the quill on the page (as the students in room.js)
      P.l.g.rotation.set(-1.2 + writing * 0.03 * Math.sin(t * 11), writing * 0.14 * Math.sin(t * 1.7), 0.35 + writing * 0.02 * Math.sin(t * 13)); // in over the page
      P.r.g.rotation.set(-1.1, 0, -0.25);
    },
  };
}

/** Night in the gatehouse through his eyes: his hand writing by the candle, then a look up at the moon in the window. */
function candleShot(args, F) {
  const { M, seed } = args;
  const { group, toWorld } = F;
  const room = candleRoom(group, M, seed);
  const sky = new THREE.Group();
  const night = nightSky(sky, toWorld(27, 10, 0));
  const T = 4.5;
  return {
    group: new THREE.Group().add(group, sky),
    interior: true,
    phase: 1,
    focus: toWorld(28, 9.5, 0),
    cam(u) {
      const pos = room.eyes.eye(new THREE.Vector3());
      // on the page, then up to the moon (the same look the flight out of the window begins with)
      const look = room.page.clone().lerp(pos.clone().addScaledVector(SUN, 5), THREE.MathUtils.smoothstep(u, 0.55, 0.9));
      return { pos, look, fov: FOV, near: 0.05 };
    },
    update(t, t0, t1) {
      const on = within(t, t0, t1);
      group.visible = sky.visible = on;
      if (!on) return;
      room.update(t, 1 - THREE.MathUtils.smoothstep((t - t0) / T, 0.6, 0.8));
      room.eyes.hide(true);
      night(1, 0);
    },
  };
}

/** Out of his eyes and through the window toward the moon; the moon turns into the sun and the camera ends where the video began. */
function loopShot(args, F) {
  const { M, seed } = args;
  const { group, toWorld } = F;
  const room = candleRoom(group, M, seed);
  const sky = new THREE.Group();
  const night = nightSky(sky, toWorld(27, 10, 0));
  const T = 4, IN = 1.3;
  const cross = toWorld(CROSS.x, CROSS.y, CROSS.z);
  const q1 = cross.clone().addScaledVector(SUN, -0.8);
  const along = (s) => clamp01((s - IN) / (T - IN)); // the flight out, 0..1
  const outAt = (s) => -0.8 + (OUT + 0.8) * (along(s) ** 2 * (3 - 2 * along(s)) * 0.85 + along(s) * 0.15);
  const SKY = { night: (s) => 1 - ease((s - 2.5) / 1.0), sun: (s) => ease((s - 1.9) / 1.3) };
  const eye = new THREE.Vector3();
  const camAt = (s) => (s < IN ? room.eyes.eye(eye).clone().lerp(q1, ease(s / IN)) : cross.clone().addScaledVector(SUN, outAt(s)));
  return {
    group: new THREE.Group().add(group, sky),
    focus: toWorld(28, 9.5, 0),
    phaseAt: (u) => 1 - ease((u * T - 1.6) / 1.0), // day again before the night sky fades (the sun moves with the light)
    interiorAt: (u) => 1 - ease((u * T - 1.35) / 0.55),
    cam(u) {
      const s = u * T, pos = camAt(s);
      return { pos, look: pos.clone().addScaledVector(SUN, 30), fov: FOV - (FOV - 52) * ease((s - IN) / 1.2), near: s < IN + 0.6 ? 0.05 : undefined };
    },
    update(t, t0, t1) {
      const on = within(t, t0, t1);
      group.visible = sky.visible = on;
      if (!on) return;
      const s = t - t0;
      room.update(t, 0);
      room.eyes.hide(camAt(s).distanceTo(room.eyes.eye(eye)) < 0.45);
      room.win.visible = outAt(s) < -0.05; // the glass and its bars, until the camera reaches them
      night(clamp01(SKY.night(s)), clamp01(SKY.sun(s)));
    },
  };
}

const SHOTS = { dive, walk, gate, corridor, lecture, candle: candleShot, loop: loopShot };

/** One shot of the day (story.shot); null when the University does not stand. */
export function buildDayInLife(args) {
  const F = frame(args.buildings, args.yFn);
  const fn = SHOTS[args.story.shot];
  return F && fn ? fn(args, F) : null;
}
