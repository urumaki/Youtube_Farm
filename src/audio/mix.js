// Final soundtrack: narration on top, music ducked under the voice (sidechain), ambience below,
// loudness-normalized for social platforms, exactly 30.0 s.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { writeMusic } from './music.js';
import { makeSfxTrack } from './sfx.js';

export const VOICE_DELAY = 0.35; // seconds of music before the narrator speaks

/** Use a user-provided bed from assets/audio if present (see assets/audio/LICENSES.md), else generate. */
function pickTrack(kind, dir, generate) {
  const custom = ['mp3', 'wav', 'ogg', 'm4a', 'flac'].map((e) => path.resolve('assets/audio', `${kind}.${e}`)).find((f) => fs.existsSync(f));
  return custom || generate(path.join(dir, `${kind}.wav`));
}

export function mixSoundtrack({ narration, outDir, seed, date, weather, cues = [], duration = 30 }) {
  const music = pickTrack('music', outDir, (f) => writeMusic(f, seed, date));
  // effects follow the camera; a custom assets/audio/ambience.* file replaces the whole effects track
  const amb = pickTrack('ambience', outDir, (f) => makeSfxTrack(f, { cues, seed, date, weather, duration, workDir: outDir }));
  const out = path.join(outDir, 'soundtrack.m4a');
  const ms = Math.round(VOICE_DELAY * 1000);
  const filter = [
    `[0:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},apad,volume=1.6,asplit=2[v][key]`,
    `[1:a]aresample=48000,aformat=channel_layouts=stereo,aloop=loop=-1:size=2e9,volume=0.42[m]`,
    `[m][key]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350:makeup=1[md]`,
    `[2:a]aresample=48000,aformat=channel_layouts=stereo,apad,volume=0.9[a]`,
    // amix divides by the input count; volume=3 undoes it (same as normalize=0, which ffmpeg < 4.4 lacks).
    // All three inputs are padded or looped forever, so the divisor stays 3 for the whole mix.
    `[v][md][a]amix=inputs=3:duration=longest,volume=3,atrim=0:${duration},afade=t=out:st=${duration - 0.6}:d=0.6,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[out]`,
  ].join(';');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', narration, '-i', music, '-i', amb, '-filter_complex', filter, '-map', '[out]', '-t', String(duration), '-c:a', 'aac', '-b:a', '192k', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('ffmpeg mix failed: ' + r.stderr);
  return out;
}
