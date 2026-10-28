#!/usr/bin/env node
// npm run daily [-- --subs N] [--date YYYY-MM-DD] [--dry-run] [--no-video] [--quality low|medium|high] [--tts piper|elevenlabs|none]
import { loadEnv } from './env.js';
import { daily, parseArgs } from '../src/pipeline.js';

loadEnv();
try {
  const r = await daily(parseArgs(process.argv.slice(2)));
  if (r.video) console.log(`[done] ${r.video}`);
} catch (e) {
  console.error('[daily] failed:', e.stack || e);
  process.exit(1);
}
