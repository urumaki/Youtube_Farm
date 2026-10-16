#!/usr/bin/env node
// Builds dist/viewer.html (standalone, double-click to open) from state/kingdom.json,
// or from a test kingdom with --subs N. --check opens it in headless Chromium and fails on console errors.
import fs from 'node:fs';
import path from 'node:path';
import { buildViewer } from './build.js';
import { loadState, STATE_DIR } from '../src/sim/state.js';
import { testKingdom } from '../src/pipeline.js';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
let state, diff;
if (opt('--subs')) ({ state, diff } = testKingdom({ subs: Number(opt('--subs')) }));
else {
  const file = path.join(STATE_DIR, 'kingdom.json');
  if (!fs.existsSync(file)) {
    console.error('No state/kingdom.json yet: run `npm run daily` first, or use --subs N for a test kingdom.');
    process.exit(1);
  }
  state = loadState(file);
  const hist = path.join(STATE_DIR, 'history', `${state.date}.json`);
  diff = fs.existsSync(hist) ? JSON.parse(fs.readFileSync(hist, 'utf8')).diff : { weather: state.weather, events: state.events, delta: 0 };
}
const out = await buildViewer(state, diff, { out: opt('--out') || path.join('dist', 'viewer.html') });
console.log(`wrote ${out} (${(fs.statSync(out).size / 1e6).toFixed(1)} MB) — ${state.subscriberCount} villagers, ${state.houses.length} houses`);

if (argv.includes('--check')) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + path.resolve(out));
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
  const ready = await page.evaluate(() => window.__ready || null);
  await new Promise((r) => setTimeout(r, 3000)); // let a few animation frames run
  const shot = out.replace(/\.html$/, '.png');
  await page.screenshot({ path: shot });
  await browser.close();
  console.log('viewer stats:', JSON.stringify(ready));
  console.log(`screenshot: ${shot}`);
  if (errors.length || !ready) {
    console.error('console errors:', errors);
    process.exit(1);
  }
  console.log('no console errors');
}
