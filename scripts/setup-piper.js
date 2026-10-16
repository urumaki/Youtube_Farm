// Downloads the Piper TTS binary and the default voices into tools/piper (git-ignored).
// Voices: en-us-libritts-high (LibriTTS, CC BY 4.0) and it-riccardo_fasol-x-low (M-AILABS dataset).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'tools', 'piper');
const REL = 'https://github.com/rhasspy/piper/releases/download';
const BIN = {
  linux: { x64: 'piper_linux_x86_64.tar.gz', arm64: 'piper_linux_aarch64.tar.gz' },
  win32: { x64: 'piper_windows_amd64.zip' },
  darwin: { x64: 'piper_macos_x64.tar.gz', arm64: 'piper_macos_aarch64.tar.gz' },
};
const VOICES = ['voice-en-us-libritts-high', 'voice-it-riccardo_fasol-x-low'];

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

fs.mkdirSync(path.join(DIR, 'voices'), { recursive: true });
const asset = BIN[process.platform]?.[process.arch];
if (!asset) throw new Error(`no Piper build for ${process.platform}/${process.arch}`);
const exe = path.join(DIR, 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
if (!fs.existsSync(exe)) {
  const archive = path.join(DIR, asset);
  console.log('downloading', asset);
  await download(`${REL}/2023.11.14-2/${asset}`, archive);
  execFileSync('tar', ['-xf', archive, '-C', DIR]); // tar.exe on Windows 10+ also extracts .zip
  fs.rmSync(archive);
}
for (const v of VOICES) {
  const name = v.replace(/^voice-/, '');
  if (fs.existsSync(path.join(DIR, 'voices', `${name}.onnx`))) continue;
  const archive = path.join(DIR, `${v}.tar.gz`);
  console.log('downloading', v);
  await download(`${REL}/v0.0.2/${v}.tar.gz`, archive);
  const tmp = path.join(DIR, 'tmp_' + name);
  fs.mkdirSync(tmp, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', tmp]);
  for (const f of fs.readdirSync(tmp)) fs.renameSync(path.join(tmp, f), path.join(DIR, 'voices', f === 'MODEL_CARD' ? `${name}.MODEL_CARD.md` : f));
  fs.rmSync(tmp, { recursive: true });
  fs.rmSync(archive);
}
console.log('Piper ready in', DIR);
console.log('Check each voice license in tools/piper/voices/*.MODEL_CARD.md before publishing.');
