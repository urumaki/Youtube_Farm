// Owner 2026-11-25 (docs/superpowers/specs/2026-11-25-narration-rotation-design.md): from 2026-11-26 the routine lines of
// the narration take turns, and the words freed go to what is on screen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildScript } from '../src/audio/narration.js';
import { migrate } from '../src/sim/state.js';

const saved = (date) => JSON.parse(fs.readFileSync(new URL(`../state/history/${date}.json`, import.meta.url)));

test('old days read the same (owner 2026-11-25: the change starts 2026-11-26)', () => {
  const before = JSON.parse(fs.readFileSync(new URL('./fixtures/narration-before.json', import.meta.url)));
  for (const [date, text] of Object.entries(before)) {
    const { state, diff } = saved(date);
    assert.equal(buildScript(migrate(state), diff, { shots: [] }).text, text, date);
  }
});

test('routine lines take turns by day', async () => {
  const { routineRoles, turn, NARRATION_FROM } = await import('../src/audio/rotation.js');
  assert.equal(NARRATION_FROM, '2026-11-26');
  const roles = (d) => [...routineRoles(d)].sort();
  const next = { remaining: 90 };
  assert.deepEqual(roles({ day: 40, next }), ['newcomers', 'open']);
  assert.deepEqual(roles({ day: 41, next }), ['comment', 'newcomers']);
  assert.deepEqual(roles({ day: 42, next }), ['comment', 'goal']);
  assert.deepEqual(roles({ day: 43, next }), ['goal', 'open']);
  assert.deepEqual(roles({ day: 42, next: null }), ['comment', 'open']); // no goal left: the next two
  assert.deepEqual(roles({ day: 40, next: { remaining: 20 } }), ['goal', 'newcomers', 'open']); // about to be reached: news
  assert.equal(turn(['a', 'b', 'c'], 7), 'b');
  for (let d = 0; d < 6; d++) assert.notEqual(turn(['a', 'b', 'c'], d), turn(['a', 'b', 'c'], d + 1));
});

