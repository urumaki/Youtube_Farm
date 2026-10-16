// Publishing the daily video. PUBLISH_TARGETS=youtube uploads it as a Short (see youtube.js);
// otherwise only the title/description metadata is written next to the video.
// Uploads are recorded in state/published.json so a re-run of the same day never uploads twice.
// A failed upload is logged and never fails the daily cycle (the state is already saved).
import fs from 'node:fs';
import path from 'node:path';
import { accessToken, publishAtFor, uploadVideo, videoResource } from './youtube.js';

export function metadata({ state, diff, lang }) {
  const d = diff.delta;
  const title = lang === 'it'
    ? `Giorno ${state.day}: ${d >= 0 ? '+' : ''}${d} abitanti — ${state.subscriberCount} nel regno 👑 #shorts`
    : `Day ${state.day}: ${d >= 0 ? '+' : ''}${d} villagers — ${state.subscriberCount} in the kingdom 👑 #shorts`;
  const description = lang === 'it'
    ? 'Ogni iscritto è un abitante di Subscriber Kingdom. Iscriviti per avere la tua casa!\n#subscriberkingdom #medieval #shorts'
    : 'Every subscriber is one villager of Subscriber Kingdom. Subscribe to move in!\n#subscriberkingdom #medieval #shorts';
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
    if (ledger[key]?.youtube) { log.log(`[publish] youtube: ${key} already uploaded (${ledger[key].youtube})`); continue; }
    try {
      const token = await accessToken({ clientId: env.YT_OAUTH_CLIENT_ID, clientSecret: env.YT_OAUTH_CLIENT_SECRET, refreshToken: env.YT_OAUTH_REFRESH_TOKEN, fetchImpl });
      const publishAt = publishAtFor(env.YT_PUBLISH_AT, now);
      const resource = videoResource({ ...meta, lang, privacy: env.YT_PRIVACY || 'public', publishAt });
      const r = await uploadVideo({ file: video, resource, token, fetchImpl, log });
      log.log(`[publish] youtube: https://youtube.com/shorts/${r.id} (${r.privacy}${publishAt ? `, goes public ${publishAt}` : ''})`);
      ledger[key] = { ...ledger[key], youtube: r.id, uploadedAt: now.toISOString() };
      fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1) + '\n');
      results.youtube = r.id;
    } catch (e) {
      log.error(`[publish] youtube upload failed: ${e.message}`);
    }
  }
  return results;
}
