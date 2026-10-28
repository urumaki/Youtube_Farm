import test from 'node:test';
import assert from 'node:assert/strict';
import { genesis, advance } from '../src/sim/simulate.js';
import { buildScript } from '../src/audio/narration.js';
import { captionPhrases } from '../src/audio/tts/index.js';
import { makeMusic } from '../src/audio/music.js';

function days(counts) {
  let s = genesis({ seed: 5, date: '2026-01-01' });
  const out = [];
  counts.forEach((n, i) => { const r = advance(s, { subscribers: n, date: `2026-01-${String(i + 2).padStart(2, '0')}` }); s = r.state; out.push(r); });
  return out;
}

test('narration fits 30 s, mentions the change, ends with the call to action', () => {
  for (const { state, diff } of days([1, 12, 87, 87, 60, 640, 5000])) {
    const s = buildScript(state, diff);
    assert.ok(s.words >= 40 && s.words <= 75, `day ${diff.day}: ${s.words} words`);
    assert.equal(s.sentences.at(-1).role === 'cta' || s.sentences.some((x) => x.role === 'cta'), true);
    assert.ok(s.sentences.some((x) => x.role === 'delta'));
  }
});

test('narration is deterministic but varies across days', () => {
  const [a] = days([30]);
  assert.equal(buildScript(a.state, a.diff).text, buildScript(a.state, a.diff).text);
  const texts = new Set(days([30, 31, 32, 33, 34, 35]).map((r) => buildScript(r.state, r.diff).text.split('.')[0]));
  assert.ok(texts.size >= 2, 'openings vary');
});

test('captions keep word order and timing, at most 4 words, never across sentences', () => {
  const words = 'Day 2 in the kingdom. Twelve new villagers arrived today!'.split(' ').map((w, i) => ({ w, s: i * 0.4, e: i * 0.4 + 0.35 }));
  const caps = captionPhrases(words, 0.35);
  assert.deepEqual(caps.flatMap((c) => c.words.map((w) => w.w)), words.map((w) => w.w));
  for (const c of caps) {
    assert.ok(c.words.length <= 5);
    assert.ok(!c.words.slice(0, -1).some((w) => /[.!?]$/.test(w.w)), 'no sentence end inside a phrase');
    assert.ok(Math.abs(c.words[0].s - (words.find((w) => w.w === c.words[0].w).s + 0.35)) < 1e-9);
  }
});

test('music is deterministic and not clipping', () => {
  const [l1] = makeMusic(1, '2026-01-01', 4), [l2] = makeMusic(1, '2026-01-01', 4);
  assert.deepEqual(l1.slice(0, 2000), l2.slice(0, 2000));
  let peak = 0;
  for (const v of l1) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak > 0.05 && peak < 1, `peak ${peak}`);
});

test('effects follow the camera: hammering on a house shot, nothing loud elsewhere, no clipping', async () => {
  const { makeSfxTrack } = await import('../src/audio/sfx.js');
  const { readWav } = await import('../src/audio/wav.js');
  const os = await import('node:os');
  const path = await import('node:path');
  const f = path.join(os.tmpdir(), `sfx-${process.pid}.wav`);
  makeSfxTrack(f, { cues: [{ kind: 'house', id: 1, t0: 10, t1: 14 }], seed: 3, date: '2026-01-01', weather: 'clear', duration: 30 });
  const { samples, rate } = readWav(f);
  const rms = (a, b) => { let e = 0; for (let i = Math.round(a * rate); i < b * rate; i++) e += samples[i] ** 2; return Math.sqrt(e / ((b - a) * rate)); };
  assert.ok(rms(10.5, 13.5) > 3 * rms(4, 7), 'the house shot is clearly louder than the quiet bed');
  let peak = 0;
  for (const v of samples) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak < 0.99);
  assert.ok(rms(4, 7) < 0.05, 'background bed stays quiet');
});

test('narration waits for its shot: anchors from the shot plan, soft so everything still fits', async () => {
  const { sentenceAnchors } = await import('../src/audio/narration.js');
  const { schedule } = await import('../src/audio/tts/index.js');
  const roles = ['open', 'caravan', 'story', 'completed', 'person', 'tavern', 'comment', 'goal', 'cta'];
  const cues = [{ kind: 'caravan', t0: 0, t1: 4.5 }, { kind: 'event', t0: 4.5, t1: 9 }, { kind: 'building', t0: 9, t1: 11.7 },
    { kind: 'villager', t0: 11.7, t1: 14.9 }, { kind: 'tavern', t0: 18.2, t1: 23.5 }];
  const at = sentenceAnchors(roles.map((role) => ({ role })), cues);
  assert.deepEqual(at.slice(0, 6), [null, null, 4.75, 9.25, 11.95, 18.45]);
  const lengths = [1.8, 2.3, 3, 1.8, 1.6, 2, 2.2, 1.7, 2.4];
  const starts = schedule(lengths, at, 28.3);
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] >= starts[i - 1] + lengths[i - 1], 'no overlap');
  assert.ok(Math.abs(starts[2] - 4.75) < 1e-9 && Math.abs(starts[5] - 18.45) < 1e-9, 'sentences start with their shots');
  assert.ok(starts.at(-1) + lengths.at(-1) <= 28.3 + 1e-9, 'still ends in time');
});

