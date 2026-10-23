// The daily cycle and test renders, shared by scripts/daily.js and scripts/render.js.
import fs from 'node:fs';
import path from 'node:path';
import { genesis, advance } from './sim/simulate.js';
import { storyFor } from './sim/stories.js';
import { pickFeatured, shownJobs } from './sim/featured.js';
import { churchScene } from './sim/tiers.js';
import { baseStateFor, saveDay, lastKnownCount, migrate, STATE_DIR } from './sim/state.js';
import { getSubscriberCount } from './fetch/youtube.js';
import { fetchCommenters } from './fetch/comments.js';
import { wantsFromText, nameFromText, complainsFromText } from './sim/requests.js';
import { buildScript, sentenceAnchors } from './audio/narration.js';
import { synthesize, captionPhrases } from './audio/tts/index.js';
import { mixSoundtrack, VOICE_DELAY } from './audio/mix.js';
import { renderVideo, renderStills, renderGallery, sceneCues } from './render/capture.js';
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
    else if (k === '--day') a.day = v(); // test renders: a saved day again (state/history/DATE.json), never saved
    else if (k === '--gallery') a.gallery = v(); // test renders: work scenes, e.g. "farmer:sow,blacksmith:anvil+guard:sword"
    else if (k === '--gallery-times') a.galleryTimes = v();
    else if (k === '--story') a.story = v(); // test renders: force today's story event (bandits, quarrel, merchants, halloween)
    else if (k === '--real') a.real = true; // test renders: start from the real state/ (read only)
    else if (k === '--church') a.church = true; // test renders: the church interior closes the video (not the tavern)
    else if (k === '--built') a.built = v().split(',').map((s) => s.trim()).filter(Boolean); // test renders: these buildings stand finished
    else if (k === '--names') a.names = v().split(',').map((s) => s.trim()).filter(Boolean); // test renders: fake commenters
    else throw new Error(`unknown option ${k}`);
  }
  if (a.lang !== 'en' && a.lang !== 'it') throw new Error('--lang must be en or it');
  return a;
}

export function summarizeDiff(diff) {
  const pick = (k) => (Array.isArray(diff[k]) ? diff[k].length : diff[k]);
  return {
    date: diff.date, day: diff.day, from: diff.from, to: diff.to, delta: diff.delta,
    added: pick('added'), removed: pick('removed'), housesBuilt: pick('housesBuilt'), housesRebuilt: pick('housesRebuilt'), housesRaised: pick('housesRaised'),
    housesReoccupied: pick('housesReoccupied'), housesAbandoned: pick('housesAbandoned'), housesRuined: pick('housesRuined'),
    unlocked: diff.unlocked, buildingsStarted: diff.buildingsStarted, buildingsCompleted: diff.buildingsCompleted,
    weather: diff.weather, events: diff.events.map((e) => e.type + (e.name ? `:${e.name}` : '')), next: diff.next,
    newcomers: diff.added.slice(0, 5).map((v) => `${v.name ?? '(no name yet)'} (${v.job})`),
    named: (diff.named || []).map((v) => `${v.name} (${v.job})`),
    requests: (diff.requests || []).map((r) => `${r.name}: ${r.wanted}${r.granted ? '' : ' (apprentice)'}`),
    promoted: (diff.promoted || []).map((r) => `${r.name} -> ${r.job}`),
    renamed: (diff.renamed || []).map((r) => `${r.from} -> ${r.name}`),
  };
}

