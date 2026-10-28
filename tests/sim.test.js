import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { genesis, advance, deriveVillagers, ABANDON_DAYS, SCHEMA_VERSION } from '../src/sim/simulate.js';
import { TIERS, jobFor, houseCapacity, mergedJob } from '../src/sim/tiers.js';
import { cleanName, isOffensive } from '../src/sim/names.js';
import { migrate, writeAtomic, saveDay, baseStateFor } from '../src/sim/state.js';
import { validate } from '../src/sim/validate.js';
import { world } from '../src/sim/world.js';

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
  // houses built later hold more villagers so the map stays readable (as built: storeys added later aside)
  const caps = s.houses.map((h) => h.cap0 ?? h.capacity);
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
    t.unique.forEach((job, k) => assert.equal(jobFor(SEED, t.at - 1 + k), mergedJob(job)));
    // begun, or waiting for a day the video can show it (s.buildQueue)
    for (const b of t.buildings) assert.ok([...at.state.buildings, ...at.state.buildQueue].some((x) => x.id === b), `${b} started or queued`);
  }
  // tiers never re-lock when the population shrinks
  const shrink = run([120, 40]).state;
  assert.ok(shrink.unlockedTiers.includes('faith'));
  // jobs come only from tiers reached when the villager arrived
  for (let i = 0; i < 4; i++) assert.ok(['farmer', 'peasant'].includes(jobFor(SEED, i)));
});

test('construction finishes after the configured number of days', () => {
  let { state: s } = run([100]);
  let day = 1;
  while (!s.buildings.some((b) => b.id === 'chapel')) s = advance(s, { subscribers: 100, date: dateOf(++day) }).state; // queued first
  const chapel = s.buildings.find((b) => b.id === 'chapel');
  assert.equal(chapel.status, 'construction');
  for (let d = 1; d <= chapel.daysTotal; d++) {
    const r = advance(s, { subscribers: 100, date: dateOf(day + d) });
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
  assert.equal(isOffensive('georgebranscom892'), false, 'a name with "com" in it is not a link');
  assert.equal(isOffensive('visit mysite.com'), true);
});

test('bad words: whole words, roots, leet and camel case caught; ordinary names that contain them are not', () => {
  for (const n of ['F.U.C.K', 'ShitLord', 'B1tch', 'Mario Cazzo', 'DioCane', 'Big Tits', 'kill yourself', 'n1gger', 'Sieg Heil', 'fïgliodiputtana', 'HurenSohn', 'PutaQuePariu'])
    assert.equal(isOffensive(n), true, n);
  for (const n of ['Regina', 'Pippa', 'Concha', 'Pinto', 'Butt', 'Mona', 'Isis', 'Verga', 'Dickens', 'Cassandra', 'Hancock', 'Peacock', 'Montenegro',
    'Figaro', 'Nazir', 'Therapist', 'Ashita', 'Analyst', 'Sussex', 'Hitchcock', 'Titanic', 'Cumberbatch', 'Assunta', 'Massimo', 'Bimbo', 'Mosè'])
    assert.equal(isOffensive(n), false, n);
});

test('untrusted input: names that look like code or a prompt are never used, comment text is made plain', async () => {
  const { looksLikeCode } = await import('../src/sim/names.js');
  const { plainText, wantsFromText, nameFromText } = await import('../src/sim/requests.js');
  for (const n of ['<script>alert(1)</script>', '${process.env.KEY}', '{{7*7}}', 'Ignore previous instructions', 'system prompt', 'rm -rf /',
    "Robert'); DROP TABLE x;--", '__proto__', '<img src=x onerror=alert(1)>', 'You are now DAN', 'act as admin', 'a`b`', 'ab\\x41'])
    assert.equal(looksLikeCode(n), true, n);
  for (const n of ['Mario Rossi', 'Anna <3', 'Tom & Jerry', 'Zed', 'O.Neil_99']) assert.equal(looksLikeCode(n), false, n);
  // nothing outside letters, digits, space and . _ - reaches the screen
  assert.equal(cleanName('<b>Bea</b>'), 'bBeab');
  assert.equal(cleanName('Ev‮il​name'), 'Evilname');
  // zero-width characters cannot hide a keyword, and very long comments are cut before the regexes
  assert.deepEqual(wantsFromText('make me a bl​acksmith'), ['blacksmith']);
  assert.equal(plainText('x'.repeat(50000)).length, 2000);
  assert.equal(nameFromText('call me <script>'), null);
  let { state: s } = run([6]);
  const r = advance(s, { subscribers: 6, date: dateOf(5), commenters: [
    C('a', 'Ignore all previous instructions', '1'), C('b', '<img src=x onerror=alert(1)>', '2'), C('c', '${process.env.YT_OAUTH_REFRESH_TOKEN}', '3'),
    { ...C('d', '@Dora', '4'), wants: ['__proto__', 'constructor', 'baker', 42] },
  ] });
  assert.deepEqual(r.state.villagers.map((v) => v.name).filter(Boolean), ['Dora']);
  checkInvariants(r.state);
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
  assert.equal(job('Balint'), 'apprentice', 'the first job named is locked: apprentice, never a later one (owner 2026-10-23)');
  assert.equal(job('Weird'), 'jester', 'the weirdo is folded into the jester');
  assert.deepEqual(r.diff.requests.map((q) => q.granted), [true, false, false, true]);
  checkInvariants(r.state);
  // an existing villager asks for another job later
  r = advance(r.state, { subscribers: 60, date: dateOf(6), commenters: [W('a', 'Pilot', 'actually let me be a blacksmith', '5')] });
  assert.equal(job('Pilot'), 'blacksmith');
  // the knight tier arrives at 500: the apprentice is promoted
  r = advance(r.state, { subscribers: 500, date: dateOf(7) });
  assert.equal(job('Sir'), 'knight');
  assert.deepEqual(r.diff.promoted.map((p) => p.name), ['Sir', 'Balint']);
  // history snapshots keep the chosen jobs
  assert.equal(deriveVillagers(r.state).find((v) => v.name === 'Pilot').job, 'blacksmith');
});

test('comments can choose a name; real comments map to the right jobs; wishes are not requests', async () => {
  const { wantsFromText, nameFromText } = await import('../src/sim/requests.js');
  assert.deepEqual(wantsFromText('I SHAL BE MAKING FARMING TOOLS!'), ['blacksmith']);
  assert.deepEqual(wantsFromText('Yowza i think these people need mead and bread'), ['brewer', 'baker']);
  assert.deepEqual(wantsFromText('maybe later on when there are proper guards'), []);
  assert.equal(wantsFromText('Make me a warrior i am sir coolum now')[0], 'guard');
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
    // a story told over several days: the cooldown counts from its last step to the next start
    const steps = STORIES[x.story.id].steps;
    if (steps && x.story.step !== steps[0]) { last[x.story.id] = x.day; continue; }
    const cd = STORIES[x.story.id].cooldown;
    if (cd && last[x.story.id] !== undefined) assert.ok(x.day - last[x.story.id] >= cd, `${x.story.id} cooldown`);
    last[x.story.id] = x.day;
    if (x.story.id === 'bandits') for (const c of x.story.cast) assert.ok(c.name, 'bandit heroes are named villagers');
  }
  const days = a.filter((x) => x.story).length;
  assert.ok(days > 15 && days < 55, `stories on ${days} of 70 days`);
});

