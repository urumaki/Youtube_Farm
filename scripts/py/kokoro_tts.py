"""Kokoro TTS (Apache-2.0 model) via kokoro-onnx: one WAV per input line.
Usage: python kokoro_tts.py MODEL VOICES VOICE LANG SPEED OUT_DIR < lines.txt
Writes OUT_DIR/tts_<i>.wav (24 kHz mono 16-bit) and prints one duration per line."""
import sys, wave
import numpy as np
from kokoro_onnx import Kokoro

model, voices, voice, lang, speed, out = sys.argv[1:7]
k = Kokoro(model, voices)
for i, line in enumerate(sys.stdin.read().splitlines()):
    samples, rate = k.create(line, voice=voice, speed=float(speed), lang=lang)
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(f"{out}/tts_{i}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(pcm.tobytes())
    print(f"{len(samples) / rate:.3f}", flush=True)
