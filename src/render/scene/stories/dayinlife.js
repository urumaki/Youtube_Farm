// A day in the life (owner 2026-11-01, src/sim/stories.js `dayinlife`): one named villager's day takes the whole video
// (timeline.js, DAY_SHOTS), keeping the counter and the day line at the start. So far the scholar: the camera looks at the
// sun, tilts down over the lane to the University and drops into the scholar's head (the name tag over it); the scholar
// walks along the lane reading an open book, goes in through the great doors of the gatehouse, down a vaulted corridor
// past other scholars talking, takes notes in a lecture (room.js), and reads by candlelight at night in a room of the
// gatehouse behind a closed arched window. Then the camera flies out through the window toward the moon, the moon turns
// into the sun, and the last frame is the first one again: the video loops.
// The University's lot frame (buildings.js `university`): the gatehouse on the lane at x 20.5..29.5, its doors in the face
// at x 29.5 (z -2.1..2.1, 6 m tall), the lane running along +x at z 0. The corridor and the lecture room are sets far above
// the lot, seen only during their shots; the candle room stands inside the gatehouse, its window in the gatehouse's face.
import * as THREE from 'three';
import { rig, toolGeo, nod } from '../work.js';
import { person, stride, flameMaterial, flicker, ease, clamp01 } from './common.js';
import { Builder, boxGeo, cylGeo, archGeo, lancetGeo } from '../kit.js';
import { buildLectureRoom } from '../room.js';
import { JOBS } from '../../../sim/tiers.js';
import { rand01 } from '../../../sim/prng.js';

export const DAY_SHOTS = {
  scholar: [['dive', 0, 4.5], ['walk', 4.5, 9], ['gate', 9, 12.5], ['corridor', 12.5, 17], ['lecture', 17, 21.5], ['candle', 21.5, 26], ['loop', 26, 30]],
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
// the candle shot ends where the flight out of the window begins
const Q0 = { pos: V(26.35, 9.45, 0.4), look: V(29.0, 10.45, 0.15) };

/** The University's lot frame for a shot: a group in it, local to world, the lane's ground (local y) and the first camera place. */
function frame(buildings, yFn) {
  const it = buildings.items.university;
  if (!it) return null;
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.matrix.copy(it.group.matrix);
  group.visible = false;
  const inv = it.group.matrix.clone().invert();
  const toWorld = (x, y, z) => V(x, y, z).applyMatrix4(group.matrix);
  const toLocal = (p) => p.clone().applyMatrix4(inv);
  const base = toWorld(0, 0, 0).y;
  const ground = (x, z) => { const p = toWorld(x, 0, z); return yFn(p.x, p.z) - base; };
  const start = toWorld(CROSS.x, CROSS.y, CROSS.z).addScaledVector(SUN, OUT);
  return { group, toWorld, toLocal, ground, start };
}

/** An open book held in both hands in front of the chest (body space). */
function openBook(M, P) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const page = new THREE.Mesh(boxGeo(0.2, 0.02, 0.28).translate(s * 0.1, 0, 0), M.clothIvory);
    page.rotation.z = -s * 0.18;
    g.add(page);
    const cover = new THREE.Mesh(boxGeo(0.21, 0.012, 0.29).translate(s * 0.105, -0.016, 0), M.clothRed);
    cover.rotation.z = -s * 0.18;
    g.add(cover);
  }
  g.position.set(0, 0.47, 0.5);
  g.rotation.x = -0.55;
  P.body.add(g);
  return g;
}