test('the new lines cover every job and story, and fit their shots', async () => {
  const { MORE, CARAVAN_QUIET, WISH, WORK, PAYOFF } = await import('../src/audio/lines.js');
  const { STORY_CUES, BASE_POOLS, spokenLength } = await import('../src/audio/narration.js');
  const { JOBS } = await import('../src/sim/tiers.js');
  for (const j of Object.keys(JOBS)) assert.ok(WORK[j]?.length >= 2, `WORK.${j}`);
  for (const c of STORY_CUES) assert.ok(PAYOFF[c]?.length >= 1, `PAYOFF.${c}`);
  const all = [];
  for (const [k, lines] of Object.entries(WORK)) for (const l of lines) { all.push(l); assert.ok(spokenLength(l) <= 2.2, `WORK.${k}: ${l} (${spokenLength(l).toFixed(2)})`); }
  for (const [k, lines] of Object.entries(PAYOFF)) for (const l of lines) { all.push(l); assert.ok(spokenLength(l) <= 3.2, `PAYOFF.${k}: ${l}`); }
  for (const l of CARAVAN_QUIET) { all.push(l); assert.ok(spokenLength(l) <= 4.0, l); }
  for (const w of WISH) { all.push(w('blacksmith')); assert.ok(spokenLength(w('blacksmith')) <= 2.4, w('blacksmith')); }
  const size = (k) => BASE_POOLS[k].length + MORE[k].length;
  assert.ok(size('cta') >= 6 && size('comment') >= 6 && size('goal') >= 4 && size('open') >= 4 && size('tavern') >= 4, 'pool sizes');
  for (const k of ['chapel', 'cathedral']) assert.ok(BASE_POOLS.church[k].length + MORE.church[k].length >= 4, k);
  for (const k of Object.keys(BASE_POOLS.weather)) assert.ok(1 + MORE.weather[k].length >= 4, k);
  assert.ok(CARAVAN_QUIET.length >= 8 && WISH.length >= 3);
  all.push(...MORE.comment, ...MORE.cta, ...MORE.tavern, ...MORE.open.map((f) => f({ day: 42 })), ...MORE.goal.map((f) => f(90, 'the Dungeon opens')));
  for (const l of all) assert.doesNotMatch(l, /wizard|witch|spell|magic|\$\{|undefined/i, l);
});

// a saved day moved after the change (same villagers, same story), with the shot plan of its video
const moved = (date, newDate, day, edit = () => {}) => {
  const { state, diff } = saved(date);
  Object.assign(diff, { date: newDate, day });
  edit(diff);
  return { state: migrate(state), diff };
};
const CUES21 = [{ kind: 'event', id: 'pig', t0: 0, t1: 4.5 }, { kind: 'caravan', id: 'caravan', t0: 4.5, t1: 9 },
  { kind: 'villager', job: 'guard', t0: 9, t1: 13 }, { kind: 'villager', job: 'merchant', job2: 'stonemason', t0: 13, t1: 17 },
  { kind: 'ambient', id: 'wheat', t0: 17, t1: 20 }, { kind: 'tavern', id: 'tavern', t0: 20, t1: 23.5 }];
const dec = (i) => `2026-12-${String(i + 1).padStart(2, '0')}`;

test('from 2026-11-26 at most 2 routine lines a day, the call to action always, no wording two days running', async () => {
  const { CARAVAN_QUIET } = await import('../src/audio/lines.js');
  let prev = null;
  for (let i = 0; i < 28; i++) {
    const { state, diff } = moved('2026-11-21', dec(i), 46 + i);
    const s = buildScript(state, diff, { shots: CUES21 });
    const routine = s.sentences.filter((x) => ['open', 'comment', 'goal'].includes(x.role)
      || (x.role === 'delta' && !/left|packed/.test(x.text)) || (x.role === 'caravan' && !CARAVAN_QUIET.includes(x.text)));
    assert.ok(routine.length <= 2 + (diff.next.remaining <= 20 ? 1 : 0), `${diff.date}: ${s.text}`);
    assert.ok(s.sentences.some((x) => x.role === 'cta'), `${diff.date} cta: ${s.text}`);
    const said = new Set(s.sentences.filter((x) => ['open', 'comment', 'cta', 'caravan', 'goal'].includes(x.role)).map((x) => x.text));
    if (prev) for (const t of said) assert.ok(!prev.has(t), `${diff.date} repeats "${t}"`);
    prev = said;
    assert.doesNotMatch(s.text, /job requests/);
  }
});

test('the granted request is said over its villager, and only then', async () => {
  const { sentenceAnchors } = await import('../src/audio/narration.js');
  let { state, diff } = moved('2026-11-21', '2026-12-03', 48);
  let s = buildScript(state, diff, { shots: CUES21 });
  const i = s.sentences.findIndex((x) => x.role === 'requests');
  assert.ok(i >= 0, s.text);
  assert.equal(s.sentences[i].job, 'merchant');
  assert.equal(sentenceAnchors(s.sentences, CUES21)[i], 13.25);
  ({ state, diff } = moved('2026-11-21', '2026-12-03', 48, (d) => { d.requests = d.requests.filter((q) => q.id !== 936); }));
  s = buildScript(state, diff, { shots: CUES21 });
  assert.ok(!s.sentences.some((x) => x.role === 'requests'), s.text);
});

test('work lines over the villager shots, the story paid off at the end, the goal when there is no payoff', async () => {
  const { WORK, PAYOFF } = await import('../src/audio/lines.js');
  const { sentenceAnchors } = await import('../src/audio/narration.js');
  // day 48: open and newcomers, no goal (90 to go)
  let { state, diff } = moved('2026-11-21', '2026-12-03', 48);
  let s = buildScript(state, diff, { shots: CUES21 });
  const work = s.sentences.filter((x) => x.role === 'work');
  assert.ok(work.some((x) => x.job === 'guard' && [...WORK['guard:wallnight'], ...WORK.guard].includes(x.text)), s.text);
  const p = s.sentences.findIndex((x) => x.role === 'payoff');
  assert.ok(p >= 0 && PAYOFF.pig.includes(s.sentences[p].text), s.text);
  assert.equal(sentenceAnchors(s.sentences, CUES21)[p], 23.7);
  assert.ok(!s.sentences.some((x) => x.role === 'goal'), s.text);
  // the merchant has no variant (null): the job's own lines, never a crash
  assert.ok(work.some((x) => x.job === 'merchant' && WORK.merchant.includes(x.text)) || s.sentences.some((x) => x.job === 'merchant'), s.text);
  // a story with no payoff: the goal instead
  ({ state, diff } = moved('2026-11-21', '2026-12-03', 48, (d) => { d.story = { id: 'nosuch' }; }));
  s = buildScript(state, diff, { shots: CUES21 });
  assert.ok(s.sentences.some((x) => x.role === 'goal') && !s.sentences.some((x) => x.role === 'payoff'), s.text);
  // a job with no work lines: none, and no crash
  ({ state, diff } = moved('2026-11-21', '2026-12-03', 48, (d) => { d.featured[0].job = 'nosuchjob'; }));
  assert.ok(buildScript(state, diff, { shots: CUES21 }).sentences.length > 3);
});

test('a caravan day without the count still talks over the caravan; villagers leaving are always said', async () => {
  const { CARAVAN_QUIET } = await import('../src/audio/lines.js');
  // day 42: comment and goal
  const { state, diff } = moved('2026-11-21', '2026-12-03', 42);
  const s = buildScript(state, diff, { shots: CUES21 });
  assert.ok(s.sentences.some((x) => x.role === 'caravan' && CARAVAN_QUIET.includes(x.text)), s.text);
  for (let day = 46; day < 50; day++) {
    const r = moved('2026-11-21', dec(day - 46), day, (d) => { d.delta = -12; d.named = []; });
    const t = buildScript(r.state, r.diff, { shots: CUES21.filter((c) => c.kind !== 'caravan') });
    assert.ok(t.sentences.some((x) => x.role === 'delta' && /12/.test(x.text)), `${day}: ${t.text}`);
  }
});

test('no long silences after the change', async () => {
  const { sentenceAnchors, spokenLength, startsEarly } = await import('../src/audio/narration.js');
  const { schedule } = await import('../src/audio/tts/index.js');
  const plans = {
    '2026-11-13': [{ kind: 'event', id: 'bigfish', t0: 0, t1: 4.5 }, { kind: 'caravan', id: 'caravan', t0: 4.5, t1: 9 },
      { kind: 'villager', job: 'fletcher', job2: 'guard', t0: 9, t1: 12.63 }, { kind: 'villager', job: 'baker', job2: 'taxcollector', t0: 12.63, t1: 16.25 },
      { kind: 'ambient', id: 'pasture', t0: 16.25, t1: 19 }, { kind: 'church', id: 'cathedral', t0: 19, t1: 23.5 }],
    '2026-11-06': [{ kind: 'caravan', id: 'caravan', t0: 0, t1: 4.5 }, { kind: 'building', id: 'university', t0: 4.5, t1: 7.8 },
      { kind: 'villager', job: 'peasant', job2: 'merchant', t0: 7.8, t1: 13 }, { kind: 'villager', job: 'fletcher', job2: 'guard', t0: 13, t1: 18.3 },
      { kind: 'villager', job: 'farmer', job2: 'miner', t0: 18.3, t1: 23.5 }],
    '2026-11-21': CUES21,
  };
  for (const [date, cues] of Object.entries(plans)) for (let day = 46; day < 50; day++) {
    const { state, diff } = moved(date, dec(day - 46), day);
    const s = buildScript(state, diff, { shots: cues });
    const len = s.sentences.map((x) => spokenLength(x.text));
    const starts = schedule(len, sentenceAnchors(s.sentences, cues), 29.5);
    let end = 0, worst = 0;
    starts.forEach((t, i) => { worst = Math.max(worst, t - end); end = Math.max(end, t + len[i]); });
    worst = Math.max(worst, 29.1 - end);
    assert.ok(worst < 2.6, `${date} as day ${day}: ${worst.toFixed(1)} s of silence: ${s.text}`);
    assert.ok(!startsEarly(s.sentences, cues), `${date} as day ${day}: ${s.text}`);
    assert.ok(s.words <= 85, `${s.words} words`);
  }
});
