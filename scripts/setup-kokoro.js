// Installs the Kokoro TTS runtime (pip package kokoro-onnx) and downloads the model + voices
// (Kokoro-82M, Apache-2.0) into tools/kokoro (git-ignored).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'tools', 'kokoro');
const REL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0';
const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

fs.mkdirSync(DIR, { recursive: true });
console.log('installing kokoro-onnx with', python);
execFileSync(python, ['-m', 'pip', 'install', '--quiet', 'kokoro-onnx==0.6.1'], { stdio: 'inherit' });
for (const f of ['kokoro-v1.0.onnx', 'voices-v1.0.bin']) {
  const out = path.join(DIR, f);
  if (fs.existsSync(out)) continue;
  console.log('downloading', f);
  const res = await fetch(`${REL}/${f}`);
  if (!res.ok) throw new Error(`${f}: HTTP ${res.status}`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}
console.log('Kokoro ready in', DIR);
