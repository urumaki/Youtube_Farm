import test from 'node:test';
import assert from 'node:assert/strict';
import { getSubscriberCount, fetchPublicCount } from '../src/fetch/youtube.js';

const json = (body, status = 200) => async () => ({ ok: status < 400, status, json: async () => body });
const quiet = { error() {} };

test('public mode reads statistics.subscriberCount by handle', async () => {
  let seen;
  const fetchImpl = async (url) => { seen = String(url); return json({ items: [{ statistics: { subscriberCount: '1230' } }] })(); };
  const r = await getSubscriberCount({ env: { YOUTUBE_API_KEY: 'k' }, fetchImpl, log: quiet });
  assert.deepEqual(r, { count: 1230, source: 'public' });
  assert.match(seen, /forHandle=%40Subscriber_Kingdom/);
  assert.match(seen, /part=statistics/);
});

test('failures fall back to the last known count without throwing', async () => {
  for (const fetchImpl of [json({}, 500), json({ items: [] }), async () => { throw new Error('offline'); }]) {
    const r = await getSubscriberCount({ env: { YOUTUBE_API_KEY: 'k' }, fetchImpl, lastKnown: 77, log: quiet });
    assert.equal(r.count, 77);
    assert.equal(r.source, 'fallback');
    assert.ok(r.error);
  }
  const noKey = await getSubscriberCount({ env: {}, lastKnown: 5, log: quiet, fetchImpl: json({}) });
  assert.equal(noKey.source, 'fallback');
  await assert.rejects(fetchPublicCount({ apiKey: 'k', fetchImpl: json({ items: [{ statistics: { hiddenSubscriberCount: true } }] }) }), /hidden/);
});

test('exact mode sums gained minus lost from the Analytics API', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('oauth2')) return json({ access_token: 't' })();
    return json({ columnHeaders: [{ name: 'subscribersGained' }, { name: 'subscribersLost' }], rows: [[1500, 260]] })();
  };
  const env = { YT_OAUTH_CLIENT_ID: 'a', YT_OAUTH_CLIENT_SECRET: 'b', YT_OAUTH_REFRESH_TOKEN: 'c', EXACT_COUNT_OFFSET: '3' };
  assert.deepEqual(await getSubscriberCount({ mode: 'exact', env, fetchImpl, log: quiet }), { count: 1243, source: 'analytics' });
});

test('--subs override wins', async () => {
  assert.deepEqual(await getSubscriberCount({ override: 12, fetchImpl: json({}, 500) }), { count: 12, source: 'override' });
});

test('commenters: new top-level authors since the last run, oldest first, channel owner skipped', async () => {
  const { fetchCommenters } = await import('../src/fetch/comments.js');
  const th = (author, name, at) => ({ snippet: { topLevelComment: { snippet: { authorChannelId: { value: author }, authorDisplayName: name, publishedAt: at } } } });
  const fetchImpl = async (url) => {
    const u = String(url);
    if (u.includes('/channels')) return new Response(JSON.stringify({ items: [{ id: 'UCown' }] }));
    if (u.includes('/commentThreads')) return new Response(JSON.stringify({ items: [th('UCb', '@Bea', '2026-10-17T10:00:00Z'), th('UCown', '@Me', '2026-10-17T09:00:00Z'), th('UCa', '@Al', '2026-10-16T12:00:00Z'), th('UCold', '@Old', '2026-10-15T00:00:00Z')] }));
    return new Response('{}', { status: 404 });
  };
  const r = await fetchCommenters({ apiKey: 'k', since: '2026-10-15T12:00:00Z', fetchImpl, log: { log() {} } });
  assert.deepEqual(r.map((c) => c.name), ['@Al', '@Bea']);
  assert.deepEqual(await fetchCommenters({ apiKey: '', log: { log() {} } }), []);
});

test('commenters: author ids and times of the wrong shape are skipped, display names cut short', async () => {
  const { fetchCommenters } = await import('../src/fetch/comments.js');
  const th = (author, name, at, text = '') => ({ snippet: { topLevelComment: { snippet: { authorChannelId: { value: author }, authorDisplayName: name, publishedAt: at, textOriginal: text } } } });
  const items = [th('UC"; rm -rf', '@X', '2026-10-17T10:00:00Z'), th('UCok', '@Y', '2026-10-17; DROP'), th({ $ne: 1 }, '@Z', '2026-10-17T10:00:00Z'),
    th('UCgood', 'N'.repeat(5000), '2026-10-17T11:00:00Z', 'make me a bl​acksmith')];
  const fetchImpl = async (url) => new Response(JSON.stringify(String(url).includes('/channels') ? { items: [{ id: 'UCown' }] } : { items }));
  const r = await fetchCommenters({ apiKey: 'k', fetchImpl, log: { log() {} } });
  assert.deepEqual(r.map((c) => c.author), ['UCgood']);
  assert.equal(r[0].name.length, 100);
  assert.deepEqual(r[0].wants, ['blacksmith']);
});