test('every named villager gets a turn on screen, two at a time when they work together', async () => {
  const { pickFeatured, featuredPeople, markShown, PAIRS } = await import('../src/sim/featured.js');
  // a small kingdom with eight named villagers and no tavern
  const jobs = ['blacksmith', 'guard', 'baker', 'miller', 'farmer', 'woodcutter', 'fisherman', 'carpenter'];
  const s = {
    seed: 5, day: 10, subscriberCount: 20, buildings: [],
    names: Object.fromEntries(jobs.map((j, i) => [i, { name: `N${i}`, job: j, day: 1 }])),
    villagers: jobs.map((j, i) => ({ id: i, job: j })),
  };
  const f = pickFeatured(s);
  assert.ok(f.length <= 3);
  for (const x of f.filter((y) => y.pair && y.pair !== 'visit')) {
    const p = PAIRS.find((q) => q.id === x.pair);
    assert.ok(p.host.includes(x.job) && p.guest.includes(x.with.job), `${x.job} + ${x.with.job}: ${x.pair}`);
  }
  const people = featuredPeople(f);
  assert.equal(new Set(people.map((p) => p.job)).size, people.length, 'one villager per job');
  // over the next days the ones not shown yet come first, until everybody has been on screen
  const seen = new Set();
  for (let day = 10; day < 14; day++) {
    s.day = day;
    const today = pickFeatured(s, { avoidJobs: [] });
    for (const p of featuredPeople(today)) seen.add(p.id);
    markShown(s, today);
  }
  assert.equal(seen.size, jobs.length, `shown: ${[...seen]}`);
});

test('story events: also on busy days; multi-day stories go on step by step', async () => {
  const { STORIES } = await import('../src/sim/stories.js');
  let s = genesis({ seed: SEED, date: '2026-09-30' });
  const d = new Date('2026-10-01T00:00:00Z');
  const seen = [];
  let subs = 60;
  for (let i = 0; i < 90; i++) {
    const date = d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
    const busy = i % 4 === 2;
    subs += busy ? 20 : 3;
    const n = i === 0 ? 4 : busy ? 15 : 1;
    const commenters = Array.from({ length: n }, (_, k) => ({ author: `a${i}-${k}`, name: `N${i}x${k}`, at: `${date}T00:${String(k).padStart(2, '0')}:00Z` }));
    const r = advance(s, { subscribers: subs, date, commenters });
    s = r.state;
    assert.equal(r.diff.newCommenters, n);
    if (r.diff.story) seen.push({ ...r.diff.story, busy });
  }
  // every multi-day story that starts goes through its steps in order
  const open = {};
  for (const st of seen) {
    const steps = STORIES[st.id].steps;
    if (!steps) continue;
    const k = steps.indexOf(st.step);
    assert.ok(k >= 0, `${st.id} has step ${st.step}`);
    if (k > 0) assert.equal(open[st.id], steps[k - 1], `${st.id}: ${st.step} after ${open[st.id]}`);
    open[st.id] = k + 1 < steps.length ? st.step : undefined;
  }
  assert.ok(seen.some((st) => st.step && st.step !== STORIES[st.id].steps[0]), 'some story went on to a later step');
  assert.ok(seen.some((st) => st.busy), 'a story also on a day with 15 new commenters (owner 2026-10-22)');
});

