// Extension point for uploading the daily video (YouTube / Instagram / TikTok).
// Uploading is out of scope for now: this logs what would be published and writes a metadata file.
// To add an uploader, implement it here (or call legacy/uploaders/*.py) and keep all keys in env vars.
import fs from 'node:fs';

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

export async function publish({ video, state, diff, lang, log = console }) {
  const meta = metadata({ state, diff, lang });
  fs.writeFileSync(video.replace(/\.mp4$/, '.publish.json'), JSON.stringify({ video, ...meta }, null, 1));
  if (process.env.PUBLISH_TARGETS) log.log(`[publish] targets "${process.env.PUBLISH_TARGETS}" requested, but no uploader is implemented yet`);
  else log.log('[publish] skipped (uploading not implemented; metadata written next to the video)');
}
