// Commenters for villager names: public comment threads on the channel's videos (YouTube Data API v3,
// commentThreads.list with the same API key as the subscriber count). Never throws.
import { DEFAULT_HANDLE } from './youtube.js';

const API = 'https://www.googleapis.com/youtube/v3';

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url.pathname.split('/').pop()} HTTP ${res.status}`);
  return res.json();
}

/**
 * New commenters since `since` (ISO time), oldest first: [{ author, name, at }].
 * Only top-level comments count; the channel's own comments are skipped. At most `pages` x 100 threads.
 */
export async function fetchCommenters({ apiKey, handle = DEFAULT_HANDLE, channelId, since = null, pages = 5, fetchImpl = fetch, log = console }) {
  try {
    if (!apiKey) throw new Error('YOUTUBE_API_KEY is not set');
    if (!channelId) {
      const u = new URL(`${API}/channels`);
      u.search = new URLSearchParams({ part: 'id', forHandle: handle, key: apiKey });
      channelId = (await getJson(u, fetchImpl)).items?.[0]?.id;
      if (!channelId) throw new Error(`channel ${handle} not found`);
    }
    const out = [];
    let pageToken = '';
    for (let p = 0; p < pages; p++) {
      const u = new URL(`${API}/commentThreads`);
      u.search = new URLSearchParams({ part: 'snippet', allThreadsRelatedToChannelId: channelId, order: 'time', maxResults: '100', textFormat: 'plainText', key: apiKey, ...(pageToken ? { pageToken } : {}) });
      const body = await getJson(u, fetchImpl);
      let older = false;
      for (const th of body.items || []) {
        const c = th.snippet?.topLevelComment?.snippet;
        if (!c) continue;
        const at = c.publishedAt;
        if (since && at <= since) { older = true; continue; }
        const author = c.authorChannelId?.value;
        if (!author || author === channelId) continue;
        out.push({ author, name: c.authorDisplayName, at });
      }
      pageToken = body.nextPageToken;
      if (older || !pageToken) break;
    }
    return out.sort((a, b) => a.at.localeCompare(b.at));
  } catch (e) {
    log.log(`[names] could not read comments: ${e.message}`);
    return [];
  }
}