/** The arms holding the open book, the head bent over it. */
function reading(P, t) {
  P.r.g.rotation.set(-1.05, 0, 0.32);
  P.l.g.rotation.set(-1.05, 0, -0.32);
  nod(P, 0.42 + 0.04 * Math.sin(t * 1.3));
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

let moonTex = null, glowTex = null;
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

/** The sun, a tilt down to the lane below, a drop into the scholar's head (the name tag over it). */
function dive(args, F) {
  const { M, story } = args;
  const { group, toLocal, ground } = F;
  const P = person(M, COLOR);
  group.add(P.root);
  openBook(M, P);
  // the inside of the head: black, so the drop ends in the dark before the cut
  const inside = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshBasicMaterial({ color: '#000', side: THREE.BackSide }));
  inside.position.y = 1.04;
  P.body.add(inside);
  const s0 = toLocal(F.start);
  const at = (s) => V(s0.x + 1.8 - 1.3 * s, 0, 0.3);
  const head = new THREE.Vector3(), labelPos = new THREE.Vector3();
  const DOWN = V(-0.2, -1, 0).normalize(); // nearly straight down, the lane ahead of the scholar at the top of the frame
  const headAt = (s) => { const p = at(s); p.y = ground(p.x, p.z) + 1.66; return p.applyMatrix4(group.matrix); };
  const T = 4.5, TILT = 1.6;
  const d0 = F.start.distanceTo(headAt(TILT));
  const IN = TILT + (T - TILT) * (1 - (0.13 / d0) ** (1 / 2.2)); // the camera is inside the head (cam: d < 0.13)
  const body = [...P.root.children, ...P.body.children].filter((m) => m !== P.body && m !== inside);
  return {
    group,
    low: true,
    focus: headAt(2),
    label: { title: story.hero.name, sub: JOBS.scholar.label },
    labelPos,
    labelFrom: 0.44, // once the counter has gone (overlay.js)
    cam(u) {
      const s = u * T;
      head.copy(headAt(s));
      if (s < TILT) {
        // from the sun down to the lane, without moving
        const k = ease(s / TILT), dir = SUN.clone().lerp(DOWN, k).normalize();
        labelPos.copy(head).add(V(0, 0.8, 0));
        return { pos: F.start.clone(), look: F.start.clone().addScaledVector(dir, 30) };
      }
      // then down onto the head and into it, faster and faster
      const k = (s - TILT) / (T - TILT), d = d0 * (1 - k) ** 2.2;
      const pos = F.start.clone().lerp(head.clone().addScaledVector(DOWN, -d), ease(Math.min(1, k * 3)));
      // the tag over the head, then ahead of the camera as it goes in, so it stays on screen
      const near = clamp01((3 - d) / 2.5);
      labelPos.copy(head).add(V(0, 0.8, 0)).lerp(pos.clone().addScaledVector(DOWN, 2.4).add(V(-0.35, 0, 0)), near);
      return { pos, look: pos.clone().addScaledVector(DOWN, Math.max(2, d)), near: d < 6 ? 0.05 : undefined };
    },
    update(t, t0, t1) {
      group.visible = within(t, t0, t1);
      if (!group.visible) return;
      const s = t - t0, p = at(s);
      P.root.position.set(p.x, ground(p.x, p.z), p.z);
      P.root.rotation.y = -Math.PI / 2;
      stride(P, s * 5.2, 0.32, { arms: false });
      reading(P, t);
      for (const m of body) m.visible = s < IN; // the neck and the shoulders would show inside the dark
    },
  };
}

/** Along the lane, reading as he walks; the camera goes round from the front to behind him, the gatehouse ahead. */
function walk(args, F) {
  const { M } = args;
  const { group, toWorld, ground } = F;
  const P = person(M, COLOR);
  group.add(P.root);
  openBook(M, P);
  const T = 4.5;
  const at = (s) => V(52 - 1.45 * s, 0, 0.3);
  return {
    group,
    low: true,
    focus: toWorld(48, ground(48, 0) + 1.2, 0.3),
    cam(u) {
      const p = at(u * T), y = ground(p.x, p.z), e = ease(u);
      // the narrow frame keeps him in view: the camera looks at him, and only behind him at the gatehouse ahead
      const a = lerp(0.49, 3.0, e), r = lerp(2.95, 2.8, e);
      const pos = toWorld(p.x - Math.cos(a) * r, y + lerp(1.55, 1.85, e), p.z + Math.sin(a) * r);
      const look = toWorld(p.x - 5 * e * e, y + lerp(1.3, 1.6, e), p.z - 0.3 * e);
      return { pos, look, near: 0.2 };
    },
    update(t, t0, t1) {
      group.visible = within(t, t0, t1);
      if (!group.visible) return;
      const s = t - t0, p = at(s);
      P.root.position.set(p.x, ground(p.x, p.z), p.z);
      P.root.rotation.y = -Math.PI / 2;
      stride(P, s * 5.4, 0.34, { arms: false });
      reading(P, t);
    },
  };
}

