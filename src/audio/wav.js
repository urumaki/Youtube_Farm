// Minimal PCM WAV reading/writing (16-bit), enough for TTS clips and generated music.
import fs from 'node:fs';

export function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file}: not a WAV file`);
  let off = 12, fmt = null, data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { channels: b.readUInt16LE(off + 10), sampleRate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === 'data') data = b.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error(`${file}: unsupported WAV (need 16-bit PCM)`);
  const n = data.length / 2 / fmt.channels;
  const ch = Array.from({ length: fmt.channels }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.channels; c++) ch[c][i] = data.readInt16LE((i * fmt.channels + c) * 2) / 32768;
  return { sampleRate: fmt.sampleRate, channels: ch, duration: n / fmt.sampleRate };
}

export function writeWav(file, channels, sampleRate) {
  const n = channels[0].length, nc = channels.length;
  const b = Buffer.alloc(44 + n * nc * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * nc * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(nc, 22);
  b.writeUInt32LE(sampleRate, 24); b.writeUInt32LE(sampleRate * nc * 2, 28); b.writeUInt16LE(nc * 2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * nc * 2, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) {
    const v = Math.max(-1, Math.min(1, channels[c][i]));
    b.writeInt16LE(Math.round(v * 32767), 44 + (i * nc + c) * 2);
  }
  fs.writeFileSync(file, b);
}

/** Start/end (seconds) of audible speech in a clip, by short-window energy. */
export function speechBounds(samples, sampleRate, threshold = 0.02) {
  const win = Math.round(sampleRate * 0.01);
  let first = -1, last = -1;
  for (let i = 0; i + win <= samples.length; i += win) {
    let e = 0;
    for (let k = i; k < i + win; k++) e += samples[k] * samples[k];
    if (Math.sqrt(e / win) > threshold) { if (first < 0) first = i; last = i + win; }
  }
  if (first < 0) return [0, samples.length / sampleRate];
  return [first / sampleRate, last / sampleRate];
}
