#!/usr/bin/env node
// Checks an MP4 against the platform spec and extracts frames for review:
//   node scripts/verify-video.js output/test_12_en.mp4 [--frames 1,10,25]
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2];
const fi = process.argv.indexOf('--frames');
const times = (fi > 0 ? process.argv[fi + 1] : '1,10,25').split(',').map(Number);
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], { encoding: 'utf8' }));
const v = probe.streams.find((s) => s.codec_type === 'video'), a = probe.streams.find((s) => s.codec_type === 'audio');
const [num, den] = v.r_frame_rate.split('/').map(Number);
const checks = {
  'size 1080x1920': v.width === 1080 && v.height === 1920,
  'h264': v.codec_name === 'h264',
  'yuv420p': v.pix_fmt === 'yuv420p',
  '30 fps': Math.abs(num / den - 30) < 1e-6,
  'duration 30.0 s': Math.abs(Number(probe.format.duration) - 30) < 0.05,
  'aac audio track': !!a && a.codec_name === 'aac',
  'frame count 900': Number(v.nb_frames) === 900,
};
const dir = path.join(path.dirname(file), path.basename(file, '.mp4') + '_frames');
fs.mkdirSync(dir, { recursive: true });
for (const t of times) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', path.join(dir, `t${t}.png`)]);
// black-frame scan over the whole video
const bd = spawnSync('ffmpeg', ['-i', file, '-vf', 'blackdetect=d=0.05:pix_th=0.06', '-an', '-f', 'null', '-'], { encoding: 'utf8' });
const black = bd.stderr.split('\n').filter((l) => l.includes('black_start'));
checks['no black frames'] = black.length === 0;
for (const [k, ok] of Object.entries(checks)) console.log(`${ok ? 'PASS' : 'FAIL'}  ${k}`);
console.log(`duration=${probe.format.duration} frames=${v.nb_frames} fps=${v.r_frame_rate} audio=${a ? a.codec_name + ' ' + a.sample_rate + 'Hz' : 'none'}`);
console.log(`frames: ${dir}`);
if (Object.values(checks).some((x) => !x)) process.exit(1);