/** The gatehouse's great doors swing open; he walks in, the book shut in his hand. */
function gate(args, F) {
  const { M } = args;
  const { group, toWorld, ground } = F;
  const P = person(M, COLOR);
  group.add(P.root);
  P.r.hand.add(toolGeo('book', M));
  const b = new Builder();
  // the dark passage behind the doors, the cloister lit at its far end
  const mats = { ...M, dark: new THREE.MeshBasicMaterial({ color: '#120c08' }), far: new THREE.MeshBasicMaterial({ color: '#8c6f45' }) };
  b.add('dark', boxGeo(0.02, 5.85, 4.2), 29.77, 2.92, 0);
  b.add('far', boxGeo(0.02, 2.0, 1.0), 29.775, 1.0, 0);
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
  const T = 3.5;
  const at = (s) => V(Math.max(30.25, 36 - 1.65 * s), 0, 0.2);
  const floor = (x, z) => Math.max(ground(x, z), x < 34 ? 0.12 : -Infinity); // the lot's paving in front of the doors
  return {
    group,
    low: true,
    focus: toWorld(31, 2, 0),
    cam(u) {
      const e = ease(u), y = Math.max(ground(38, 0), 0.12);
      return { pos: toWorld(lerp(40.5, 34.6, e), y + lerp(1.25, 1.55, e), lerp(1.7, 0.85, e)), look: toWorld(lerp(31, 29.8, e), y + lerp(3.2, 2.7, e), 0), near: 0.2 };
    },
    update(t, t0, t1) {
      group.visible = within(t, t0, t1);
      if (!group.visible) return;
      const s = t - t0, p = at(s);
      const open = ease(clamp01((s - 0.15) / 1.7)) * 1.45;
      for (const { hinge, side } of leaves) hinge.rotation.y = side * -open;
      P.root.position.set(p.x, floor(p.x, p.z), p.z);
      P.root.rotation.y = -Math.PI / 2;
      const going = p.x > 30.25 ? 1 : 0;
      stride(P, s * 5.6, 0.38 * going);
      nod(P, 0.05);
    },
  };
}

