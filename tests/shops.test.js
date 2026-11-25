// Shops (owner 2026-11-25): several per trade, a number of workers each that fits the trade, on the houses of their villagers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { shopsOf, shopOf, SHOP_SIZE } from '../src/sim/shops.js';
import { migrate } from '../src/sim/state.js';

// villagers: [job, house] by index; houses: { id: status }
function kingdom(villagers, statuses = {}) {
  const houses = {};
  villagers.forEach(([, h], id) => { (houses[h] ??= { id: h, status: statuses[h] ?? 'occupied', occupants: [] }).occupants.push(id); });
  return { subscriberCount: villagers.length, villagers: villagers.map(([job, house], id) => ({ id, job, house })), houses: Object.values(houses) };
}

test('groups by size, in index order', () => {
  const s = kingdom(Array.from({ length: 11 }, (_, i) => ['carpenter', 100 + i]));
  const shops = shopsOf(s).filter((x) => x.job === 'carpenter');
  assert.deepEqual(shops.map((x) => x.members), [[0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10]]);
});

test("a shop is on its first member's house", () => {
  const s = kingdom([['cook', 7], ['cook', 8], ['cook', 9], ['cook', 4]]);
  assert.deepEqual(shopsOf(s).map((x) => [x.k, x.house]), [[0, 7], [1, 4]]);
});

test('two shops never share a house', () => {
  // a carpenter and a cook live in house 1; both lead a group; the cook's shop goes to the next cook's house
  const s = kingdom([['carpenter', 1], ['cook', 1], ['cook', 2]]);
  const by = Object.fromEntries(shopsOf(s).map((x) => [x.job, x.house]));
  assert.equal(by.carpenter, 1);
  assert.equal(by.cook, 2);
});

test('a ruined or abandoned house passes the shop on', () => {
  const s = kingdom([['barber', 1], ['barber', 2]], { 1: 'ruin' });
  assert.equal(shopsOf(s).find((x) => x.k === 0), undefined, 'the first barber (size 1) has no house to work at');
  assert.equal(shopsOf(s).find((x) => x.k === 1).house, 2);
  const t = kingdom([['carpenter', 1], ['carpenter', 2]], { 1: 'abandoned' });
  assert.equal(shopsOf(t)[0].house, 2);
});

test('the first tax group works at the Counting House', () => {
  const s = kingdom(Array.from({ length: 6 }, (_, i) => ['taxcollector', 10 + i]));
  assert.deepEqual(shopsOf(s).map((x) => x.house), ['counting_house', 14]);
});

test('shopOf follows the scene', () => {
  const s = kingdom([['cook', 3], ['carpenter', 4]]);
  assert.equal(shopOf(s, 0, 'stall'), null);
  assert.deepEqual(shopOf(s, 0, 'cauldron'), { job: 'cook', k: 0, house: 3 });
  assert.deepEqual(shopOf(s, 1, 'saw'), { job: 'carpenter', k: 0, house: 4 });
  assert.equal(shopOf(s, 1, 'cart'), null, 'the carpenter with the cart is out on the road');
});

test('the real kingdom: one shop for every SHOP_SIZE villagers of a trade', () => {
  const s = migrate(JSON.parse(fs.readFileSync('state/kingdom.json', 'utf8')));
  const count = (job) => s.villagers.slice(0, s.subscriberCount).filter((v) => v.job === job).length;
  const shops = shopsOf(s);
  for (const job of Object.keys(SHOP_SIZE)) {
    const n = shops.filter((x) => x.job === job).length;
    assert.ok(n <= Math.ceil(count(job) / SHOP_SIZE[job]) && n >= Math.ceil(count(job) / SHOP_SIZE[job]) - 1, `${job}: ${n} shops for ${count(job)}`);
  }
  const houses = shops.map((x) => x.house).filter((h) => typeof h === 'number');
  assert.equal(new Set(houses).size, houses.length, 'one shop a house');
});

test('every kind of shop front builds with a counter', async () => {
  const { shopFront, SHOP_KINDS } = await import('../src/render/scene/shopfronts.js');
  const { fakeMaterials } = await import('./helpers/scene.js');
  const M = fakeMaterials();
  for (const kind of [...SHOP_KINDS, 'nothing']) {
    const g = shopFront(kind, M);
    assert.ok(g.userData.counter?.isVector3, `${kind}: a counter`);
    assert.equal(g.userData.kind, kind);
  }
  assert.ok(SHOP_KINDS.includes('weaver') && SHOP_KINDS.length === 6);
  const tax = shopFront('taxcollector', M);
  assert.equal(tax.userData.guards.length, 2);
  assert.equal(tax.children.filter((c) => c.type === 'Group').length, 2, 'two guards stand at the counter');
});

test('the tax queue brings coin sacks to the counter and walks off', async () => {
  const { buildQueue } = await import('../src/render/scene/queue.js');
  const { fakeMaterials } = await import('./helpers/scene.js');
  const q = buildQueue('tax', { M: fakeMaterials(), seed: 7, id: 1 });
  const sacks = [];
  q.group.traverse((o) => { if (o.name === 'coinSack') sacks.push(o); });
  assert.ok(sacks.length >= 4, `${sacks.length} coin sacks`);
  // over a few seconds a sack comes to rest on the counter, and the first in line walks away along the front
  let onCounter = false, gone = false;
  const first = q.people[0].P.root;
  for (let t = 0; t < 8; t += 0.05) {
    q.update(t);
    if (q.counterSack.visible) onCounter = true;
    if (Math.abs(first.position.x) > 1.5) gone = true;
  }
  assert.ok(onCounter, 'a sack left on the counter');
  assert.ok(gone, 'the taxpayer walks off');
});
