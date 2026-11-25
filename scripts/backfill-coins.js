#!/usr/bin/env node
// Owner 2026-11-25: the gold coins from day 1 (src/sim/coins.js). Reads every public top-level comment on the channel's
// videos (the same API and checks as the daily run), keeps only author ids, times and video ids, and replays them in time
// order: a commenter with a villager starts at 100 with the video of their first comment, and gets +1 for each later video.
// Only comments the daily run already read count (up to state.commentsSeen): the next run pays the newer ones.
// node scripts/backfill-coins.js          (prints what it would give)
// node scripts/backfill-coins.js --save   (writes state.coins in state/kingdom.json and the latest state/history file)
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from './env.js';
import { fetchCommenters } from '../src/fetch/comments.js';
import { payComment, START_GOLD } from '../src/sim/coins.js';
import { STATE_DIR } from '../src/sim/state.js';

loadEnv();
const save = process.argv.includes('--save');
const kingdomFile = path.join(STATE_DIR, 'kingdom.json');
const kingdom = JSON.parse(fs.readFileSync(kingdomFile, 'utf8'));
const historyFile = path.join(STATE_DIR, 'history', `${kingdom.date}.json`);
const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
if (history.state.commentsSeen !== kingdom.commentsSeen) throw new Error(`${historyFile} and kingdom.json disagree: run after the day is saved`);
const blocked = JSON.parse(fs.readFileSync(path.join(STATE_DIR, 'blocked.json'), 'utf8'));
const blockedAuthors = new Set(blocked.authors || []);

const comments = await fetchCommenters({ apiKey: process.env.YOUTUBE_API_KEY, handle: process.env.YOUTUBE_HANDLE || undefined, pages: 400 });
if (!comments.length) throw new Error('no comments read (is YOUTUBE_API_KEY set?)');
const named = new Set(kingdom.namedAuthors);
const tally = { coins: {} }, met = new Set();
let counted = 0;
for (const c of comments) {
  if (kingdom.commentsSeen && c.at > kingdom.commentsSeen) continue;
  if (!named.has(c.author) || blockedAuthors.has(c.author)) continue;
  counted += 1;
  if (met.has(c.author)) payComment(tally, c.author, c.video);
  else { met.add(c.author); payComment(tally, c.author, c.video, { first: true }); }
}
const golds = Object.values(tally.coins).map((w) => w.gold).sort((a, b) => b - a);
console.log(`[coins] ${comments.length} comments read (${comments[0]?.at} .. ${comments.at(-1)?.at}), ${counted} by named villagers`);
console.log(`[coins] ${golds.length} wallets; above ${START_GOLD}: ${golds.filter((g) => g > START_GOLD).length}; top: ${golds.slice(0, 10).join(', ')}`);
if (save) {
  kingdom.coins = tally.coins;
  history.state.coins = tally.coins;
  fs.writeFileSync(kingdomFile, JSON.stringify(kingdom, null, 1));
  fs.writeFileSync(historyFile, JSON.stringify(history));
  console.log(`[coins] saved in ${kingdomFile} and ${historyFile}`);
}
