import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { publish } from '../src/publish/index.js';
import { publishAtFor, videoResource } from '../src/publish/youtube.js';

function mockFetch(calls) {
  return async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    if (u.includes('oauth2.googleapis.com/token')) return new Response(JSON.stringify({ access_token: 'AT' }), { status: 200 });
    if (u.includes('uploadType=resumable')) return new Response('', { status: 200, headers: { location: 'https://upload.example/session1' } });
    if (u === 'https://upload.example/session1') return new Response(JSON.stringify({ id: 'vid123', status: { privacyStatus: 'public', uploadStatus: 'uploaded' } }), { status: 200 });
    return new Response('nope', { status: 404 });
  };
}

const quiet = { log() {}, error() {} };
const sample = () => ({ state: { day: 3, date: '2026-10-16', subscriberCount: 87 }, diff: { delta: 11 } });

test('publish uploads to YouTube once per day and language', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-'));
  const video = path.join(dir, 'v.mp4');
  fs.writeFileSync(video, Buffer.alloc(1024));
  const env = { PUBLISH_TARGETS: 'youtube', YT_OAUTH_CLIENT_ID: 'id', YT_OAUTH_CLIENT_SECRET: 'sec', YT_OAUTH_REFRESH_TOKEN: 'rt' };
  const calls = [];
  const r = await publish({ video, ...sample(), lang: 'en', env, stateDir: dir, fetchImpl: mockFetch(calls), log: quiet });
  assert.equal(r.youtube, 'vid123');
  const init = calls.find((c) => c.url.includes('uploadType=resumable'));
  const res = JSON.parse(init.init.body);
  assert.match(res.snippet.title, /#shorts/);
  assert.equal(res.status.privacyStatus, 'public');
  assert.equal(res.status.selfDeclaredMadeForKids, false);
  assert.equal(init.init.headers.authorization, 'Bearer AT');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'published.json'), 'utf8'))['2026-10-16_en'].youtube, 'vid123');
  const again = [];
  await publish({ video, ...sample(), lang: 'en', env, stateDir: dir, fetchImpl: mockFetch(again), log: quiet });
  assert.equal(again.length, 0, 'second run must not upload again');
});

test('publish never throws when credentials are missing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pub-'));
  const video = path.join(dir, 'v.mp4');
  fs.writeFileSync(video, Buffer.alloc(10));
  const r = await publish({ video, ...sample(), lang: 'en', env: { PUBLISH_TARGETS: 'youtube' }, stateDir: dir, fetchImpl: mockFetch([]), log: quiet });
  assert.deepEqual(r, {});
  assert.ok(!fs.existsSync(path.join(dir, 'published.json')));
});

test('scheduled publishing time', () => {
  const now = new Date('2026-10-16T06:30:00Z');
  assert.equal(publishAtFor('17:00', now), '2026-10-16T17:00:00Z');
  assert.equal(publishAtFor('06:40', now), '2026-10-17T06:40:00Z');
  assert.equal(publishAtFor('', now), undefined);
  const r = videoResource({ title: 'x', description: 'y', tags: [], lang: 'en', publishAt: '2026-10-16T17:00:00Z' });
  assert.equal(r.status.privacyStatus, 'private');
  assert.equal(r.status.publishAt, '2026-10-16T17:00:00Z');
});