/** A vaulted corridor of the University, scholars talking in twos and threes; he walks down it toward the camera. */
function corridor(args, F) {
  const { M, seed } = args;
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
  b.add('daylight', lancetGeo(1.6, 3.2, 0.04), L - 0.01, 0.9, 0, Math.PI / 2); // the window at the far end
  set.add(b.build(mats));
  const lamps = [];
  for (let x = 4.5; x < L; x += 6) {
    const l = new THREE.PointLight('#ffcf95', 5, 9, 1.5);
    l.position.set(x, 3.1, HW - 0.4);
    set.add(l);
    lamps.push(l);
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), M.flame);
    s.position.set(x, 2.75, HW - 0.12);
    set.add(s);
  }
  for (let x = 3; x < L; x += 6) { const l = new THREE.PointLight('#dfe8f2', 7, 10, 1.4); l.position.set(x, 2.4, -HW + 0.6); set.add(l); lamps.push(l); }
  // the scholars talking: in twos and threes against the walls, turned to each other, hands moving
  const talkers = [];
  [[13.5, -1, 3], [9.5, 1, 2], [6, -1, 2], [3, 1, 3], [17.5, 1, 2], [21, -1, 3]].forEach(([x, side, n], g) => {
    for (let i = 0; i < n; i++) {
      const color = rand01(seed, 'talkc', g, i) < 0.25 ? JOBS.librarian?.color || COLOR : COLOR;
      const P = rig(M, color);
      const a = (i / n) * Math.PI * 2 + g;
      const cx = x, cz = side * 1.2;
      P.root.position.set(cx + Math.cos(a) * 0.5, 0, cz + Math.sin(a) * 0.3);
      P.root.rotation.y = Math.atan2(cx - P.root.position.x, cz - P.root.position.z);
      if (rand01(seed, 'talkb', g, i) < 0.4) P.l.hand.add(toolGeo('book', M));
      set.add(P.root);
      talkers.push({ P, k: g * 3 + i });
    }
  });
  const P = person(M, COLOR);
  set.add(P.root);
  P.l.hand.add(toolGeo('book', M));
  const T = 4.5;
  const at = (s) => 15 - 1.5 * s;
  const w = (x, y, z) => toWorld(O.x + x, O.y + y, O.z + z);
  return {
    group,
    interior: true,
    focus: w(10, 1.5, 0),
    cam(u) {
      const s = u * T, x = at(s), e = ease(u);
      return { pos: w(x - lerp(3.9, 3.0, e), lerp(1.45, 1.7, e), lerp(0.3, 0.1, e) + 0.05 * Math.sin(s * 1.7)), look: w(x + 0.4, 1.35, 0), fov: 60, near: 0.1 };
    },
    update(t, t0, t1) {
      group.visible = within(t, t0, t1);
      for (const l of lamps) l.visible = group.visible;
      if (!group.visible) return;
      const s = t - t0;
      P.root.position.set(at(s), 0, 0.05);
      P.root.rotation.y = -Math.PI / 2;
      stride(P, s * 5.4, 0.34);
      P.l.g.rotation.x = -0.25; // the book held a little forward
      nod(P, 0.05 + 0.08 * Math.sin(s * 0.9));
      P.head.rotation.y = 0.35 * Math.sin(s * 1.1); // a look at the scholars he passes
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

/** The lecture (room.js): he sits in the front row; over his shoulder to the master at the slate, then round to him writing. */
function lecture(args, F) {
  const { M, seed, story } = args;
  const { group, toWorld } = F;
  const anchor = toWorld(0, 150, 60);
  const lr = buildLectureRoom({ variant: 'lecture', anchor, away: 0, M, seed, id: story.hero.id + 7, heightAt: () => anchor.y, rig, color: COLOR });
  const w = (x, y, z) => lr.room.localToWorld(V(x, y, z));
  const room = new THREE.Group().add(lr.room); // placed in world space by room.js, not in the lot's frame
  return {
    group: room,
    interior: true,
    focus: lr.focus,
    cam(u) {
      // the front-row student in the middle is the scholar (room.js: seated at (-0.1, 2.42), facing the slate)
      const e = ease(u);
      const pos = w(lerp(0.6, 0.95, e), lerp(1.8, 1.45, e), lerp(3.3, 0.85, e));
      const look = w(lerp(-0.45, -0.1, e), lerp(1.85, 1.15, e), lerp(0, 2.4, e));
      return { pos, look, fov: 62, near: 0.05 };
    },
    update(t, t0, t1) {
      lr.update(t, within(t, t0, t1));
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
  b.add('woodDark', cylGeo(0.2, 0.22, 0.45, 10), 27.68, FLOOR + 0.225, 0);
  b.add('clothIvory', boxGeo(0.3, 0.02, 0.42).rotateZ(0.12), 28.45, top + 0.02, -0.02);
  b.add('clothRed', boxGeo(0.31, 0.012, 0.43).rotateZ(0.12), 28.45, top + 0.005, -0.02);
  for (let i = 0; i < 4; i++) b.add(['clothRed', 'clothBlue', 'woodDark', 'clothIvory'][i], boxGeo(0.26 - i * 0.02, 0.07, 0.34), 28.7, top + 0.035 + i * 0.07, 0.62, 0.2 * i);
  b.add('iron', cylGeo(0.035, 0.04, 0.06, 8), 28.62, top + 0.03, 0.33);
  b.add('clothIvory', boxGeo(0.01, 0.22, 0.03).rotateZ(-0.5), 28.58, top + 0.13, 0.33);
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
  // the scholar at the desk facing the window, writing; now and then he looks up at the moon
  const P = rig(M, COLOR, { seated: true });
  P.root.position.set(27.72, FLOOR, 0);
  P.root.rotation.y = Math.PI / 2;
  group.add(P.root);
  const flame = candle(group, M, V(28.78, top, -0.45), 4.5); // on the far side of him from the camera
  return {
    win,
    update(t) {
      flame(t);
      const up = Math.max(0, Math.sin(t * 0.55 - 1.2)) ** 3;
      P.r.g.rotation.set(-1.0 + 0.05 * Math.sin(t * 6) * (1 - up), 0, 0.12 + 0.04 * Math.sin(t * 3.1));
      P.l.g.rotation.set(-0.95, 0, -0.1);
      nod(P, lerp(0.45, -0.25, up));
    },
  };
}

/** Night in the gatehouse: he reads and writes by the candle, the moon through the closed window. */
function candleShot(args, F) {
  const { M, seed } = args;
  const { group, toWorld } = F;
  const room = candleRoom(group, M, seed);
  const sky = new THREE.Group();
  const night = nightSky(sky, toWorld(27, 10, 0));
  return {
    group: new THREE.Group().add(group, sky),
    interior: true,
    phase: 1,
    focus: toWorld(28, 9.5, 0),
    cam(u) {
      const e = ease(u);
      return { pos: toWorld(lerp(25.85, Q0.pos.x, e), lerp(9.25, Q0.pos.y, e), lerp(0.8, Q0.pos.z, e)), look: toWorld(lerp(28.9, Q0.look.x, e), lerp(10.2, Q0.look.y, e), lerp(0.1, Q0.look.z, e)), fov: 60, near: 0.05 };
    },
    update(t, t0, t1) {
      const on = within(t, t0, t1);
      group.visible = sky.visible = on;
      if (!on) return;
      room.update(t);
      night(1, 0);
    },
  };
}

/** Out through the window toward the moon; the moon turns into the sun and the camera ends where the video began. */
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
  return {
    group: new THREE.Group().add(group, sky),
    focus: toWorld(28, 9.5, 0),
    phaseAt: (u) => 1 - ease((u * T - 1.6) / 1.0), // day again before the night sky fades (the sun moves with the light)
    interiorAt: (u) => 1 - ease((u * T - 1.35) / 0.55),
    cam(u) {
      const s = u * T;
      if (s < IN) {
        // from behind the scholar over his head to the window, turning from the desk to the moon in the panes
        const k = ease(s / IN);
        const pos = toWorld(Q0.pos.x, Q0.pos.y, Q0.pos.z).lerp(q1, k);
        const look = toWorld(Q0.look.x, Q0.look.y, Q0.look.z).lerp(q1.clone().addScaledVector(SUN, 12), k);
        return { pos, look, fov: lerp(60, 52, k), near: 0.05 };
      }
      const pos = cross.clone().addScaledVector(SUN, outAt(s));
      return { pos, look: pos.clone().addScaledVector(SUN, 30), near: s < IN + 0.6 ? 0.05 : undefined };
    },
    update(t, t0, t1) {
      const on = within(t, t0, t1);
      group.visible = sky.visible = on;
      if (!on) return;
      const s = t - t0;
      room.update(t);
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
