import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { genesis, advance, deriveVillagers, ABANDON_DAYS, SCHEMA_VERSION } from '../src/sim/simulate.js';
import { TIERS, jobFor, houseCapacity } from '../src/sim/tiers.js';
import { cleanName, isOffensive } from '../src/sim/names.js';
import { migrate, writeAtomic, saveDay, baseStateFor } from '../src/sim/state.js';
import { validate } from '../src/sim/validate.js';

const SCHEMA = JSON.parse(fs.readFileSync(new URL('../src/sim/kingdom.schema.json', import.meta.url)));
const SEED = 777;

function dateOf(i) {
  return new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
}
function run(counts, seed = SEED) {
  let s = genesis({ seed, date: dateOf(0) });
  const diffs = [];
  counts.forEach((n, i) => {
    const r = advance(s, { subscribers: n, date: dateOf(i + 1) });
    s = r.state;
    diffs.push(r.diff);
  });
  return { state: s, diffs };
}

function checkInvariants(s) {
  assert.deepEqual(validate(SCHEMA, s), []);
  assert.equal(s.villagers.length, s.subscriberCount);
  const houses = new Map(s.houses.map((h) => [h.id, h]));
  let occupants = 0;
  s.villagers.forEach((v, i) => {
    assert.equal(v.id, i, 'villager ids are contiguous');
    assert.ok(houses.get(v.house).occupants.includes(v.id), 'villager lives in its house');
  });
  for (const h of s.houses) {
    occupants += h.occupants.length;
    assert.ok(h.occupants.length <= h.capacity, `house ${h.id} over capacity`);
    assert.equal(h.status === 'occupied', h.occupants.length > 0, `house ${h.id} status matches occupancy`);
  }
  assert.equal(occupants, s.subscriberCount);
  assert.equal(new Set(s.houses.map((h) => h.plot)).size, s.houses.length, 'one house per plot');
  for (const t of TIERS) assert.equal(s.unlockedTiers.includes(t.id), s.peakPopulation >= t.at, `tier ${t.id}`);
}

test('same seed and counts give the same state; a different seed differs', () => {
  const counts = [3, 9, 40, 38, 120, 700];
  const a = run(counts), b = run(counts);
  assert.equal(JSON.stringify(a.state), JSON.stringify(b.state));
  assert.equal(JSON.stringify(a.diffs), JSON.stringify(b.diffs));
  const c = run(counts, SEED + 1);
  assert.notEqual(JSON.stringify(c.state.villagers), JSON.stringify(a.state.villagers));
});

test('subscriber index always yields the same villager regardless of history', () => {
  const direct = run([60]).state;
  const stepped = run([5, 20, 11, 35, 60]).state;
  for (let i = 0; i < 60; i++) {
    assert.equal(direct.villagers[i].name, null, 'nameless until a commenter names them');
    assert.equal(direct.villagers[i].job, stepped.villagers[i].job);
  }
});

test('growth from 0 to 10,000 in steps keeps every invariant', () => {
  let s = genesis({ seed: SEED, date: dateOf(0) });
  const steps = [0, 1, 2, 5, 10, 24, 25, 49, 50, 99, 100, 101, 250, 499, 500, 1000, 1999, 2000, 3500, 5000, 7500, 10000];
  steps.forEach((n, i) => {
    const { state, diff } = advance(s, { subscribers: n, date: dateOf(i + 1) });
    checkInvariants(state);
    assert.equal(diff.added.length, Math.max(0, n - s.subscriberCount));
    s = state;
  });
  // houses built later hold more villagers so the map stays readable
  const caps = s.houses.map((h) => h.capacity);
  assert.equal(caps[0], 1);
  assert.equal(caps.at(-1), houseCapacity(10000));
  assert.ok(s.houses.length < 2000, `10k villagers in ${s.houses.length} houses`);
});

test('unsubscribes remove newest villagers, abandon houses, ruin after 7 days, rebuild ruins first', () => {
  let { state: s } = run([30]);
  let r = advance(s, { subscribers: 20, date: dateOf(10) });
  assert.deepEqual(r.diff.removed.map((v) => v.id), [29, 28, 27, 26, 25, 24, 23, 22, 21, 20]);
  assert.equal(r.diff.housesAbandoned.length, 10);
  checkInvariants(r.state);
  s = r.state;
  const abandoned = s.houses.filter((h) => h.status === 'abandoned').map((h) => h.id);
  for (let d = 1; d < ABANDON_DAYS; d++) {
    r = advance(s, { subscribers: 20, date: dateOf(10 + d) });
    s = r.state;
    assert.equal(s.houses.filter((h) => h.status === 'ruin').length, 0, `day ${d}: still abandoned`);
  }
  r = advance(s, { subscribers: 20, date: dateOf(10 + ABANDON_DAYS) });
  s = r.state;
  assert.deepEqual(r.diff.housesRuined.sort((a, b) => a - b), abandoned.sort((a, b) => a - b));
  const housesBefore = s.houses.length;
  r = advance(s, { subscribers: 26, date: dateOf(30) });
  assert.equal(r.diff.housesRebuilt.length, 6, 'ruins rebuilt');
  assert.equal(r.diff.housesBuilt.length, 0, 'no new plot while ruins remain');
  assert.equal(r.state.houses.length, housesBefore);
  checkInvariants(r.state);
  // re-subscribing villagers return with the same job
  assert.equal(r.state.villagers[25].job, jobFor(SEED, 25));
});

