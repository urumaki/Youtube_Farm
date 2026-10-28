#!/usr/bin/env node
// Upload a re-rendered day in place of the video published for it (owner's call each time):
// node scripts/republish-day.js 2026-10-21 [output/2026-10-21_en_again.mp4] [--at HH:MM]
// Public right away (YT_PRIVACY, default public), or scheduled for the next HH:MM UTC with --at. The old video id is kept in state/published.json under
// `replaced`; the old video itself is not touched (the owner deletes or hides it on YouTube).
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from './env.js';
import { migrate, STATE_DIR } from '../src/sim/state.js';
import { publish } from '../src/publish/index.js';

loadEnv();
const args = process.argv.slice(2);
const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const at = args.includes('--at') ? args[args.indexOf('--at') + 1] : '';
if (at && !/^d{1,2}:d{2}$/.test(at)) throw new Error('--at takes HH:MM (UTC)');
const video = args.find((a) => a.endsWith('.mp4')) || path.join('output', `${date}_en_again.mp4`);
if (!date || !fs.existsSync(video)) throw new Error('usage: node scripts/republish-day.js YYYY-MM-DD [video.mp4]');
const { state: raw, diff } = JSON.parse(fs.readFileSync(path.join(STATE_DIR, 'history', `${date}.json`), 'utf8'));
const state = migrate(raw);
const ledgerFile = path.join(STATE_DIR, 'published.json');
const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
const key = `${date}_en`;
const old = ledger[key];
if (old?.youtube) {
  // let publish() upload again for this day, remembering what it replaces
  ledger[key] = { replaced: [...(old.replaced || []), { youtube: old.youtube, uploadedAt: old.uploadedAt }] };
  fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1) + '\n');
}
const r = await publish({ video, state, diff, env: { ...process.env, PUBLISH_TARGETS: 'youtube', YT_PUBLISH_AT: at } });
if (!r.youtube) {
  if (old) { ledger[key] = old; fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 1) + '\n'); }
  process.exitCode = 1;
}