/** Narration -> TTS -> captions -> soundtrack -> frames -> MP4. */
export async function produceVideo(state, diff, { lang = 'en', out, quality, tts, log = console, workDir } = {}) {
  const dir = workDir || path.join('.cache', 'work', `${state.date}_${lang}_${state.subscriberCount}`);
  fs.mkdirSync(dir, { recursive: true });
  // the shot plan first, so each sentence can wait for the shot it talks about
  const cues = await sceneCues({ mode: 'video', state, diff, lang, quality }, { log });
  const script = buildScript(state, diff, { lang, shots: cues });
  log.log(`[audio] script (${script.words} words): ${script.text}`);
  const anchors = sentenceAnchors(script.sentences, cues);
  const sentences = script.sentences.map((s, i) => ({ ...s, at: anchors[i] === null ? null : anchors[i] - VOICE_DELAY }));
  const voice = await synthesize(sentences, { lang, outDir: dir, provider: tts, log });
  log.log(`[audio] ${voice.provider} narration ${voice.duration.toFixed(2)} s`);
  const captions = captionPhrases(voice.words, VOICE_DELAY);
  const data = { mode: 'video', state, diff, lang, captions, quality };
  const audio = async (stats) => {
    const file = mixSoundtrack({ narration: voice.file, outDir: dir, seed: state.seed, date: state.date, weather: diff.weather, cues: stats?.cues || [] });
    log.log(`[audio] soundtrack mixed with ${stats?.cues?.length || 0} camera cues`);
    return file;
  };
  const result = await renderVideo(data, out, { audio, log });
  if (result.errors.length) log.error(`[render] browser console errors: ${result.errors.join(' | ')}`);
  fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify({ date: state.date, subscribers: state.subscriberCount, lang, script: script.text, tts: voice.provider, captions, stats: result.stats, renderSeconds: result.seconds }, null, 1));
  return { out, script, voice, result };
}

/** --real: the next day of the real kingdom in state/ (never saved), with --names as today's commenters. */
function realNextDay({ subs, names = [], stateDir }) {
  const dir = stateDir || STATE_DIR;
  const cur = JSON.parse(fs.readFileSync(path.join(dir, 'kingdom.json'), 'utf8'));
  const date = new Date(Date.parse(cur.date) + 86400000).toISOString().slice(0, 10);
  const base = baseStateFor(date, { dir });
  const commenters = names.map(fakeCommenter(date, 'test'));
  return advance(base, { subscribers: subs, date, source: 'test', commenters, blocked: loadBlocked(dir) });
}

/** Build a two-day test kingdom ending at `subs` (default start: ~88% of it), without touching state/. */
export function testKingdom({ subs, from, date = today(), seed, names = [] }) {
  const start = from ?? (subs <= 3 ? 0 : Math.round(subs * 0.88) - 1);
  const d0 = new Date(Date.parse(date) - 2 * 86400000).toISOString().slice(0, 10);
  const d1 = new Date(Date.parse(date) - 86400000).toISOString().slice(0, 10);
  let s = genesis({ seed, date: d0 });
  s = advance(s, { subscribers: start, date: d1, source: 'test' }).state;
  const commenters = names.map(fakeCommenter(date, 'test'));
  return advance(s, { subscribers: subs, date, source: 'test', commenters });
}

/** --names "Mario=can I work at the tavern?,Luca": a fake commenter, optionally with a comment text. */
const fakeCommenter = (date, prefix) => (entry, i) => {
  const [name, text = ''] = entry.split('=');
  const call = nameFromText(text);
  return { author: `${prefix}-${name}`, name, at: `${date}T00:00:${String(i).padStart(2, '0')}Z`, wants: wantsFromText(text), ...(call ? { call } : {}), ...(complainsFromText(text) ? { complains: true } : {}) };
};

/** state/blocked.json: { "names": ["SomeName"], "authors": ["UC..."] } — names never to show. */
export function loadBlocked(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'blocked.json'), 'utf8')); } catch { return {}; }
}

export async function daily(args, log = console) {
  const date = args.date || today();
  const dir = args.stateDir || STATE_DIR;
  const { count, source, error } = await getSubscriberCount({ override: args.subs, lastKnown: lastKnownCount({ dir }), log });
  log.log(`[fetch] ${count} subscribers (${source})${error ? ` — ${error}` : ''}`);
  const base = baseStateFor(date, { dir, seed: args.seed });
  const commenters = args.names
    ? args.names.map(fakeCommenter(date, 'manual'))
    : await fetchCommenters({ apiKey: process.env.YOUTUBE_API_KEY, handle: process.env.YOUTUBE_HANDLE || undefined, since: base.commentsSeen, log });
  log.log(`[names] ${commenters.length} new commenter${commenters.length === 1 ? '' : 's'}`);
  const { state, diff } = advance(base, { subscribers: count, date, source, commenters, blocked: loadBlocked(dir) });
  log.log('[sim] ' + JSON.stringify(summarizeDiff(diff), null, 1));
  if (args.dryRun) return { state, diff, saved: false };
  saveDay(state, diff, { dir });
  log.log(`[state] saved day ${state.day} (${date}) to ${dir}`);
  if (args.noVideo) return { state, diff, saved: true };
  const out = args.out || path.join('output', `${date}_${args.lang}.mp4`);
  const video = await produceVideo(state, diff, { lang: args.lang, out, quality: args.quality, tts: args.tts, log });
  await publish({ video: out, state, diff, lang: args.lang, log, stateDir: dir });
  return { state, diff, saved: true, video: out };
}

