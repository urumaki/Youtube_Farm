#!/usr/bin/env node
// Test render without touching state/: npm run render -- --subs 120 [--from 100] [--lang it] [--stills 1,10,25]
import { loadEnv } from './env.js';
import { testRender, parseArgs } from '../src/pipeline.js';

loadEnv();
const r = await testRender(parseArgs(process.argv.slice(2)));
if (r?.out) console.log(`[done] ${r.out}`);
