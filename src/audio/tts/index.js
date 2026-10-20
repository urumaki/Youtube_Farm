// Text-to-speech behind one interface. Providers: 'kokoro' (default: free, local, Apache-2.0 model widely used
// for narration), 'piper' (free, local, lighter), 'elevenlabs' (cloud), 'none' (silent).
// synthesize() never throws: it falls back kokoro -> piper -> none so the daily video is always produced.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readWav, writeWav, speechBounds } from '../wav.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const exe = process.platform === 'win32' ? '.exe' : '';
const GAP = 0.28; // seconds between sentences

export function piperConfig(lang, env = process.env) {
  const dir = path.join(ROOT, 'tools', 'piper');
  return {
    bin: env.PIPER_BIN || path.join(dir, 'piper', 'piper' + exe),
    model: lang === 'it' ? env.PIPER_VOICE_IT || path.join(dir, 'voices', 'it-riccardo_fasol-x-low.onnx') : env.PIPER_VOICE_EN || path.join(dir, 'voices', 'en-us-libritts-high.onnx'),
    speaker: lang === 'it' ? env.PIPER_SPEAKER_IT : env.PIPER_SPEAKER_EN ?? '20',
  };
}

/** Spread a sentence's words over its audible span, weighted by length. */
function timeWords(text, start, end) {
  const ws = text.split(/\s+/).filter(Boolean);
  const weight = ws.map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1.5);
  const total = weight.reduce((a, b) => a + b, 0);
  let t = start;
  return ws.map((w, i) => {
    const d = ((end - start) * weight[i]) / total;
    const o = { w, s: t, e: t + d };
    t += d;
    return o;
  });
}

export function kokoroConfig(lang, env = process.env) {
  const dir = path.join(ROOT, 'tools', 'kokoro');
  return {
    python: env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),
    model: env.KOKORO_MODEL || path.join(dir, 'kokoro-v1.0.onnx'),
    voices: env.KOKORO_VOICES || path.join(dir, 'voices-v1.0.bin'),
    voice: lang === 'it' ? env.KOKORO_VOICE_IT || 'im_nicola' : env.KOKORO_VOICE_EN || 'am_adam',
    lang: lang === 'it' ? 'it' : (env.KOKORO_VOICE_EN || 'am_adam').startsWith('b') ? 'en-gb' : 'en-us',
    speed: Number(env.KOKORO_SPEED || 1.05),
  };
}

function kokoro(sentences, { lang, outDir, speed }) {
  const cfg = kokoroConfig(lang);
  if (!fs.existsSync(cfg.model) || !fs.existsSync(cfg.voices)) throw new Error(`kokoro model not found in ${path.dirname(cfg.model)} (run npm run setup:tts)`);
  const script = path.join(ROOT, 'scripts', 'py', 'kokoro_tts.py');
  const r = spawnSync(cfg.python, [script, cfg.model, cfg.voices, cfg.voice, cfg.lang, String(speed ?? cfg.speed), path.resolve(outDir)], {
    input: sentences.map((s) => s.text.replace(/\s+/g, ' ')).join('\n'), encoding: 'utf8', maxBuffer: 1 << 24,
  });
  if (r.status !== 0) throw new Error(`kokoro failed: ${(r.stderr || r.error?.message || '').slice(-400)}`);
  return assemble(sentences, sentences.map((_, i) => readWav(path.resolve(outDir, `tts_${i}.wav`))), outDir, 'kokoro');
}

/** Trim each sentence to its audible span, join with short pauses, time the words. */
function assemble(sentences, parts, outDir, provider) {
  const rate = parts[0].rate;
  const chunks = [], words = [];
  let t = 0;
  parts.forEach((p, i) => {
    const b = speechBounds(p);
    const a = Math.max(0, Math.floor((b.start - 0.03) * rate)), z = Math.min(p.samples.length, Math.ceil((b.end + 0.06) * rate));
    const seg = p.samples.subarray(a, z);
    words.push(...timeWords(sentences[i].text, t + 0.03, t + seg.length / rate - 0.06));
    chunks.push(seg, new Float32Array(Math.round(GAP * rate)));
    t += seg.length / rate + GAP;
  });
  const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  const file = path.join(outDir, 'narration.wav');
  writeWav(file, [all], rate);
  return { file, duration: all.length / rate, words, provider };
}