/**
 * --day 2026-10-20: a saved day again, from state/history (read only), with today's code. The villagers at
 * work are picked again (src/sim/featured.js), avoiding the jobs the day before showed.
 */
function savedDay(date, stateDir = STATE_DIR) {
  const file = (d) => path.join(stateDir, 'history', `${d}.json`);
  if (!fs.existsSync(file(date))) throw new Error(`no saved day ${date} in ${path.join(stateDir, 'history')}`);
  const { state: raw, diff } = JSON.parse(fs.readFileSync(file(date), 'utf8'));
  const state = migrate(raw);
  const prevDate = fs.readdirSync(path.join(stateDir, 'history')).filter((f) => f.slice(0, 10) < date).sort().pop();
  const prev = prevDate ? migrate(JSON.parse(fs.readFileSync(path.join(stateDir, 'history', prevDate), 'utf8')).state) : null;
  // days saved since 2026-10-21 keep the villagers and scenes they were planned with
  if (diff.scenes) return { state, diff };
  diff.avoidJobs = prev ? shownJobs(prev) : [];
  diff.featured = state.featured = pickFeatured(state, { avoidJobs: diff.avoidJobs });
  return { state, diff };
}

export async function testRender(args, log = console) {
  if (!args.day && !Number.isFinite(args.subs)) throw new Error('--subs N is required');
  if (args.day) args.subs ??= 0;
  const { state, diff } = args.day ? savedDay(args.day) : args.real ? realNextDay(args) : testKingdom({ subs: args.subs, from: args.from, date: args.date, seed: args.seed, names: args.names });
  for (const id of args.built || []) {
    const b = state.buildings.find((x) => x.id === id);
    if (b) Object.assign(b, { status: 'done', doneDay: state.day });
    else state.buildings.push({ id, tier: 'test', status: 'done', startedDay: state.day, doneDay: state.day, daysTotal: 0 });
    state.pendingConstruction = state.pendingConstruction.filter((p) => p.building !== id);
  }
  if (args.church) diff.scenes = state.scenes = { ...(diff.scenes || { variants: {}, ambient: null }), tavern: false, church: churchScene(state) };
  if (args.story) diff.story = state.story = storyFor(state, args.story);
  if (args.story === 'storm') diff.weather = state.weather = 'rain'; // as the daily simulation does
  log.log('[sim] ' + JSON.stringify(summarizeDiff(diff)));
  if (args.gallery) {
    // "job:variant" or "job:variant+guestJob:pair"
    const items = args.gallery.split(',').map((s) => {
      const [host, guest] = s.trim().split('+');
      const [job, variant = null] = host.split(':');
      const [gjob, pair] = guest ? guest.split(':') : [];
      return { name: s.trim().replace(/[:+]/g, '_'), job, variant, ...(guest ? { guest: gjob, pair: pair || 'visit' } : {}) };
    });
    const times = (args.galleryTimes || '0.6,1.6,2.4').split(',').map(Number);
    const r = await renderGallery({ mode: 'video', state, diff, lang: args.lang, quality: args.quality }, items, times, path.join('output', 'gallery'));
    if (r.errors.length) log.error('[render] browser errors: ' + r.errors.join(' | '));
    log.log(r.files.join('\n'));
    return r;
  }
  if (args.stills) {
    const times = args.stills.split(',').map(Number);
    const r = await renderStills({ mode: 'video', state, diff, lang: args.lang, quality: args.quality }, times, path.join("output", `stills_${args.day || args.subs}`));
    log.log('[shots] ' + (r.stats.cues || []).map((c) => `${c.kind}:${c.id ?? ''} ${c.t0.toFixed(1)}-${c.t1.toFixed(1)}`).join(' | '));
    if (r.errors.length) log.error('[render] browser errors: ' + r.errors.join(' | '));
    log.log(r.files.join('\n'));
    return r;
  }
  const out = args.out || path.join('output', args.day ? `${args.day}_${args.lang}_again.mp4` : `test_${args.subs}_${args.lang}.mp4`);
  return produceVideo(state, diff, { lang: args.lang, out, quality: args.quality, tts: args.tts, log });
}
