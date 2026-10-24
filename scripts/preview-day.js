#!/usr/bin/env node
// Preview of the next real day (read only): the real comments since the last saved day, a given subscriber count,
// rendered to output/<date>_en_preview_<subs>.mp4. Nothing is saved to state/ and nothing is published.
// node scripts/preview-day.js 1600 [YYYY-MM-DD]
import { loadEnv } from './env.js';
import { produceVideo, loadBlocked, summarizeDiff, today } from '../src/pipeline.js';
import { fetchCommenters } from '../src/fetch/comments.js';
import { baseStateFor, STATE_DIR } from '../src/sim/state.js';
import { advance } from '../src/sim/simulate.js';

loadEnv();
const subs = Number(process.argv[2]);
const date = process.argv[3] || today();
if (!(subs > 0)) throw new Error('usage: node scripts/preview-day.js SUBSCRIBERS [YYYY-MM-DD]');
const base = baseStateFor(date, { dir: STATE_DIR });
const commenters = await fetchCommenters({ apiKey: process.env.YOUTUBE_API_KEY, handle: process.env.YOUTUBE_HANDLE || undefined, since: base.commentsSeen });
console.log(`[names] ${commenters.length} new commenters`);
const { state, diff } = advance(base, { subscribers: subs, date, source: 'preview', commenters, blocked: loadBlocked(STATE_DIR) });
console.log('[sim] ' + JSON.stringify(summarizeDiff(diff)));
await produceVideo(state, diff, { lang: 'en', out: `output/${date}_en_preview_${subs}.mp4` });
