// Subscriber count sources. Keys and tokens come only from environment variables.
export const DEFAULT_HANDLE = '@Subscriber_Kingdom';

/** Google's error reason (e.g. "API_KEY_SERVICE_BLOCKED", "accessNotConfigured") for the log; never the key. */
async function googleReason(res) {
  try {
    const e = (await res.json()).error || {};
    const reason = e.details?.find((d) => d.reason)?.reason || e.errors?.[0]?.reason || e.status || '';
    return ` (${[reason, (e.message || '').replace(/key=[^&\s]+/g, 'key=***').slice(0, 200)].filter(Boolean).join(': ')})`;
  } catch { return ''; }
}

/**
 * Public count via YouTube Data API v3 (channels.list, part=statistics, forHandle).
 * Above 1,000 subscribers YouTube rounds this to 3 significant figures.
 */
export async function fetchPublicCount({ apiKey, handle = DEFAULT_HANDLE, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set');
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.search = new URLSearchParams({ part: 'statistics', forHandle: handle, key: apiKey });
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`channels.list HTTP ${res.status}${await googleReason(res)}`);
  const body = await res.json();
  const stats = body.items?.[0]?.statistics;
  if (!stats) throw new Error(`channel ${handle} not found`);
  if (stats.hiddenSubscriberCount) throw new Error('subscriber count is hidden on this channel');
  const n = Number(stats.subscriberCount);
  if (!Number.isFinite(n) || n < 0) throw new Error('bad subscriberCount in response');
  return n;
}

/**
 * Exact count for your own channel via the YouTube Analytics API (OAuth refresh token):
 * sum of subscribersGained - subscribersLost since the channel was created.
 * Analytics data lags by ~2-3 days; EXACT_COUNT_OFFSET can correct a known difference.
 */
export async function fetchExactCount({ clientId, clientSecret, refreshToken, since = '2005-02-14', today, offset = 0, fetchImpl = fetch }) {
  if (!clientId || !clientSecret || !refreshToken) throw new Error('YT_OAUTH_CLIENT_ID / YT_OAUTH_CLIENT_SECRET / YT_OAUTH_REFRESH_TOKEN not set');
  const tok = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(20000),
  });
  if (!tok.ok) throw new Error(`oauth token HTTP ${tok.status}`);
  const { access_token } = await tok.json();
  const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
  url.search = new URLSearchParams({
    ids: 'channel==MINE', startDate: since, endDate: today ?? new Date().toISOString().slice(0, 10),
    metrics: 'subscribersGained,subscribersLost',
  });
  const res = await fetchImpl(url, { headers: { authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`analytics reports HTTP ${res.status}${await googleReason(res)}`);
  const body = await res.json();
  const cols = (body.columnHeaders || []).map((c) => c.name);
  const gi = cols.indexOf('subscribersGained'), li = cols.indexOf('subscribersLost');
  if (gi < 0 || li < 0) throw new Error('analytics response missing subscriber columns');
  let total = 0;
  for (const row of body.rows || []) total += Number(row[gi]) - Number(row[li]);
  return Math.max(0, total + Number(offset || 0));
}

/**
 * Resolve today's count. Never throws: on any failure it logs and returns the last known count.
 * @returns {Promise<{count:number, source:string, error?:string}>}
 */
export async function getSubscriberCount({ override, mode = process.env.COUNT_MODE || 'public', env = process.env, lastKnown = 0, log = console, fetchImpl = fetch, today } = {}) {
  if (override !== undefined && override !== null) return { count: Number(override), source: 'override' };
  try {
    if (mode === 'exact') {
      const count = await fetchExactCount({
        clientId: env.YT_OAUTH_CLIENT_ID, clientSecret: env.YT_OAUTH_CLIENT_SECRET, refreshToken: env.YT_OAUTH_REFRESH_TOKEN,
        offset: env.EXACT_COUNT_OFFSET, today, fetchImpl,
      });
      return { count, source: 'analytics' };
    }
    const count = await fetchPublicCount({ apiKey: env.YOUTUBE_API_KEY, handle: env.YOUTUBE_HANDLE || DEFAULT_HANDLE, fetchImpl });
    return { count, source: 'public' };
  } catch (e) {
    log.error?.(`[fetch] ${mode} count failed: ${e.message}. Reusing last known count ${lastKnown}.`);
    return { count: lastKnown, source: 'fallback', error: e.message };
  }
}
