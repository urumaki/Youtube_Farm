// Commenters for villager names: public comment threads on the channel's videos (YouTube Data API v3,
// commentThreads.list with the same API key as the subscriber count). Never throws.
import { DEFAULT_HANDLE } from './youtube.js';
import { wantsFromText, nameFromText, complainsFromText, rebelFromText, joinFromText, plainText } from '../sim/requests.js';

const API = 'https://www.googleapis.com/youtube/v3';
// Everything in a comment is untrusted: the author id and time are checked for their shape, the display name
// is cut short here and cleaned in names.js, the text only goes through plainText() and the keyword regexes.
const AUTHOR_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url.pathname.split('/').pop()} HTTP ${res.status}`);
  return res.json();
}

/**
 * Commenters since `since` (ISO time), oldest first: [{ author, name, at, wants, call?, complains? }] (wants:
 * requested jobs, call: the name they asked for, complains: they could not find themselves in the video, rebel: they talk of
 * overthrowing the king, join: they enter the games at the Tournament Ground).
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
        if (typeof at !== 'string' || !TIME_RE.test(at)) continue;
        if (since && at <= since) { older = true; continue; }
        const author = c.authorChannelId?.value;
        if (typeof author !== 'string' || !AUTHOR_RE.test(author) || author === channelId) continue;
        // the text is only scanned for a job request and a chosen name here, and never kept
        const text = plainText(c.textOriginal ?? c.textDisplay);
        const call = nameFromText(text);
        const complains = complainsFromText(text), rebel = rebelFromText(text), join = joinFromText(text);
        out.push({ author, name: String(c.authorDisplayName ?? '').slice(0, 100), at, wants: wantsFromText(text), ...(call ? { call } : {}), ...(complains ? { complains } : {}), ...(rebel ? { rebel } : {}), ...(join ? { join } : {}) });
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