test('abandoned houses are re-occupied before ruins are rebuilt', () => {
  let s = run([20]).state;
  s = advance(s, { subscribers: 10, date: dateOf(5) }).state; // 10 abandoned
  for (let d = 0; d < ABANDON_DAYS; d++) s = advance(s, { subscribers: 10, date: dateOf(6 + d) }).state; // all ruins
  s = advance(s, { subscribers: 6, date: dateOf(20) }).state; // 4 newly abandoned
  const r = advance(s, { subscribers: 12, date: dateOf(21) });
  assert.equal(r.diff.housesReoccupied.length, 4);
  assert.equal(r.diff.housesRebuilt.length, 2);
  checkInvariants(r.state);
});

test('tiers unlock at their thresholds with their unique jobs and buildings', () => {
  for (const t of TIERS.filter((t) => t.at <= 10000)) {
    const below = run([t.at - 1]).state, at = run([t.at - 1, t.at]);
    assert.ok(!below.unlockedTiers.includes(t.id), `${t.id} locked below ${t.at}`);
    assert.ok(at.state.unlockedTiers.includes(t.id), `${t.id} unlocked at ${t.at}`);
    assert.ok(at.diffs[1].unlocked.includes(t.id));
    t.unique.forEach((job, k) => assert.equal(jobFor(SEED, t.at - 1 + k), job));
    for (const b of t.buildings) assert.ok(at.state.buildings.some((x) => x.id === b), `${b} started`);
  }
  // tiers never re-lock when the population shrinks
  const shrink = run([120, 40]).state;
  assert.ok(shrink.unlockedTiers.includes('faith'));
  // jobs come only from tiers reached when the villager arrived
  for (let i = 0; i < 4; i++) assert.ok(['farmer', 'peasant'].includes(jobFor(SEED, i)));
});

test('construction finishes after the configured number of days', () => {
  let { state: s } = run([100]);
  const chapel = s.buildings.find((b) => b.id === 'chapel');
  assert.equal(chapel.status, 'construction');
  for (let d = 1; d <= chapel.daysTotal; d++) {
    const r = advance(s, { subscribers: 100, date: dateOf(1 + d) });
    s = r.state;
    const done = s.buildings.find((b) => b.id === 'chapel').status === 'done';
    assert.equal(done, d === chapel.daysTotal, `day ${d}`);
    if (done) assert.ok(r.diff.buildingsCompleted.includes('chapel'));
  }
});

test('every day has at least one non-weather event, even with no change', () => {
  let s = genesis({ seed: SEED, date: dateOf(0) });
  for (let d = 1; d <= 400; d++) {
    const r = advance(s, { subscribers: d < 3 ? 0 : 42, date: dateOf(d) });
    assert.ok(r.diff.events.some((e) => e.type !== 'weather'), `day ${d} has a story event`);
    assert.ok(r.diff.weather);
    s = r.state;
  }
});

test('migration: v0 bootstrap file becomes a valid current state; newer versions are rejected', () => {
  const s = migrate({ subscribers: 64, seed: SEED, date: '2026-05-01' });
  assert.equal(s.schemaVersion, SCHEMA_VERSION);
  assert.equal(s.subscriberCount, 64);
  checkInvariants(s);
  assert.equal(migrate({}).subscriberCount, 0);
  assert.throws(() => migrate({ ...s, schemaVersion: SCHEMA_VERSION + 1 }), /newer/);
  // compact snapshots (no villager list) are re-derived on load
  const { villagers, ...compact } = s;
  assert.deepEqual(migrate(structuredClone(compact)).villagers, villagers);
  assert.deepEqual(deriveVillagers(s), villagers);
  assert.throws(() => migrate({ ...s, houses: 'nope' }), /invalid state/);
});