test('sentences follow the shots they talk about, so the narrator never waits over another shot', async () => {
  const fs = await import('node:fs');
  const { migrate } = await import('../src/sim/state.js');
  const { sentenceAnchors } = await import('../src/audio/narration.js');
  // day 2026-10-22: "64 job requests" waited for the third villager and left the raised house silent
  const { state, diff } = JSON.parse(fs.readFileSync(new URL('../state/history/2026-10-22.json', import.meta.url)));
  const cues = [
    { kind: 'caravan', id: 'caravan', t0: 0, t1: 4.5 }, { kind: 'building', id: 'harbor', t0: 4.5, t1: 6.9 },
    { kind: 'building', id: 'cathedral', t0: 6.9, t1: 9.4 }, { kind: 'house', raised: true, t0: 9.4, t1: 11.8 },
    { kind: 'villager', job: 'stonemason', t0: 11.8, t1: 15.7 }, { kind: 'villager', job: 'fisherman', t0: 15.7, t1: 19.6 },
    { kind: 'villager', job: 'knight', t0: 19.6, t1: 23.5 },
  ];
  const s = buildScript(migrate(state), diff, { shots: cues });
  const at = sentenceAnchors(s.sentences, cues).filter((x) => x !== null);
  for (let i = 1; i < at.length; i++) assert.ok(at[i] >= at[i - 1], `in shot order: ${at.join(', ')}`);
  assert.ok(s.sentences.some((x) => x.role === 'raised'), 'the raised house is talked about');
  const h = s.sentences.find((x) => x.building === 'harbor'), c = s.sentences.find((x) => x.building === 'cathedral');
  assert.ok(h && c && s.sentences.indexOf(h) < s.sentences.indexOf(c), 'each building over its own shot');
});

test('each line fits its shot: short lines over the 2.3 s building shots, nothing runs on into the next shot (owner 2026-10-23)', async () => {
  const fs = await import('node:fs');
  const { migrate } = await import('../src/sim/state.js');
  const { sentenceAnchors, spokenLength } = await import('../src/audio/narration.js');
  const { schedule } = await import('../src/audio/tts/index.js');
  // day 2026-10-23: the voice ran two seconds late, "the town builds upward" over the blacksmith
  const { state, diff } = JSON.parse(fs.readFileSync(new URL('../state/history/2026-10-23.json', import.meta.url)));
  const cues = [
    { kind: 'caravan', id: 'caravan', t0: 0, t1: 4.5 }, { kind: 'building', id: 'potter_stall', t0: 4.5, t1: 6.81 },
    { kind: 'building', id: 'university', t0: 6.81, t1: 9.12 }, { kind: 'house', id: 180, raised: true, t0: 9.12, t1: 11.43 },
    { kind: 'villager', job: 'blacksmith', job2: 'baker', t0: 11.43, t1: 15.16 }, { kind: 'villager', job: 'carpenter', job2: 'farmer', t0: 15.16, t1: 18.88 },
    { kind: 'tavern', id: 'tavern', t0: 18.88, t1: 23.5 },
  ];
  const s = buildScript(migrate(state), diff, { shots: cues });
  const len = s.sentences.map((x) => spokenLength(x.text));
  const at = sentenceAnchors(s.sentences, cues);
  const starts = schedule(len, at, 29.5);
  const shotOf = (t) => cues.find((c) => t >= c.t0 && t < c.t1);
  s.sentences.forEach((x, i) => {
    if (at[i] === null || x.role === 'goal' || x.role === 'cta') return;
    const shot = shotOf(at[i]);
    assert.ok(starts[i] + len[i] <= shot.t1 + 0.6, `"${x.text}" (${starts[i].toFixed(1)}-${(starts[i] + len[i]).toFixed(1)}) runs past its shot (${shot.t1})`);
  });
  for (const id of ['potter_stall', 'university']) assert.ok(s.sentences.some((x) => x.building === id), `a line for ${id}`);
  assert.ok(s.sentences.some((x) => x.role === 'raised'), 'a line for the raised house');
});
