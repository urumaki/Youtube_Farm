// The guards' tournament in the market square (owner 2026-10-25): a knockout over three days, eight named guards on the
// first day (four bouts), the four winners on the second (two bouts), the last two on the third. The bouts stand in a
// line across the square inside a rope ring, the crowd round it; every fighter has a name tag. Late in the shot the loser
// of each bout lowers the sword and bows (nobody gets hurt), the winner raises the sword; the champion of the final is
// the new Captain of the Guard. The results come from the simulation (src/sim/stories.js, `rounds`).
import * as THREE from 'three';
import { rand01 } from '../../../sim/prng.js';
import { fighter, attackArm, PERIOD, HIT } from '../drills.js';
import { boxGeo, cylGeo } from '../kit.js';
import { person, stage, castTag, ease, clamp01, stride } from './common.js';

const CROWD = ['#8a6d4f', '#5f7a8a', '#9b5a3c', '#6f7d4a', '#7a5b7d', '#a0522d', '#56606e', '#c2a15a'];
const GUARD_BLUE = '#2f4f8f', GUARD_RED = '#8f2f2f';
const WIN = 0.68; // the share of the shot when the bouts are decided
const lerp = THREE.MathUtils.lerp;

export function buildTourney({ story, M, buildings, seed }) {
  const st = stage(buildings);
  if (!st) return null;
  const { group } = st;
  group.visible = false;
  const step = story.step || 'round1';
  const round = step === 'final' ? 2 : step === 'semis' ? 1 : 0;
  const bouts = story.rounds?.[round] || [];
  if (!bouts.length) return null;
  // the bouts two abreast (the first round in two rows, so the narrow frame holds them all big enough); one ring round them
  const Z0 = st.square ? 3 : 2, COL = 1.9, ROW = 3.4;
  const spots = bouts.length === 1 ? [[0, 0]] : bouts.map((_, k) => [k % 2 ? COL : -COL, -Math.floor(k / 2) * ROW]);
  const rows = Math.ceil(bouts.length / 2), Z = Z0 - ((rows - 1) * ROW) / 2;
  const ringW = (bouts.length === 1 ? 1 : 2) * 3.8 + 0.8, ringD = rows * ROW + 0.9;
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; group.add(m); return m; };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(cylGeo(0.06, 0.07, 1.1, 6), M.woodDark, sx * ringW / 2, 0.55, Z + sz * ringD / 2);
  for (const sz of [-1, 1]) add(boxGeo(ringW, 0.04, 0.04), M.clothRed, 0, 0.95, Z + sz * ringD / 2);
  for (const sx of [-1, 1]) add(boxGeo(0.04, 0.04, ringD), M.clothRed, sx * ringW / 2, 0.95, Z);
  // pennants on the corner posts
  for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.16, 0.5, 3).rotateZ(-Math.PI / 2), sx < 0 ? M.clothBlue : M.clothRed, sx * ringW / 2 + 0.25, 1.05, Z - ringD / 2);
  const pairs = bouts.map((b, k) => {
    const pair = new THREE.Group();
    pair.position.set(spots[k][0], 0, Z0 + spots[k][1]);
    group.add(pair);
    const A = fighter(M, GUARD_BLUE), B = fighter(M, GUARD_RED);
    pair.add(A.root, B.root);
    return { pair, A, B, a: b.a, b: b.b, aWins: b.winner === b.a.id, ph: rand01(seed, 'tourney', k) * PERIOD };
  });
  // the crowd behind the ring, cheering
  const n = 10;
  const crowd = Array.from({ length: n }, (_, i) => {
    const P = person(M, CROWD[i % CROWD.length]);
    P.root.position.set(-ringW / 2 + 0.3 + ((ringW - 0.6) * (i + rand01(seed, 'tc', i) * 0.6)) / n, 0, Z - ringD / 2 - 1.0 - (i % 2) * 0.8);
    group.add(P.root);
    return P;
  });
  const final = round === 2;
  const sub = (c) => castTag(c).sub;
  const winSub = final ? 'Captain of the Guard!' : 'Goes through!';
  const labels = [];
  for (const p of pairs) {
    for (const [c, P, wins] of [[p.a, p.A, p.aWins], [p.b, p.B, !p.aWins]]) labels.push({ ...castTag(c), P, wins, sub0: sub(c), pos: new THREE.Vector3() });
  }
  const tmp = new THREE.Vector3();
  const focus = st.toWorld(0, 1.2, Z);
  const span = ringW;
  return {
    group,
    labels,
    banner: final ? 'Tournament: the final!'
      : round === 1 ? 'Tournament: semi-finals'
        : 'The guards’ tournament',
    focus,
    cam(u) {
      // in front of the ring, far enough back for every bout, drifting along it
      const back = ringD / 2 + 1.6 + span * 0.95;
      return { pos: st.toWorld(-0.7 + 1.4 * u, 2.3 + rows * 0.5, Z + back), look: st.toWorld(0, 1.5, Z - 0.3) };
    },
    update(t, t0, t1) {
      const on = t >= t0 - 0.2 && t <= t1 + 0.2;
      group.visible = on;
      if (!on) return;
      const v = clamp01((t - t0) / (t1 - t0)), done = v > WIN, after = ease(clamp01((v - WIN) / 0.1));
      for (const p of pairs) {
        const c = (t - t0 + p.ph) / PERIOD, k = Math.floor(c), u = c - k;
        const attacker = k % 2 === 0 ? p.A : p.B;
        [p.A, p.B].forEach((P, i) => {
          const side = i === 0 ? -1 : 1;
          P.root.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
          const wins = i === 0 ? p.aWins : !p.aWins;
          if (done) {
            // decided: the winner raises the sword, the loser lowers it and bows (nobody is hurt)
            P.root.position.set(side * 1.0, wins ? 0.08 * Math.abs(Math.sin(t * 7)) * after : 0, 0);
            stride(P, 0, 0, { arms: false });
            if (wins) { P.r.g.rotation.set(lerp(-1.1, -3.0, after), 0, -0.1); P.l.g.rotation.set(-0.6, 0, 0.3); P.body.rotation.x = 0; }
            else { P.r.g.rotation.set(lerp(-1.1, -0.15, after), 0, 0); P.l.g.rotation.set(-0.3, 0, 0.2); P.body.rotation.x = 0.45 * after; }
            return;
          }
          const attacking = P === attacker;
          const lunge = attacking ? 0.34 * Math.sin(Math.PI * clamp01((u - 0.3) / 0.55)) : -0.14 * Math.sin(Math.PI * clamp01((u - 0.35) / 0.5));
          P.root.position.set(side * (0.98 - lunge), 0, 0);
          stride(P, (t - t0) * 5.5 + i * 1.3, 0.16, { arms: false });
          if (attacking) {
            P.r.g.rotation.set(attackArm(u), 0, -0.12);
            P.l.g.rotation.set(-1.15, 0, 0.35);
            P.body.rotation.x = 0.16 * Math.sin(Math.PI * clamp01((u - 0.35) / 0.45));
          } else {
            const q = ease(clamp01(1 - Math.abs(u - HIT) / 0.38));
            P.r.g.rotation.set(lerp(-1.1, -2.3, q), 0, lerp(0, 0.55, q));
            P.l.g.rotation.set(lerp(-1.15, -1.75, q), 0, lerp(0.35, 0.15, q));
            P.body.rotation.x = -0.1 * q;
          }
        });
      }
      crowd.forEach((P, i) => {
        const ph = t * 8 + i;
        P.r.g.rotation.set(done ? -2.7 + 0.3 * Math.sin(ph) : -0.4 - 0.3 * Math.abs(Math.sin(ph * 0.5)), 0, -0.1);
        P.l.g.rotation.set(done && i % 2 ? -2.5 : -0.25, 0, 0.1);
        P.root.position.y = done ? 0.07 * Math.abs(Math.sin(ph)) : 0;
      });
      group.updateMatrixWorld(true);
      for (const l of labels) {
        l.pos.copy(l.P.root.getWorldPosition(tmp)).setY(tmp.y + 2.45);
        l.sub = done && l.wins ? winSub : l.sub0;
      }
    },
  };
}
