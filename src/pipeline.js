// The daily cycle and test renders, shared by scripts/daily.js and scripts/render.js.
import fs from 'node:fs';
import path from 'node:path';
import { genesis, advance } from './sim/simulate.js';
import { baseStateFor, saveDay, lastKnownCount, STATE_DIR } from './sim/state.js';
import { getSubscriberCount } from './fetch/youtube.js';
import { buildScript } from './audio/narration.js';
import { synthesize, captionPhrases } from './audio/tts/index.js';
import { mixSoundtrack, VOICE_DELAY } from './audio/mix.js';
import { renderVideo, renderStills } from './render/capture.js';
import { publish } from './publish/index.js';

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function parseArgs(argv) {
  const a = { lang: 'en' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--subs') a.subs = Number(v());
    else if (k === '--from') a.from = Number(v());
    else if (k === '--date') a.date = v();
    else if (k === '--lang') a.lang = v();
    else if (k === '--out') a.out = v();
    else if (k === '--quality') a.quality = v();
    else if (k === '--tts') a.tts = v();
    else if (k === '--seed') a.seed = Number(v());
    else if (k === '--dry-run') a.dryRun = true;
    else if (k === '--no-video') a.noVideo = true;
    else if (k === '--stills') a.stills = v() || '1,10,25';
    else if (k === '--state-dir') a.stateDir = v();
    else throw new Error(`unknown option ${k}`);
  }
  if (a.lang !== 'en' && a.lang !== 'it') throw new Error('--lang must be en or it');
  return a;
}

export function summarizeDiff(diff) {
  const pick = (k) => (Array.isArray(diff[k]) ? diff[k].length : diff[k]);
  return {
    date: diff.date, day: diff.day, from: diff.from, to: diff.to, delta: diff.delta,
    added: pick('added'), removed: pick('removed'), housesBuilt: pick('housesBuilt'), housesRebuilt: pick('housesRebuilt'),
    housesReoccupied: pick('housesReoccupied'), housesAbandoned: pick('housesAbandoned'), housesRuined: pick('housesRuined'),
    unlocked: diff.unlocked, buildingsStarted: diff.buildingsStarted, buildingsCompleted: diff.buildingsCompleted,
    weather: diff.weather, events: diff.events.map((e) => e.type + (e.name ? `:${e.name}` : '')), next: diff.next,
    newcomers: diff.added.slice(0, 5).map((v) => `${v.name} (${v.job})`),
  };
}

/** Narration -> TTS -> captions -> soundtrack -> frames -> MP4. */
export async function produceVideo(state, diff, { lang = 'en', out, quality, tts, log = console, workDir } = {}) {
  const dir = workDir || path.join('.cache', 'work', `${state.date}_${lang}_${state.subscriberCount}`);
  fs.mkdirSync(dir, { recursive: true });
  const script = buildScript(state, diff, { lang });
  log.log(`[audio] script (${script.words} words): ${script.text}`);
  const voice = await synthesize(script.sentences, { lang, outDir: dir, provider: tts, log });
  log.log(`[audio] ${voice.provider} narration ${voice.duration.toFixed(2)} s`);
  const captions = captionPhrases(voice.words, VOICE_DELAY);
  const soundtrack = mixSoundtrack({
    narration: voice.file, outDir: dir, seed: state.seed, date: state.date, weather: diff.weather,
    construction: diff.housesBuilt.length + diff.buildingsStarted.length + state.pendingConstruction.length > 0,
    crowd: Math.min(1, 0.2 + state.subscriberCount / 300),
  });
  const data = { mode: 'video', state, diff, lang, captions, quality };
  const result = await renderVideo(data, out, { audioFile: soundtrack, log });
  if (result.errors.length) log.error(`[render] browser console errors: ${result.errors.join(' | ')}`);
  fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify({ date: state.date, subscribers: state.subscriberCount, lang, script: script.text, tts: voice.provider, captions, stats: result.stats, renderSeconds: result.seconds }, null, 1));
  return { out, script, voice, result };
}

/** Build a two-day test kingdom ending at `subs` (default start: ~88% of it), without touching state/. */
export function testKingdom({ subs, from, date = today(), seed }) {
  const start = from ?? Math.max(0, Math.round(subs * 0.88) - (subs > 1 ? 1 : 0));
  const d0 = new Date(Date.parse(date) - 2 * 86400000).toISOString().slice(0, 10);
  const d1 = new Date(Date.parse(date) - 86400000).toISOString().slice(0, 10);
  let s = genesis({ seed, date: d0 });
  s = advance(s, { subscribers: start, date: d1, source: 'test' }).state;
  return advance(s, { subscribers: subs, date, source: 'test' });
}

export async function daily(args, log = console) {
  const date = args.date || today();
  const dir = args.stateDir || STATE_DIR;
  const { count, source, error } = await getSubscriberCount({ override: args.subs, lastKnown: lastKnownCount({ dir }), log });
  log.log(`[fetch] ${count} subscribers (${source})${error ? ` — ${error}` : ''}`);
  const base = baseStateFor(date, { dir, seed: args.seed });
  const { state, diff } = advance(base, { subscribers: count, date, source });
  log.log('[sim] ' + JSON.stringify(summarizeDiff(diff), null, 1));
  if (args.dryRun) return { state, diff, saved: false };
  saveDay(state, diff, { dir });
  log.log(`[state] saved day ${state.day} (${date}) to ${dir}`);
  if (args.noVideo) return { state, diff, saved: true };
  const out = args.out || path.join('output', `${date}_${args.lang}.mp4`);
  const video = await produceVideo(state, diff, { lang: args.lang, out, quality: args.quality, tts: args.tts, log });
  await publish({ video: out, state, diff, script: video.script.text, lang: args.lang, log });
  return { state, diff, saved: true, video: out };
}

export async function testRender(args, log = console) {
  if (!Number.isFinite(args.subs)) throw new Error('--subs N is required');
  const { state, diff } = testKingdom({ subs: args.subs, from: args.from, date: args.date, seed: args.seed });
  log.log('[sim] ' + JSON.stringify(summarizeDiff(diff)));
  if (args.stills) {
    const times = args.stills.split(',').map(Number);
    const r = await renderStills({ mode: 'video', state, diff, lang: args.lang, quality: args.quality }, times, path.join('output', `stills_${args.subs}`));
    log.log(r.files.join('\n'));
    return r;
  }
  const out = args.out || path.join('output', `test_${args.subs}_${args.lang}.mp4`);
  return produceVideo(state, diff, { lang: args.lang, out, quality: args.quality, tts: args.tts, log });
}
