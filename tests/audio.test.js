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
    for (const lang of ['en', 'it']) {
      const s = buildScript(state, diff, { lang });
      assert.ok(s.words >= 40 && s.words <= 80, `${lang} day ${diff.day}: ${s.words} words`);
      assert.equal(s.sentences.at(-1).role === 'cta' || s.sentences.some((x) => x.role === 'cta'), true);
      assert.ok(s.sentences.some((x) => x.role === 'delta'));
    }
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
