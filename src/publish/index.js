// Publishing the daily video. PUBLISH_TARGETS=youtube uploads it as a Short (see youtube.js);
// otherwise only the title/description metadata is written next to the video.
// Uploads are recorded in state/published.json so a re-run of the same day never uploads twice.
// A failed upload is logged and never fails the daily cycle (the state is already saved).
import fs from 'node:fs';
import path from 'node:path';
import { accessToken, addToPlaylist, publishAtFor, uploadVideo, videoResource } from './youtube.js';

// Owner (2026-10-20): at most 5 hashtags per video, title and description together, none repeated.
// Usual advice for Shorts: #shorts once as the format tag (in the title), then the channel's own tag and a
// few niche ones; the first hashtags of the description show as links above the title.
export const MAX_HASHTAGS = 5;
const DESCRIPTION_TAGS = { en: '#subscriberkingdom #medieval #citybuilder #castle', it: '#subscriberkingdom #medioevo #citybuilder #castello' };

export function metadata({ state, diff, lang }) {
  const d = diff.delta;
  const title = lang === 'it'
    ? `Giorno ${state.day}: ${d >= 0 ? '+' : ''}${d} abitanti — ${state.subscriberCount} nel regno 👑 #shorts`
    : `Day ${state.day}: ${d >= 0 ? '+' : ''}${d} villagers — ${state.subscriberCount} in the kingdom 👑 #shorts`;
  const description = lang === 'it'
    ? `Ogni iscritto è un abitante di Subscriber Kingdom. Iscriviti per avere la tua casa!\n${DESCRIPTION_TAGS.it}`
    : `Every subscriber is one villager of Subscriber Kingdom. Subscribe to move in!\n${DESCRIPTION_TAGS.en}`;
  return { title, description, tags: ['subscriber kingdom', 'medieval', 'kingdom builder', 'castle', 'shorts'] };
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

export async function publish({ video, state, diff, lang, log = console, env = process.env, stateDir = 'state', fetchImpl = fetch, now = new Date() }) {
  const meta = metadata({ state, diff, lang });
  fs.writeFileSync(video.replace(/\.mp4$/, '.publish.json'), JSON.stringify({ video, ...meta }, null, 1));
  const targets = (env.PUBLISH_TARGETS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!targets.length) { log.log('[publish] skipped (PUBLISH_TARGETS not set; metadata written next to the video)'); return {}; }
  const results = {};
  for (const t of targets) {
    if (t !== 'youtube') { log.log(`[publish] target "${t}" is not implemented`); continue; }
    const ledgerFile = path.join(stateDir, 'published.json');
    const ledger = readJson(ledgerFile);
    const key = `${state.date}_${lang}`;
    const save = () => { fs.mkdirSync(stateDir, { recursive: true }); fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1) + '\n'); };
    let token = null;
    const getToken = async () => (token ??= await accessToken({ clientId: env.YT_OAUTH_CLIENT_ID, clientSecret: env.YT_OAUTH_CLIENT_SECRET, refreshToken: env.YT_OAUTH_REFRESH_TOKEN, fetchImpl }));
    if (ledger[key]?.youtube) log.log(`[publish] youtube: ${key} already uploaded (${ledger[key].youtube})`);
    else {
      try {
        const publishAt = publishAtFor(env.YT_PUBLISH_AT, now);
        const resource = videoResource({ ...meta, lang, privacy: env.YT_PRIVACY || 'public', publishAt });
        const r = await uploadVideo({ file: video, resource, token: await getToken(), fetchImpl, log });
        log.log(`[publish] youtube: https://youtube.com/shorts/${r.id} (${r.privacy}${publishAt ? `, goes public ${publishAt}` : ''})`);
        ledger[key] = { ...ledger[key], youtube: r.id, uploadedAt: now.toISOString() };
        save();
        results.youtube = r.id;
      } catch (e) {
        log.error(`[publish] youtube upload failed: ${e.message}`);
      }
    }
    // the playlist (owner 2026-10-20): today's video, and any recent upload not added yet (a run that
    // failed to add it, or one from before the playlist); never fails the daily cycle
    const playlistId = env.YT_PLAYLIST_ID;
    if (!playlistId) continue;
    const pending = Object.keys(ledger).filter((k) => ledger[k].youtube && ledger[k].playlist !== playlistId).sort().slice(-10);
    for (const k of pending) {
      try {
        const how = await addToPlaylist({ playlistId, videoId: ledger[k].youtube, token: await getToken(), fetchImpl });
        log.log(`[publish] playlist: ${k} ${how}`);
        ledger[k].playlist = playlistId;
        save();
        if (k === key) results.playlist = how;
      } catch (e) {
        log.error(`[publish] playlist: ${k} not added: ${e.message}`);
        break; // the same error would repeat for the others
      }
    }
  }
  return results;
}