test('atomic write leaves no temp files and re-running a day reproduces it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-'));
  const f = path.join(dir, 'a.json');
  writeAtomic(f, '{"a":1}');
  writeAtomic(f, '{"a":2}');
  assert.equal(fs.readFileSync(f, 'utf8'), '{"a":2}');
  assert.deepEqual(fs.readdirSync(dir), ['a.json']);

  const day = (date, n) => {
    const base = baseStateFor(date, { dir, seed: SEED });
    const r = advance(base, { subscribers: n, date });
    saveDay(r.state, r.diff, { dir });
    return r;
  };
  day('2026-03-01', 5);
  const first = day('2026-03-02', 14);
  const again = day('2026-03-02', 14);
  assert.equal(JSON.stringify(again.state), JSON.stringify(first.state));
  assert.equal(JSON.stringify(again.diff), JSON.stringify(first.diff));
  assert.equal(fs.readdirSync(path.join(dir, 'history')).length, 2);
});

const C = (author, name, at) => ({ author, name, at });

test('commenters name the unnamed villagers, one villager per person, oldest comment first', () => {
  let { state: s } = run([5]);
  let r = advance(s, { subscribers: 8, date: dateOf(5), commenters: [C('b', '@Bea', '2026-01-02'), C('a', '@Al', '2026-01-01'), C('a', '@Al', '2026-01-03')] });
  assert.deepEqual(r.state.villagers.slice(0, 3).map((v) => v.name), ['Al', 'Bea', null]);
  assert.deepEqual(r.diff.named.map((n) => n.id), [0, 1]);
  assert.equal(r.state.commentsSeen, '2026-01-03');
  checkInvariants(r.state);
  // the same people commenting again get nothing more
  r = advance(r.state, { subscribers: 8, date: dateOf(6), commenters: [C('a', '@Al', '2026-01-04'), C('c', 'Cy', '2026-01-04')] });
  assert.deepEqual(r.state.villagers.slice(0, 3).map((v) => v.name), ['Al', 'Bea', 'Cy']);
  assert.equal(r.diff.named.length, 1);
});

test('more commenters than villagers wait in a queue; a leaving named villager returns the name to it', () => {
  let { state: s } = run([2]);
  let r = advance(s, { subscribers: 2, date: dateOf(5), commenters: ['a', 'b', 'c'].map((x, i) => C(x, x.toUpperCase(), `2026-01-0${i + 1}`)) });
  assert.deepEqual(r.state.villagers.map((v) => v.name), ['A', 'B']);
  assert.deepEqual(r.state.nameQueue.map((n) => n.name), ['C']);
  r = advance(r.state, { subscribers: 1, date: dateOf(6) });
  assert.deepEqual(r.state.nameQueue.map((n) => n.name), ['B', 'C']);
  r = advance(r.state, { subscribers: 3, date: dateOf(7) });
  assert.deepEqual(r.state.villagers.map((v) => v.name), ['A', 'B', 'C']);
  assert.equal(r.state.nameQueue.length, 0);
  checkInvariants(r.state);
  // history snapshots re-derive the names
  assert.deepEqual(deriveVillagers(r.state).map((v) => v.name), ['A', 'B', 'C']);
});

test('offensive and blocked names are never used, and a block removes a given name', () => {
  let { state: s } = run([4]);
  let r = advance(s, { subscribers: 4, date: dateOf(5), commenters: [C('x', '@fuck_you', '1'), C('y', '🔥🔥', '2'), C('z', '@Zed', '3'), C('w', '@Wil', '4')] });
  assert.deepEqual(r.state.villagers.map((v) => v.name), ['Zed', 'Wil', null, null]);
  r = advance(r.state, { subscribers: 4, date: dateOf(6), blocked: { names: ['@zed'] } });
  assert.deepEqual(r.state.villagers.map((v) => v.name), [null, 'Wil', null, null]);
  checkInvariants(r.state);
  assert.equal(cleanName('@Mario Rossi'), 'Mario Rossi');
  assert.equal(isOffensive('skill_gamer'), false);
});