function piper(sentences, { lang, outDir, lengthScale = 1 }) {
  const cfg = piperConfig(lang);
  if (!fs.existsSync(cfg.bin)) throw new Error(`piper binary not found at ${cfg.bin} (run npm run setup:piper)`);
  if (!fs.existsSync(cfg.model)) throw new Error(`piper voice not found at ${cfg.model}`);
  const parts = [];
  sentences.forEach((s, i) => {
    const out = path.resolve(outDir, `tts_${i}.wav`);
    const args = ['--model', path.resolve(cfg.model), '--output_file', out, '--length_scale', String(lengthScale), '--sentence_silence', '0'];
    if (cfg.speaker !== undefined && cfg.speaker !== '') args.push('--speaker', String(cfg.speaker));
    const r = spawnSync(cfg.bin, args, { input: s.text, encoding: 'utf8', cwd: path.dirname(cfg.bin) });
    if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`piper failed: ${r.stderr?.slice(-400)}`);
    parts.push(readWav(out));
  });
  return assemble(sentences, parts, outDir, 'piper');
}

async function elevenlabs(sentences, { outDir, lang, env = process.env }) {
  const key = env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY not set');
  const voice = env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb';
  const text = sentences.map((s) => s.text).join(' ');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: env.ELEVENLABS_MODEL || 'eleven_multilingual_v2', language_code: lang }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status}`);
  const body = await res.json();
  const mp3 = path.join(outDir, 'narration.mp3');
  fs.writeFileSync(mp3, Buffer.from(body.audio_base64, 'base64'));
  const file = path.join(outDir, 'narration.wav');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', file]);
  if (r.status !== 0) throw new Error('ffmpeg could not decode ElevenLabs audio');
  const al = body.alignment || body.normalized_alignment;
  const words = [];
  let cur = null;
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (cur) words.push(cur); cur = null; return; }
    if (!cur) cur = { w: '', s: al.character_start_times_seconds[i], e: 0 };
    cur.w += ch;
    cur.e = al.character_end_times_seconds[i];
  });
  if (cur) words.push(cur);
  return { file, duration: readWav(file).duration, words, provider: 'elevenlabs' };
}

function silent(sentences, { outDir }) {
  const words = [];
  let t = 0;
  for (const s of sentences) {
    const n = s.text.split(/\s+/).filter(Boolean).length;
    words.push(...timeWords(s.text, t, t + n / 2.7));
    t += n / 2.7 + GAP;
  }
  const rate = 22050, file = path.join(outDir, 'narration.wav');
  writeWav(file, [new Float32Array(Math.round(t * rate))], rate);
  return { file, duration: t, words, provider: 'none' };
}

/** Synthesize the script. maxDuration: if the voice runs long, retry faster (piper) before giving up. */
export async function synthesize(sentences, { lang = 'en', outDir, provider = process.env.TTS_PROVIDER || 'kokoro', maxDuration = 28.3, log = console } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const chain = { elevenlabs: ['elevenlabs', 'kokoro', 'piper', 'none'], kokoro: ['kokoro', 'piper', 'none'], piper: ['piper', 'none'], none: ['none'] }[provider] || ['kokoro', 'piper', 'none'];
  for (const p of chain) {
    try {
      if (p === 'elevenlabs') return await elevenlabs(sentences, { outDir, lang });
      if (p === 'kokoro') {
        let speed = kokoroConfig(lang).speed;
        let out = kokoro(sentences, { lang, outDir, speed });
        for (let k = 0; k < 2 && out.duration > maxDuration; k++) {
          speed = Math.min(1.35, speed * (out.duration / maxDuration) * 1.06);
          out = kokoro(sentences, { lang, outDir, speed });
        }
        return out;
      }
      if (p === 'piper') {
        let out = piper(sentences, { lang, outDir });
        if (out.duration > maxDuration) out = piper(sentences, { lang, outDir, lengthScale: Math.max(0.82, maxDuration / out.duration) });
        return out;
      }
      return silent(sentences, { outDir });
    } catch (e) {
      log.error?.(`[tts] ${p} failed: ${e.message}`);
    }
  }
  return silent(sentences, { outDir });
}

/** Group timed words into short caption phrases (<= 4 words, <= 24 chars, never across a sentence end). */
export function captionPhrases(words, offset = 0) {
  const out = [];
  let cur = [];
  const flush = () => { if (cur.length) out.push({ text: cur.map((w) => w.w).join(' '), start: cur[0].s, end: cur.at(-1).e, words: cur }); cur = []; };
  words.forEach((w, i) => {
    const ww = { w: w.w, s: w.s + offset, e: w.e + offset };
    const len = cur.reduce((n, x) => n + x.w.length + 1, 0) + ww.w.length;
    const shortTail = /[.!?]$/.test(ww.w) && ww.w.length <= 4 && cur.length < 5; // don't strand "2." on its own
    if ((cur.length >= 4 || len > 24) && !shortTail) flush();
    cur.push(ww);
    if (/[.!?]$/.test(ww.w)) flush();
    void i;
  });
  flush();
  // keep each phrase on screen until the next one starts
  for (let i = 0; i < out.length - 1; i++) out[i].end = Math.max(out[i].end, Math.min(out[i + 1].start, out[i].end + 0.5));
  return out;
}
