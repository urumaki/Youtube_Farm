// Installs the narrator's voice from 2026-11-26 (owner 2026-11-25): Chatterbox TTS (Resemble AI, MIT) in its own Python
// venv, tools/chatterbox-venv (git-ignored, apart from Kokoro's packages), CPU torch, and downloads the model (~3 GB, into
// HF_HOME or ~/.cache/huggingface). Needs Python 3.10-3.12: CHATTERBOX_BASE_PYTHON, else PYTHON, else python3.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chatterboxConfig } from '../src/audio/tts/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENV = path.join(ROOT, 'tools', 'chatterbox-venv');
const base = process.env.CHATTERBOX_BASE_PYTHON || process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const py = chatterboxConfig().python;
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

if (!fs.existsSync(py)) {
  console.log('creating', VENV, 'with', base);
  run(base, ['-m', 'venv', VENV]);
}
if (!fs.existsSync(path.join(VENV, '.installed-0.1.7'))) {
  run(py, ['-m', 'pip', 'install', '--quiet', '--upgrade', 'pip']);
  run(py, ['-m', 'pip', 'install', '--quiet', 'torch==2.6.0', 'torchaudio==2.6.0', '--index-url', 'https://download.pytorch.org/whl/cpu']);
  run(py, ['-m', 'pip', 'install', '--quiet', 'chatterbox-tts==0.1.7']);
  fs.writeFileSync(path.join(VENV, '.installed-0.1.7'), '');
}
// downloads the model once (later runs read the cache)
run(py, ['-c', 'from chatterbox.tts import ChatterboxTTS; ChatterboxTTS.from_pretrained(device="cpu"); print("Chatterbox ready")']);