test('comments saying they cannot find themselves are spotted, and that villager is shown first in the next video', async () => {
  const { complainsFromText } = await import('../src/sim/requests.js');
  for (const t of ["I can't see myself", 'where am i??', 'my name wasn’t there :(', 'I was not in the video', 'non mi vedo', "non c'è il mio nome", 'dove sono io?', "couldn't find my villager"]) {
    assert.ok(complainsFromText(t), t);
  }
  // owner 2026-10-27: those asking to be seen too
  for (const t of ['Day 3 of asking to be a Priest', 'Day, four of asking to be the king’s night', "Day three asking to be the army's general", 'Day 3 for sawbonee?',
    'Am I a guard 😢', 'I have no idea what job i have', "I'm pretty sure my comments haven't been heard by the king", 'what is my job?', 'sono un fabbro?',
    'giorno 4 che chiedo di essere fornaio', 'I never got picked']) assert.ok(complainsFromText(t), t);
  for (const t of ['I love this kingdom', 'can I be a baker?', 'I see my house!', 'call me Violet', 'Another glorious day in the kingdom', 'Day 11 was great',
    'day 1 of the kingdom was cool', 'I have not seen a better channel', 'I am a hunter.', 'sono un grande fan']) assert.ok(!complainsFromText(t), t);
  let s = genesis({ seed: SEED, date: '2026-09-30' });
  const names = ['Ada', 'Bo', 'Cy', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo'];
  s = advance(s, { subscribers: 40, date: '2026-10-01', commenters: names.map((n, k) => ({ author: 'a' + k, name: n, at: `2026-10-01T0${k}:00:00Z` })) }).state;
  s = advance(s, { subscribers: 41, date: '2026-10-02', commenters: [] }).state;
  const shown = new Set(Object.entries(s.lastShown).filter(([, d]) => d === s.day).map(([id]) => Number(id)));
  const hidden = Object.entries(s.names).find(([id]) => !shown.has(Number(id)) && Number(s.lastShown[id]) !== s.day);
  const author = hidden[1].author;
  const r = advance(s, { subscribers: 42, date: '2026-10-03', commenters: [{ author, name: hidden[1].name, at: '2026-10-03T01:00:00Z', complains: true }] });
  assert.deepEqual(r.diff.complaints.map((c) => c.id), [Number(hidden[0])]);
  const people = r.diff.featured.flatMap((f) => (f.with ? [f.id, f.with.id] : [f.id]));
  assert.ok(people.includes(Number(hidden[0])), 'the villager who could not find themselves is on screen');
});

test('scenes: the same scene does not come back within three days', async () => {
  const { SCENE_GAP } = await import('../src/sim/scenes.js');
  let s = genesis({ seed: SEED, date: '2026-09-30' });
  const d = new Date('2026-10-01T00:00:00Z');
  const last = {};
  for (let i = 0; i < 40; i++) {
    const date = d.toISOString().slice(0, 10);
    d.setUTCDate(d.getUTCDate() + 1);
    const commenters = i % 3 === 0 ? [0, 1, 2].map((k) => ({ author: `a${i}-${k}`, name: `N${i}x${k}`, at: `${date}T0${k}:00:00Z` })) : [];
    const r = advance(s, { subscribers: 150 + i * 3, date, commenters });
    s = r.state;
    const keys = Object.entries(s.sceneLog).filter(([, day]) => day === s.day).map(([k]) => k);
    for (const k of keys) {
      // a job with few scenes may have to repeat one when its villager must be shown; the tavern and the everyday shots never do
      if ((k === 'tavern' || k === 'church' || k.startsWith('ambient:')) && last[k] !== undefined) assert.ok(s.day - last[k] >= SCENE_GAP, `${k} on day ${last[k]} and ${s.day}`);
      last[k] = s.day;
    }
    // one interior a day at most: the tavern or the church (owner 2026-10-23); no priest at work in a croft
    assert.ok(!(s.scenes.tavern && s.scenes.church), `tavern and church on day ${s.day}`);
    assert.ok(!s.featured.some((f) => ['priest', 'bishop'].includes(f.job) || ['priest', 'bishop'].includes(f.with?.job)), 'a priest at work');
  }
  assert.ok(last.tavern !== undefined, 'the tavern was shown');
  assert.ok(last.church !== undefined, 'the church was shown');
});

test('inside the Second Wall houses get another storey before new plots are used', async () => {
  const { houseFloors } = await import('../src/sim/simulate.js');
  const { insideWall2 } = await import('../src/sim/wall.js');
  const { state: s0 } = run([0, 120, 260, 300, 300, 300, 300, 300, 300]); // the queued buildings begin a few a day
  assert.ok(s0.wall2, 'the Second Wall is begun');
  const plots0 = s0.plots.length;
  const { state: s, diff } = advance(s0, { subscribers: 420, date: dateOf(20) });
  checkInvariants(s);
  assert.ok(diff.housesRaised.length > 0, 'houses were raised');
  assert.equal(diff.housesBuilt.length, 0, 'no new plot while a house inside can grow');
  assert.equal(s.plots.length, plots0);
  const plots = new Map(s.plots.map((p) => [p.id, p]));
  for (const id of diff.housesRaised) {
    const h = s.houses[id], p = plots.get(h.plot);
    assert.ok(insideWall2(s.wall2.pts, p.x, p.z, undefined, world(s.seed)), `house ${id} is inside the walls (or between the wall and the river)`);
    assert.ok(houseFloors(s.seed, h) <= 3 && h.capacity === h.cap0 + 2 * (h.floors - houseFloors(s.seed, { plot: h.plot, capacity: h.cap0 })));
  }
});

test('guards on the Second Wall only once it is finished', async () => {
  const { pickVariant, sceneReady } = await import('../src/sim/scenes.js');
  const building = { buildings: [{ id: 'wall2', status: 'construction' }] }, done = { buildings: [{ id: 'wall2', status: 'done' }] };
  const picks = (state) => new Set(Array.from({ length: 200 }, (_, id) => pickVariant('guard', SEED, 9, id, new Set(), { ready: (v) => sceneReady(state, v) })));
  const early = picks(building), later = picks(done);
  for (const v of ['wall2', 'wall2night', 'wall2change']) {
    assert.ok(!early.has(v), `${v} before the wall is finished`);
    assert.ok(later.has(v), `${v} once it is finished`);
  }
  for (const v of ['walls', 'wallnight', 'change']) assert.ok(early.has(v), `${v} on the castle walls`);
});

test('innkeepers and brewers serve inside the tavern once it stands, the crier calls from his stand (owner 2026-10-23)', async () => {
  const { pickVariant, sceneReady } = await import('../src/sim/scenes.js');
  const before = { buildings: [{ id: 'tavern', status: 'construction' }] }, open = { buildings: [{ id: 'tavern', status: 'done' }, { id: 'crier_stand', status: 'done' }] };
  const picks = (job, state, croft = false) => new Set(Array.from({ length: 60 }, (_, id) => pickVariant(job, SEED, 9, id, new Set(), { croft, ready: (v) => sceneReady(state, v) })));
  for (const job of ['innkeeper', 'brewer']) {
    assert.deepEqual([...picks(job, open)], ['inside'], `${job} once the tavern is open`);
    assert.deepEqual([...picks(job, open, true)], ['inside'], `${job} with a visitor`);
    assert.ok(!picks(job, before).has('inside'), `${job} before the tavern is open`);
  }
  assert.deepEqual([...picks('crier', open)], ['stand']);
  assert.deepEqual([...picks('crier', before)], [null], 'no stand yet: the croft');
  assert.deepEqual([...picks('crier', open, true)], [null], 'a visitor: the croft');
});

test('villagers introduced today are shown alone in an everyday scene of their job (owner 2026-10-23)', async () => {
  const { introVariant, planScenes } = await import('../src/sim/scenes.js');
  const { pickFeatured } = await import('../src/sim/featured.js');
  const kingdom = (date, jobs) => ({
    seed: SEED, day: 9, date, subscriberCount: jobs.length, unlockedTiers: ['guard'], buildings: [], pendingConstruction: [], sceneLog: {},
    villagers: jobs.map((job) => ({ job })), names: Object.fromEntries(jobs.map((job, id) => [id, { name: `N${id}`, job, day: 9 }])),
  });
  const plan = (s) => {
    const featured = pickFeatured(s, { avoidJobs: [], tavern: false, intro: (job) => !!introVariant(s, job) });
    return { featured, scenes: planScenes(s, { featured, tavern: false }) };
  };
  const { featured, scenes } = plan(kingdom('2026-10-23', ['guard', 'blacksmith', 'farmer']));
  for (const [id, want] of [[0, ['change']], [2, ['wheat', 'fields']]]) {
    const f = featured.find((x) => x.id === id);
    assert.ok(f && !f.with, `${f?.job ?? id} is shown alone`);
    assert.ok(want.includes(scenes.variants[id]), `${f.job}: ${scenes.variants[id]}`);
  }
  assert.ok(!featured.some((f) => f.with?.id === 0), 'the new guard does not visit the smith');
  assert.equal(plan(kingdom('2026-10-23', ['shepherd', 'peasant'])).scenes.variants[0], 'pasture');
  assert.equal(plan(kingdom('2026-10-23', ['shepherd', 'peasant'])).scenes.variants[1], 'laundry');
  // winter: no work on the land, so the farmer may visit or be visited again
  assert.equal(introVariant(kingdom('2026-01-10', ['farmer']), 'farmer'), null);
  // shown in the last days: not again
  const seen = kingdom('2026-10-23', ['guard']);
  seen.sceneLog = { 'guard:change': 8 };
  assert.equal(introVariant(seen, 'guard'), null);
});

test('scenes away from the croft of 2026-10-23: the market, the tavern, a building going up', async () => {
  const { pickVariant, sceneReady } = await import('../src/sim/scenes.js');
  const town = { buildings: [{ id: 'market', status: 'done' }, { id: 'tavern', status: 'done' }], pendingConstruction: [] };
  const bare = { buildings: [], pendingConstruction: [{ building: 'wall2' }] };
  const picks = (job, state, croft = false) => new Set(Array.from({ length: 60 }, (_, id) => pickVariant(job, SEED, 9, id, new Set(), { croft, ready: (v) => sceneReady(state, v) })));
  assert.deepEqual([...picks('bard', town)].sort(), ['inn', 'square']);
  assert.deepEqual([...picks('bard', bare)], [null], 'no market and no tavern: the lute in the croft');
  for (const job of ['cook', 'butcher']) assert.deepEqual([...picks(job, town)], ['stall']);
  assert.deepEqual([...picks('jester', town)].sort(), ['kids', 'square']);
  // owner 2026-10-25: second scenes, the physician at the booth, the clergy out at work
  const more = { buildings: [...town.buildings, { id: 'fields', status: 'done' }, { id: 'physician_booth', status: 'done' }], pendingConstruction: [] };
  assert.deepEqual([...picks('taxcollector', more)].sort(), ['rounds'], 'no Counting House yet: door to door');
  assert.deepEqual([...picks('merchant', more)].sort(), ['cart', 'stall']);
  assert.deepEqual([...picks('physician', more)], ['booth']);
  assert.deepEqual([...picks('priest', more)].sort(), ['bless', 'preach', 'shrine']);
  assert.deepEqual([...picks('priest', more, true)], ['shrine'], 'a visitor: by the house');
  assert.deepEqual([...picks('executioner', more)].sort(), ['chop', 'grind']);
  assert.deepEqual([...picks('engineer', bare)], [null], 'only the wall going up: no site to stand at');
  assert.deepEqual([...picks('engineer', { ...bare, pendingConstruction: [{ building: 'chapel' }] })], ['site']);
  assert.deepEqual([...picks('chimneysweep', town)], ['house']);
  assert.deepEqual([...picks('chimneysweep', town, true)], [null], 'a visitor: the croft');
  assert.deepEqual([...picks('hunter', town)].sort(), ['boar', 'stag']);
  assert.ok(picks('carpenter', town).has('cart') && !picks('carpenter', town, true).has('cart'));
});

test('knights train in the lists once the Tournament Ground stands, no longer on the castle walls', async () => {
  const { pickVariant, sceneReady } = await import('../src/sim/scenes.js');
  const picks = (job, state) => new Set(Array.from({ length: 60 }, (_, id) => pickVariant(job, SEED, 9, id, new Set(), { ready: (v) => sceneReady(state, v, job) })));
  const lists = { buildings: [{ id: 'tournament', status: 'done' }], pendingConstruction: [] };
  assert.ok(picks('knight', { buildings: [], pendingConstruction: [] }).has('walls'));
  assert.deepEqual([...picks('knight', lists)].sort(), ['dummy', 'sparring']);
  assert.ok(picks('guard', lists).has('walls'), 'the guards still keep the walls');
});

test('the Second Wall never stands on a house: planned round the town, houses in its way move, new ones keep off it', async () => {
  const { wallBlockers } = await import('../src/sim/wall.js');
  const { obbOverlap } = await import('../src/sim/geometry.js');
  const { world } = await import('../src/sim/world.js');
  const { state: s, diffs } = run([60, 140, 240, 270, 330, 420]);
  checkInvariants(s);
  assert.ok(s.wall2?.pts?.length >= 3, 'the route is planned when the wall begins');
  const w = world(s.seed);
  const wall = wallBlockers(w, s.wall2.pts);
  for (const p of s.plots) assert.ok(!wall.some((b) => obbOverlap(b, p)), `plot ${p.id} is on the wall`);
  // both ends on the river bank
  for (const [x, z] of [s.wall2.pts[0], s.wall2.pts.at(-1)]) assert.ok(w.river.dist(x, z) < 16, 'the wall ends at the water');
  assert.ok(diffs.every((d) => Array.isArray(d.housesMoved)));
});

test('the Second Wall keeps off the fields and buildings and runs down to the river at both ends', async () => {
  const { world, RIVER_HALF_WIDTH } = await import('../src/sim/world.js');
  const { crossesFields } = await import('../src/sim/wall.js');
  const { ensureWall2 } = await import('../src/sim/simulate.js');
  // day 2026-10-22 was planned over two wheat fields (owner): the route is planned again, once
  const { state: raw } = JSON.parse(fs.readFileSync(new URL('../state/history/2026-10-22.json', import.meta.url)));
  const s = migrate(raw), w = world(s.seed);
  assert.ok(crossesFields(w, s.wall2.pts), 'the saved route crossed the fields');
  ensureWall2(s, w, { housesMoved: [] });
  assert.ok(!crossesFields(w, s.wall2.pts), 'the new route keeps off fields and building lots');
  for (const [x, z] of [s.wall2.pts[0], s.wall2.pts.at(-1)]) assert.ok(w.river.dist(x, z) <= RIVER_HALF_WIDTH + 1.01, 'each end on the river bank');
});

test('the University opens at 1000 below the castle; merchants, knights, scholars... live in the Noble Quarter', async () => {
  const { DEFAULT_SEED } = await import('../src/sim/simulate.js');
  const { obstacles, CASTLE, MARKET } = await import('../src/sim/world.js');
  const { obbOverlap } = await import('../src/sim/geometry.js');
  const w = world(DEFAULT_SEED);
  const uni = w.lots.university;
  assert.ok(uni.z > CASTLE.moatOuter && uni.x < MARKET.x, 'the University stands below the castle');
  assert.ok(w.finePlots.length >= 20, `${w.finePlots.length} wide plots`);
  const others = [...w.plots, ...obstacles(w).filter((o) => !['road', 'wall2'].includes(o.kind)).map((o) => o.box)]; // wall2: the first plan, never built
  for (const p of w.finePlots) assert.ok(!others.some((o) => obbOverlap(p, o)), `noble plot ${p.id} overlaps`);
  // the University may wait a few days in the queue (only a few buildings begin each day)
  const { state: s, diffs } = run([300, 700, 990, 1100, 1100, 1100, 1100, 1100, 1100, 1100, 1100, 1300, 1500], DEFAULT_SEED);
  checkInvariants(s);
  assert.ok(diffs.slice(3).some((d) => d.buildingsStarted.includes('university')), 'the University is begun after 1000');
  const fine = s.houses.filter((h) => h.fine);
  assert.ok(fine.length > 0, 'fine houses are built');
  const rich = new Set(['merchant', 'knight', 'scholar', 'physician', 'mayor', 'reeve', 'bishop', 'taxcollector', 'chronicler', 'admiral']);
  for (const h of fine) {
    assert.ok(h.plot >= 100000 && s.plots.find((p) => p.id === h.plot).fine);
    for (const id of h.occupants) assert.ok(rich.has(s.villagers[id].job), `${s.villagers[id].job} in a fine house`);
    assert.ok(h.occupants.every((id) => id >= 1000), 'only newcomers after the University is begun');
  }
});

test("the Fletcher's Workshop (a commission) is begun on the next day, once, on free ground by a street", async () => {
  const { DEFAULT_SEED } = await import('../src/sim/simulate.js');
  const { obbOverlap, grow } = await import('../src/sim/geometry.js');
  for (const seed of [SEED, DEFAULT_SEED]) {
    const w = world(seed);
    const lot = w.lots.fletcher_workshop;
    assert.ok(lot, `no lot for seed ${seed}`);
    for (const p of [...w.plots, ...w.finePlots, ...w.fields]) assert.equal(obbOverlap(lot, p), false, `on ${p.id ?? 'a field'}`);
    for (const l of Object.values(w.lots)) if (l !== lot && (!l.virtual || l.hw > 0)) assert.equal(obbOverlap(grow(lot, 1), l), false, `on ${l.id}`);
  }
  const { state: s, diffs } = run([3, 4, 5]);
  assert.ok(diffs[0].buildingsStarted.includes('fletcher_workshop'));
  assert.ok(!diffs.slice(1).some((d) => d.buildingsStarted.includes('fletcher_workshop')));
  assert.equal(s.buildings.filter((b) => b.id === 'fletcher_workshop').length, 1);
  assert.equal(s.buildings.find((b) => b.id === 'fletcher_workshop').status, 'done');
});

test('jobs folded on 2026-10-23: mayor and reeve collect taxes, weaver, chronicler, admiral; the Counting House comes with them', async () => {
  const { wantsFromText, availableJobs } = await import('../src/sim/requests.js');
  const { obbOverlap, grow } = await import('../src/sim/geometry.js');
  const index = (job) => TIERS.find((t) => t.unique.includes(job)).at - 1 + TIERS.find((t) => t.unique.includes(job)).unique.indexOf(job);
  for (const [job, to] of [['reeve', 'taxcollector'], ['mayor', 'taxcollector'], ['chronicler', 'scholar'], ['admiral', 'fisherman']]) assert.equal(jobFor(SEED, index(job)), to);
  for (const [text, job] of [['can I be the mayor', 'taxcollector'], ['I want to be a weaver', 'tailor'], ['make me the chronicler', 'scholar'], ['admiral please', 'fisherman']]) assert.deepEqual(wantsFromText(text), [job]);
  assert.ok(availableJobs(300).has('taxcollector'), 'tax collectors from 250');
  // the Counting House and the Apothecary's Shop stand on free ground by a street
  const w = world(SEED);
  for (const id of ['counting_house', 'apothecary_shop']) {
    const lot = w.lots[id];
    assert.ok(lot, id);
    for (const p of [...w.plots, ...w.finePlots, ...w.densePlots, ...w.fields]) assert.equal(obbOverlap(lot, p), false, `${id} on ${p.id ?? 'a field'}`);
    for (const l of Object.values(w.lots)) if (l !== lot && (!l.virtual || l.hw > 0)) assert.equal(obbOverlap(grow(lot, 1), l), false, `${id} on ${l.id}`);
  }
  // a kingdom that reached 250 before the Counting House existed begins it on its next day
  const { state: s0 } = run([0, 120, 260, 300, 300, 300, 300, 300, 300]);
  s0.buildings = s0.buildings.filter((b) => b.id !== 'counting_house');
  s0.pendingConstruction = s0.pendingConstruction.filter((p) => p.building !== 'counting_house');
  s0.buildQueue = (s0.buildQueue || []).filter((q) => q.id !== 'counting_house');
  const later = [];
  let s = s0;
  for (let i = 0; i < 4; i++) { const r = advance(s, { subscribers: 300, date: dateOf(10 + i) }); s = r.state; later.push(...r.diff.buildingsStarted); }
  assert.ok(later.includes('counting_house'), 'the Counting House is begun');
  assert.equal(s.buildings.filter((b) => b.id === 'counting_house').length, 1);
});

test('comment words of 2026-10-22: typos and synonyms reach the jobs, the new jobs are asked for, a name is not a job', async () => {
  const { wantsFromText } = await import('../src/sim/requests.js');
  const cases = {
    'i wanna be a gaurd': 'guard', 'THANK YOU FIR ADDINF ME AS A GAAurd': 'guard', 'I subscribed can i be a mercenary': 'guard',
    'May i be the Bishop of this great kingdom': 'bishop', 'Can I be a weaponsmith?': 'blacksmith', 'Can I own my own pub': 'innkeeper',
    'yo can i work on the harbour': 'fisherman', 'i want to be the herbalist': 'apothecary', 'I subbed can I be a messenger?': 'crier',
    'May I be town idiot': 'jester', 'Can I be a military officer': 'knight', 'May I Be A Architect': 'stonemason', 'Subbed Can I be a politician': 'taxcollector',
    'May I be a lawyer': 'taxcollector', 'Can i be the head of trade?': 'merchant', 'Can I be a scientist': 'scholar', 'can i be a groudnskeeper or gardener': 'peasant',
    'can I be a Hunter?': 'hunter', 'can i be a butcher': 'butcher', 'I request to be an egineer': 'engineer', 'May I be a Shepard tending to sheep?': 'shepherd',
    'Can I be a rancher? I like goats': 'shepherd', 'i want to be a tanner please': 'tanner', 'loyal military engineer': 'engineer',
    'call me Hunter, I want to bake bread': 'baker',
  };
  for (const [text, job] of Object.entries(cases)) assert.equal(wantsFromText(text)[0], job, text);
  const { JOBS } = await import('../src/sim/tiers.js');
  for (const j of ['hunter', 'butcher', 'shepherd', 'tanner']) assert.ok(JOBS[j]?.requestOnly, j);
  // the Engineer comes at 2500: asked for before that, the villager is an apprentice until then
  const { tierOfJob, availableJobs } = await import('../src/sim/requests.js');
  assert.equal(tierOfJob('engineer')?.at, 2500);
  assert.equal(availableJobs(2499).has('engineer'), false);
  assert.equal(availableJobs(2500).has('engineer'), true);
});

test('no more buildings begin on a day than the video can show; the rest wait for the next days', () => {
  const { state: s, diffs } = run([800, 800, 800, 800, 800, 800, 800, 800, 800, 800, 800, 800]);
  const NO_SHOT = new Set(['fields', 'guardposts', 'charter_stone']);
  for (const d of diffs) assert.ok(d.buildingsStarted.filter((b) => !NO_SHOT.has(b)).length <= 3, `day ${d.day}: ${d.buildingsStarted}`);
  assert.ok(diffs[0].buildingsWaiting?.length > 0, 'some wait on the first day');
  assert.equal(s.buildQueue.length, 0, 'all have begun in the end');
  checkInvariants(s);
});

test("the guards' tournament: a knockout of eight named guards over three days, older names win 85%, the champion is captain (owner 2026-10-25)", async () => {
  const { storyFor, STORIES } = await import('../src/sim/stories.js');
  assert.deepEqual(STORIES.tourney.steps, ['round1', 'semis', 'final']);
  // guards 0-3 named on day 1, 4-7 on day 5, 8-9 on day 5 too
  const kingdom = (date) => ({
    seed: SEED, date, day: 9, buildings: [], weather: 'clear',
    villagers: Array.from({ length: 10 }, () => ({ job: 'guard' })),
    names: Object.fromEntries(Array.from({ length: 10 }, (_, id) => [id, { name: `G${id}`, day: id < 4 ? 1 : 5 }])),
  });
  let older = 0, mixed = 0, same = 0, sameA = 0;
  for (let d = 1; d <= 400; d++) {
    const date = `2027-${String(1 + (d % 12)).padStart(2, '0')}-${String(1 + (d % 28)).padStart(2, '0')}-${d}`;
    const s = kingdom(date);
    const t = storyFor(s, 'tourney');
    assert.equal(t.rounds.length, 3);
    assert.deepEqual(t.rounds.map((b) => b.length), [4, 2, 1]);
    assert.equal(new Set(t.cast.map((c) => c.id)).size, 8, 'eight different guards');
    for (const [k, bouts] of t.rounds.entries()) {
      for (const b of bouts) {
        assert.ok([b.a.id, b.b.id].includes(b.winner));
        if (k + 1 < t.rounds.length) assert.ok(t.rounds[k + 1].some((n) => n.a.id === b.winner || n.b.id === b.winner), 'the winner fights next');
        if (b.a.day !== b.b.day) { mixed++; if (b.winner === (b.a.day < b.b.day ? b.a : b.b).id) older++; } else { same++; if (b.winner === b.a.id) sameA++; }
      }
    }
    const fin = storyFor(s, 'tourney:final');
    assert.equal(fin.cast.length, 2);
    assert.equal(s.guardCaptain, t.champion, 'the champion becomes captain');
  }
  assert.ok(Math.abs(older / mixed - 0.85) < 0.05, `older names win ${(older / mixed).toFixed(2)}`);
  assert.ok(Math.abs(sameA / same - 0.5) < 0.07, `same day ${(sameA / same).toFixed(2)}`);
  // too few named guards: no tournament
  const few = kingdom('2027-01-01');
  for (const id of [7, 8, 9]) few.villagers[id].job = 'farmer';
  assert.equal(storyFor(few, 'tourney'), null);
});

test('the games at the Tournament Ground (owner 2026-10-28): announced, guards who comment "join" ride, drawn by seniority; the King gives the title', async () => {
  const { storyFor, STORIES, drawGuards, GAMES } = await import('../src/sim/stories.js');
  const { joinFromText } = await import('../src/sim/requests.js');
  const { rng } = await import('../src/sim/prng.js');
  for (const id of ['race', 'joust']) assert.deepEqual(STORIES[id].steps, ['announce', 'results']);
  assert.deepEqual([GAMES.race.riders, GAMES.joust.riders], [4, 2]);
  // guards 0-11 named on days 1-12 (0 the oldest); 1 is the Captain of the Guard; 12 a farmer
  const kingdom = (date, weather = 'clear') => ({
    seed: SEED, date, day: 20, subscriberCount: 600, weather, storyLog: {}, guardCaptain: 1,
    buildings: [{ id: 'tournament', status: 'done' }], houses: [],
    villagers: Array.from({ length: 13 }, (_, id) => ({ id, job: id === 12 ? 'farmer' : 'guard' })),
    names: Object.fromEntries(Array.from({ length: 13 }, (_, id) => [id, { name: `V${id}`, day: 1 + id }])),
  });
  assert.ok(STORIES.race.needs(kingdom('2026-11-03')) && !STORIES.race.needs(kingdom('2026-11-03', 'rain')));
  const noGround = kingdom('2026-11-03');
  noGround.buildings = [];
  assert.ok(!STORIES.joust.needs(noGround), 'only once the Tournament Ground stands');
  // "join" in a comment
  assert.ok(joinFromText('JOIN!') && joinFromText('i want to join the race') && joinFromText('partecipo') && !joinFromText('joined the kingdom yesterday, love it'));
  // day 1: the crier and named guards in front of him
  const ann = storyFor(kingdom('2026-11-03'), 'race');
  assert.equal(ann.step, 'announce');
  assert.ok(ann.cast.every((c) => c.job === 'guard'));
  // day 2: those who joined after the announcement ride first, the places left go to other guards; never the Captain
  for (let d = 1; d <= 30; d++) {
    const s = kingdom(`2026-12-${String(1 + (d % 28)).padStart(2, '0')}-${d}`);
    s.names[9].joinDay = 20; s.names[10].joinDay = 20; s.names[3].joinDay = 19; // 3 joined before the announcement (day 19)
    const riders = drawGuards(s, rng(SEED, 'g', d), 4, 19);
    assert.equal(riders.length, 4);
    assert.ok(riders.some((x) => x.id === 9) && riders.some((x) => x.id === 10), 'both who joined ride');
    assert.equal(riders.filter((x) => x.joined).length, 2);
    assert.ok(riders.every((x) => x.id !== 1 && x.id !== 12), 'guards only, not the Captain');
  }
  // the older a guard's name, the better the chance: the oldest weighs 1.9, the newest 1.0
  const counts = new Map();
  for (let d = 0; d < 6000; d++) for (const x of drawGuards(kingdom('2026-11-03'), rng(SEED, 'w', d), 1, 99)) counts.set(x.id, (counts.get(x.id) || 0) + 1);
  const ratio = counts.get(0) / counts.get(11);
  assert.ok(ratio > 1.65 && ratio < 2.2, `oldest vs newest ${ratio.toFixed(2)}`);
  // the results: the winner gets the title of the game
  for (const [id, title, n] of [['race', 'cavalier', 4], ['joust', 'knight', 2]]) {
    const s = kingdom('2026-11-04');
    const res = storyFor(s, `${id}:results`);
    assert.equal(res.step, 'results');
    assert.equal(res.riders.length, n);
    assert.ok(res.riders.some((x) => x.id === res.winner));
    assert.equal(s.villagers[res.winner].job, title);
    assert.equal(s.names[res.winner][`${title}Day`], 20);
    assert.ok(res.crowd.every((c) => !res.riders.some((x) => x.id === c.id)), 'the stands hold others');
  }
  // too few guards: no games
  const few = kingdom('2026-11-03');
  for (let id = 2; id < 12; id++) few.villagers[id].job = 'farmer';
  assert.ok(!STORIES.joust.needs(few) && !STORIES.race.needs(few));
});

test('stories of 2026-10-27: the ship, the new bell, the fog, the census, the pies and the regatta', async () => {
  const { storyFor, STORIES } = await import('../src/sim/stories.js');
  const { buildScript } = await import('../src/audio/narration.js');
  const jobs = ['bellfounder', 'sailor', 'fisherman', 'reeve', 'merchant', 'baker', 'guard', 'farmer', 'cooper', 'potter', 'miller', 'peasant'];
  const kingdom = (weather = 'clear', built = ['harbor', 'bell_foundry', 'cathedral', 'dock', 'counting_house', 'tavern']) => ({
    seed: SEED, date: '2026-11-04', day: 40, subscriberCount: 4321, weather, storyLog: {},
    buildings: built.map((id) => ({ id, status: 'done' })), houses: [],
    villagers: jobs.map((job, id) => ({ id, job })),
    names: Object.fromEntries(jobs.map((_, id) => [id, { name: `V${id}`, day: 1 + id }])),
  });
  assert.deepEqual(STORIES.ship.steps, ['arrive', 'unload', 'leave']);
  assert.deepEqual(STORIES.bell.steps, ['pour', 'cool', 'raise']);
  // each one only where it can happen
  const none = kingdom('clear', []);
  for (const id of ['ship', 'bell', 'fogboat', 'census', 'pies', 'regatta']) assert.ok(!STORIES[id].needs(none), `${id} needs its building`);
  assert.ok(STORIES.fogboat.needs(kingdom('fog')) && !STORIES.fogboat.needs(kingdom('clear')), 'the boat in the fog only on foggy days');
  assert.ok(STORIES.regatta.needs(kingdom('clear')) && !STORIES.regatta.needs(kingdom('fog')) && !STORIES.regatta.needs(kingdom('rain')));
  assert.ok(STORIES.bell.needs(kingdom('clear', ['bell_foundry', 'chapel'])), 'the Chapel tower will do');
  // the ship keeps her name and cargo over the three days, a new crowd each day
  const ship = storyFor(kingdom(), 'ship'), unload = storyFor(kingdom(), 'ship:unload');
  assert.ok(ship.name && ship.from && ship.goods);
  assert.equal(unload.name, ship.name);
  assert.equal(unload.goods, ship.goods);
  assert.equal(unload.cast.length, 4);
  // the bell: the named bellfounder leads all three days
  const bell = storyFor(kingdom(), 'bell'), raise = storyFor(kingdom(), 'bell:raise');
  assert.equal(bell.founder.job, 'bellfounder');
  assert.equal(raise.founder.id, bell.founder.id);
  assert.ok(raise.cast.length > bell.cast.length, 'more hands on the rope');
  // the fisherman in the fog, the census count, a winner among the contestants and the rowers
  assert.equal(storyFor(kingdom('fog'), 'fogboat').fisher.job, 'fisherman');
  const census = storyFor(kingdom(), 'census');
  assert.equal(census.count, 4321);
  assert.equal(census.clerk.job, 'reeve');
  for (let d = 1; d <= 20; d++) {
    const s = { ...kingdom(), date: `2026-12-${String(d).padStart(2, '0')}` };
    const pies = storyFor(s, 'pies'), regatta = storyFor(s, 'regatta');
    assert.equal(pies.cast.length, 3);
    assert.ok(pies.cast.some((c) => c.id === pies.winner));
    assert.equal(regatta.rowers.length, 3);
    assert.ok(regatta.rowers.some((c) => c.id === regatta.winner));
    assert.ok(regatta.crowd.every((c) => !regatta.rowers.some((x) => x.id === c.id)), 'the crowd is not in the boats');
  }
  // every one of them is narrated, in both languages
  for (const [id, weather] of [['ship', 'clear'], ['ship:unload', 'clear'], ['ship:leave', 'clear'], ['bell', 'clear'], ['bell:cool', 'clear'], ['bell:raise', 'clear'], ['fogboat', 'fog'], ['census', 'clear'], ['pies', 'clear'], ['regatta', 'clear']]) {
    const s = kingdom(weather);
    const story = storyFor(s, id);
    for (const lang of ['en', 'it']) {
      const diff = { day: 40, from: 4300, to: 4321, delta: 21, added: [], removed: [], housesBuilt: [], housesRebuilt: [], housesReoccupied: [], housesAbandoned: [], housesRuined: [], unlocked: [], buildingsStarted: [], buildingsCompleted: [], events: [], weather, story, next: null };
      const lines = buildScript(s, diff, { lang }).sentences.filter((l) => l.role === 'story');
      assert.equal(lines.length, 1, `${id} (${lang}) has a story line`);
    }
  }
});

test('more story events of 2026-10-25: feast days on their date, the proclamation on a new goal, snow and teams when needed', async () => {
  const { pickStory, storyFor, STORIES } = await import('../src/sim/stories.js');
  const jobs = ['innkeeper', 'priest', 'fisherman', 'miller', 'guard', 'guard', 'farmer', 'peasant', 'crier', 'baker'];
  const kingdom = (date, weather = 'clear', extra = {}) => ({
    seed: SEED, date, day: 30, subscriberCount: 400, weather, storyLog: {}, unlockedTiers: ['hamlet', 'walled'],
    buildings: ['market', 'tavern', 'windmill', 'wall2'].map((id) => ({ id, status: 'done' })), houses: [],
    villagers: jobs.map((job, id) => ({ id, job })),
    names: Object.fromEntries(jobs.map((_, id) => [id, { name: `V${id}`, day: 1 + id }])), ...extra,
  });
  assert.equal(pickStory(kingdom('2026-11-11')).id, 'martinmas');
  const xmas = pickStory(kingdom('2026-12-24'));
  assert.equal(xmas.id, 'christmas');
  assert.equal(xmas.priest.job, 'priest', 'a named priest blesses them');
  assert.equal(storyFor(kingdom('2026-11-11'), 'martinmas').cast[0].job, 'innkeeper', 'a named innkeeper opens the barrel');
  // a new goal reached today: the crier proclaims it, before any other story
  const pr = pickStory(kingdom('2026-11-02'), { unlocked: ['walled'] });
  assert.equal(pr.id, 'proclaim');
  assert.equal(pr.title, 'Walled Town');
  assert.equal(pr.crier.job, 'crier');
  // never drawn on an ordinary day
  for (let d = 1; d <= 28; d++) assert.notEqual(pickStory(kingdom(`2026-11-${String(d).padStart(2, '0')}`))?.id, 'proclaim');
  // snowballs only on snowy days; the tug of war needs two named of each side and no rain or snow
  assert.ok(!STORIES.snowballs.needs(kingdom('2027-01-05')) && STORIES.snowballs.needs(kingdom('2027-01-05', 'snow')));
  assert.ok(STORIES.tugofwar.needs(kingdom('2026-11-05')) && !STORIES.tugofwar.needs(kingdom('2026-11-05', 'rain')));
  const tug = storyFor(kingdom('2026-11-05'), 'tugofwar');
  assert.ok(tug.guards.every((c) => c.job === 'guard') && tug.farmers.every((c) => ['farmer', 'peasant', 'shepherd'].includes(c.job)));
  assert.ok(['guards', 'farmers'].includes(tug.winner));
  // the big catch: the same fisherman on both days
  const fish = storyFor(kingdom('2026-11-05'), 'bigfish'), roast = storyFor(kingdom('2026-11-05'), 'bigfish:roast');
  assert.equal(fish.cast[0].job, 'fisherman');
  assert.equal(roast.cast[0].id, fish.cast[0].id);
  assert.equal(storyFor(kingdom('2026-11-05'), 'windmill').cast[0].job, 'miller');
  assert.ok(!STORIES.chicken.needs(kingdom('2026-11-05', 'clear', { buildings: [] })), 'no tavern, no hen in it');
});

test('comment words of 2026-10-25: typos and synonyms reach the jobs, six new jobs by request, ordinary words stay ordinary', async () => {
  const { wantsFromText } = await import('../src/sim/requests.js');
  const cases = {
    'I want to be a solider': 'guard', 'make me a soilder': 'guard', 'can I be a crusader': 'knight', 'reserve calvary': 'knight',
    'apocethary please': 'apothecary', 'homeless guy': 'beggar', 'vegetable seller': 'merchant', 'university professor': 'scholar',
    'newspaper seller': 'crier', 'announcer for the king': 'crier', 'craftsman': 'carpenter', 'a citizen': 'peasant', 'nitwit': 'jester',
    'teacher': 'teacher', 'philosopher': 'philosopher', 'barber': 'barber', 'astrologer': 'astronomer', 'stable keeper': 'stablehand', 'royal adviser': 'adviser',
  };
  for (const [text, job] of Object.entries(cases)) assert.deepEqual(wantsFromText(text), [job], text);
  for (const text of ['I go to school', '5 stars video', 'I love horses', 'good advice', 'nice shave']) assert.deepEqual(wantsFromText(text), [], text);
});

test('the would-be rebel (owner 2026-10-27): comments of overthrowing the king are spotted, the pillory at most once in 7 days', async () => {
  const { rebelFromText, wantsFromText } = await import('../src/sim/requests.js');
  for (const t of ['Can I start an organization or overthrow the king?', 'kill the king!!', 'down with the king', 'I will be the new king', 'VIVA LA REVOLUTION',
    'join the rebellion', 'abbasso il re', 'uccidere il re', 'steal the crown', 'dethrone his majesty']) assert.ok(rebelFromText(t), t);
  for (const t of ['long live the king', 'can I be a knight for the king?', 'I love this kingdom', 'my king please grant my wish', 'call me Violet', 'a coupon']) assert.ok(!rebelFromText(t), t);
  assert.deepEqual(wantsFromText('overthrow the king'), [], 'not a job request');
  const { pickStory, storyFor } = await import('../src/sim/stories.js');
  const jobs = ['executioner', 'farmer', 'guard', 'baker', 'peasant', 'merchant'];
  const kingdom = (day, extra = {}) => ({
    seed: SEED, date: `2026-11-${String(day).padStart(2, '0')}`, day, subscriberCount: 900, weather: 'clear', storyLog: {}, unlockedTiers: ['hamlet'],
    buildings: ['market', 'pillory'].map((id) => ({ id, status: 'done' })), houses: [], villagers: jobs.map((job, id) => ({ id, job })),
    names: Object.fromEntries(jobs.map((_, id) => [id, { name: `V${id}`, day: 1 }])), ...extra,
  });
  const k = kingdom(10);
  k.names[3].rebelDay = 9;
  const st = pickStory(k);
  assert.equal(st.id, 'rebel');
  assert.equal(st.rebel.id, 3, 'the rebel is in the pillory');
  assert.equal(st.executioner.job, 'executioner', 'a named executioner');
  assert.ok(st.throwers.every((c) => c.id !== 3 && c.id !== 0));
  assert.equal(k.names[3].pilloryDay, 10);
  // the next rebel waits until 7 days have passed; one already pilloried is not taken again
  for (let d = 11; d <= 16; d++) { k.day = d; k.date = `2026-11-${d}`; k.names[4].rebelDay = 11; assert.notEqual(pickStory(k)?.id, 'rebel', `day ${d}`); }
  k.day = 17; k.date = '2026-11-17'; k.storyArc = null; // (a story going on over several days comes first)
  const again = pickStory(k);
  assert.equal(again.id, 'rebel');
  assert.equal(again.rebel.id, 4);
  // no pillory, no rebel story; nobody waiting, never drawn
  const none = kingdom(10, { buildings: [{ id: 'market', status: 'done' }] });
  none.names[3].rebelDay = 9;
  assert.notEqual(pickStory(none)?.id, 'rebel');
  for (let d = 1; d <= 28; d++) assert.notEqual(pickStory(kingdom(d))?.id, 'rebel');
  assert.equal(storyFor(kingdom(10), 'rebel').id, 'rebel', 'test renders show one with nobody waiting');
  // a new commenter who talks of it is a rebel from the day they get their villager
  let s = genesis({ seed: SEED, date: '2026-09-30' });
  const r = advance(s, { subscribers: 30, date: '2026-10-01', commenters: [{ author: 'UCrebel0000000000000000a', name: 'Spartacus', at: '2026-10-01T01:00:00Z', rebel: true }] });
  const id = Object.keys(r.state.names).find((i) => r.state.names[i].name === 'Spartacus');
  assert.equal(r.state.names[id].rebelDay, r.state.day);
  assert.deepEqual(r.diff.rebels.map((x) => x.name), ['Spartacus']);
});
