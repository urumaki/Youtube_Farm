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
