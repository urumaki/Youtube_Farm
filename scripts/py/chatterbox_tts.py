"""Chatterbox TTS (Resemble AI, MIT) with a reference voice: one WAV per input line, at the model's own pace.
Usage: python chatterbox_tts.py REF_AUDIO EXAGGERATION CFG_WEIGHT SEED OUT_DIR < lines.txt
Writes OUT_DIR/raw_<i>.wav (mono 16-bit, the model's rate) and prints one duration per line.
The speed is set afterwards (ffmpeg atempo, src/audio/tts/index.js), so a faster retry needs no new generation.
Owner 2026-11-25: sample 16 of the voice comparison, am_adam's timbre (Kokoro) read as a storyteller (0.7 / 0.35)."""
import sys, wave, re
import numpy as np
import torch
from chatterbox.tts import ChatterboxTTS

ref, exaggeration, cfg, seed, out = sys.argv[1:6]
m = ChatterboxTTS.from_pretrained(device="cpu")
m.prepare_conditionals(ref, exaggeration=float(exaggeration))

def say(line, s):
    torch.manual_seed(s)
    wav = m.generate(line, exaggeration=float(exaggeration), cfg_weight=float(cfg))
    return wav.squeeze(0).numpy()

for i, line in enumerate(sys.stdin.read().splitlines()):
    letters = len(re.findall(r"\w", line))
    # a sampled voice can ramble or trail off on a short line: draw again (another seed) when it runs far past what the
    # line should take, and keep the shortest take
    expect = 0.075 * letters + 0.6
    best = None
    for k in range(3):
        samples = say(line, int(seed) + 7919 * i + 104729 * k)
        if best is None or len(samples) < len(best):
            best = samples
        if len(best) / m.sr <= 2.2 * expect + 1.0:
            break
    pcm = (np.clip(best, -1, 1) * 32767).astype("<i2")
    with wave.open(f"{out}/raw_{i}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(m.sr); w.writeframes(pcm.tobytes())
    print(f"{len(best) / m.sr:.3f}", flush=True)
