// YouTube upload (Data API v3, videos.insert, resumable). Credentials come only from environment
// variables: YT_OAUTH_CLIENT_ID, YT_OAUTH_CLIENT_SECRET, YT_OAUTH_REFRESH_TOKEN (scopes youtube.upload, and
// youtube for adding the videos to the playlist YT_PLAYLIST_ID).
// A 1080x1920 clip of 30 s is classified as a Short by YouTube automatically.
import fs from 'node:fs';

export const UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';

export async function accessToken({ clientId, clientSecret, refreshToken, fetchImpl = fetch }) {
  if (!clientId || !clientSecret || !refreshToken) throw new Error('YT_OAUTH_CLIENT_ID / YT_OAUTH_CLIENT_SECRET / YT_OAUTH_REFRESH_TOKEN not set');
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`oauth token HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

/**
 * Next occurrence of "HH:MM" (UTC) at least 15 minutes after `now`, as RFC 3339, or undefined.
 */
export function publishAtFor(hhmm, now = new Date()) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return undefined;
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), +m[1], +m[2]));
  if (t - now < 15 * 60 * 1000) t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function videoResource({ title, description, tags, lang, privacy = 'public', publishAt }) {
  const status = { privacyStatus: publishAt ? 'private' : privacy, selfDeclaredMadeForKids: false, embeddable: true };
  if (publishAt) status.publishAt = publishAt;
  return {
    snippet: { title: title.slice(0, 100), description: description.slice(0, 5000), tags, categoryId: '24', defaultLanguage: lang, defaultAudioLanguage: lang },
    status,
  };
}

/**
 * Put a video in a playlist (YT_PLAYLIST_ID), unless it is there already. Scheduled (private) videos can
 * be added too: they show in the playlist once they go public. Needs the `youtube` scope on the refresh
 * token (`npm run auth:youtube`); with only `youtube.upload` YouTube answers 403.
 * Returns 'added' or 'present'.
 */
export async function addToPlaylist({ playlistId, videoId, token, fetchImpl = fetch }) {
  const auth = { authorization: `Bearer ${token}` };
  const q = new URLSearchParams({ part: 'id', playlistId, videoId, maxResults: '1' });
  const found = await fetchImpl(`https://www.googleapis.com/youtube/v3/playlistItems?${q}`, { headers: auth, signal: AbortSignal.timeout(20000) });
  if (!found.ok) throw new Error(playlistError('playlistItems.list', found.status, await found.text()));
  if ((await found.json()).items?.length) return 'present';
  const res = await fetchImpl('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(playlistError('playlistItems.insert', res.status, await res.text()));
  return 'added';
}

function playlistError(call, status, text) {
  const hint = status === 403 ? ' (the refresh token needs the youtube scope: run `npm run auth:youtube` again and update YT_OAUTH_REFRESH_TOKEN)' : '';
  return `${call} HTTP ${status}${hint}: ${text.slice(0, 200)}`;
}

/** Upload one MP4. Returns the video id. Retries transient (5xx / network) errors. */
export async function uploadVideo({ file, resource, token, fetchImpl = fetch, log = console, attempts = 4 }) {
  const bytes = fs.readFileSync(file);
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    if (i) await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
    try {
      const init = await fetchImpl('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json; charset=UTF-8',
          'x-upload-content-type': 'video/mp4',
          'x-upload-content-length': String(bytes.length),
        },
        body: JSON.stringify(resource),
        signal: AbortSignal.timeout(30000),
      });
      if (!init.ok) {
        const msg = `videos.insert init HTTP ${init.status}: ${(await init.text()).slice(0, 300)}`;
        if (init.status < 500) throw Object.assign(new Error(msg), { fatal: true });
        throw new Error(msg);
      }
      const location = init.headers.get('location');
      if (!location) throw new Error('videos.insert: no upload URL returned');
      const put = await fetchImpl(location, {
        method: 'PUT',
        headers: { 'content-type': 'video/mp4', 'content-length': String(bytes.length) },
        body: bytes,
        signal: AbortSignal.timeout(15 * 60 * 1000),
      });
      if (!put.ok) {
        const msg = `upload HTTP ${put.status}: ${(await put.text()).slice(0, 300)}`;
        if (put.status < 500) throw Object.assign(new Error(msg), { fatal: true });
        throw new Error(msg);
      }
      const body = await put.json();
      if (!body.id) throw new Error('upload: response without video id');
      return { id: body.id, privacy: body.status?.privacyStatus, uploadStatus: body.status?.uploadStatus };
    } catch (e) {
      lastErr = e;
      if (e.fatal) break;
      log.log(`[youtube] attempt ${i + 1} failed: ${e.message}`);
    }
  }
  throw lastErr;
}