test('comment job requests: granted when unlocked, apprentice (then promoted) when not, existing villagers can switch', async () => {
  const { wantsFromText } = await import('../src/sim/requests.js');
  const W = (author, name, text, at) => ({ author, name, at, wants: wantsFromText(text) });
  let { state: s } = run([60]);
  let r = advance(s, { subscribers: 60, date: dateOf(5), commenters: [
    W('a', 'Pilot', 'Yo lemme work at the local tavern', '1'),
    W('b', 'Sir', 'make me a knight or smth', '2'),
    W('c', 'Balint', 'commander of the army? if not, a fletcher', '3'),
    W('d', 'Weird', 'can i be the town weirdo', '4'),
  ] });
  const job = (n) => r.state.villagers.find((v) => v.name === n).job;
  assert.equal(job('Pilot'), 'innkeeper');
  assert.equal(job('Sir'), 'apprentice');
  assert.equal(job('Balint'), 'fletcher', 'second choice when the first is locked');
  assert.equal(job('Weird'), 'weirdo');
  assert.deepEqual(r.diff.requests.map((q) => q.granted), [true, false, true, true]);
  checkInvariants(r.state);
  // an existing villager asks for another job later
  r = advance(r.state, { subscribers: 60, date: dateOf(6), commenters: [W('a', 'Pilot', 'actually let me be a blacksmith', '5')] });
  assert.equal(job('Pilot'), 'blacksmith');
  // the knight tier arrives at 500: the apprentice is promoted
  r = advance(r.state, { subscribers: 500, date: dateOf(7) });
  assert.equal(job('Sir'), 'knight');
  assert.deepEqual(r.diff.promoted.map((p) => p.name), ['Sir']);
  // history snapshots keep the chosen jobs
  assert.equal(deriveVillagers(r.state).find((v) => v.name === 'Pilot').job, 'blacksmith');
});

test('comments can choose a name; real comments map to the right jobs; wishes are not requests', async () => {
  const { wantsFromText, nameFromText } = await import('../src/sim/requests.js');
  assert.deepEqual(wantsFromText('I SHAL BE MAKING FARMING TOOLS!'), ['toolsmith']);
  assert.deepEqual(wantsFromText('Yowza i think these people need mead and bread'), ['brewer', 'baker']);
  assert.deepEqual(wantsFromText('maybe later on when there are proper guards'), []);
  assert.equal(wantsFromText('Make me a warrior i am sir coolum now')[0], 'warrior');
  assert.equal(nameFromText('Can I be a villager called sopita?'), 'Sopita');
  assert.equal(nameFromText('could I be a carpenter named henry'), 'Henry');
  assert.equal(nameFromText('Well damn. Please name one Violet.'), 'Violet');
  assert.equal(nameFromText('i am sir coolum now'), 'Coolum');
  assert.equal(nameFromText('GARY LOOK THERE I AM !!!!!'), null);
  const W = (author, name, text, at) => ({ author, name, at, wants: wantsFromText(text), ...(nameFromText(text) ? { call: nameFromText(text) } : {}) });
  let { state: s } = run([10]);
  let r = advance(s, { subscribers: 10, date: dateOf(5), commenters: [W('a', 'PastandPlastic', 'could I be a carpenter named henry', '1'), W('b', 'Bad', 'call me fuckface', '2')] });
  assert.deepEqual(r.state.villagers.slice(0, 2).map((v) => [v.name, v.job]), [['Henry', 'apprentice'], ['Bad', r.state.villagers[1].job]]);
  // an existing villager can change name later
  r = advance(r.state, { subscribers: 10, date: dateOf(6), commenters: [W('a', 'PastandPlastic', 'actually call me Hank', '3')] });
  assert.equal(r.state.villagers[0].name, 'Hank');
  assert.deepEqual(r.diff.renamed, [{ id: 0, from: 'Henry', name: 'Hank' }]);
  assert.equal(deriveVillagers(r.state)[0].name, 'Hank');
  checkInvariants(r.state);
});

test('story events: deterministic, Halloween on its date, cooldowns kept, named villagers only as heroes', async () => {
  const { STORIES } = await import('../src/sim/stories.js');
  const run = () => {
    let s = genesis({ seed: SEED, date: '2026-09-30' });
    const out = [];
    const d = new Date('2026-10-01T00:00:00Z');
    for (let i = 0; i < 70; i++) {
      const date = d.toISOString().slice(0, 10);
      d.setUTCDate(d.getUTCDate() + 1);
      const commenters = i === 0 ? ['Ada', 'Bo', 'Cy', 'Dee'].map((n, k) => ({ author: 'a' + k, name: n, at: `${date}T0${k}:00:00Z`, wants: k === 0 ? ['guard'] : [] })) : [];
      s = advance(s, { subscribers: 60 + i, date, commenters }).state;
      out.push({ date, day: s.day, story: s.story });
    }
    return out;
  };
  const a = run(), b = run();
  assert.deepEqual(a, b);
  assert.equal(a.find((x) => x.date === '2026-10-31').story?.id, 'halloween');
  const last = {};
  for (const x of a) {
    if (!x.story) continue;
    const cd = STORIES[x.story.id].cooldown;
    if (cd && last[x.story.id] !== undefined) assert.ok(x.day - last[x.story.id] >= cd, `${x.story.id} cooldown`);
    last[x.story.id] = x.day;
    if (x.story.id === 'bandits') for (const c of x.story.cast) assert.ok(c.name, 'bandit heroes are named villagers');
  }
  const days = a.filter((x) => x.story).length;
  assert.ok(days > 15 && days < 55, `stories on ${days} of 70 days`);
});
