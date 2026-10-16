# Audio licenses

Every sound used in the daily videos is listed here.

| Sound | Source | License |
|---|---|---|
| Music bed (drone, plucked lute, recorder, frame drum) | Generated at render time by `src/audio/music.js` (`makeMusic`) — no samples | CC0 1.0 (public domain dedication by this repository) |
| Sound effects (hammer, saw, anvil, fire, water, oars, bell, chisel, stone, chain, thud, creak, cart, chatter, birds, breeze, rain, chime) | Generated at render time by `src/audio/sfx.js` — no samples | CC0 1.0 |
| Narration (default) | Kokoro-82M TTS model via `kokoro-onnx`, voices `am_adam` (EN) / `im_nicola` (IT) | Apache-2.0 (model and voices) |
| Narration, English (Piper fallback) | Piper TTS voice `en-us-libritts-high`, speaker 20, trained on LibriTTS ([OpenSLR 60](http://www.openslr.org/60/)) | Dataset: CC BY 4.0 — credit "Voice: Piper TTS (LibriTTS, CC BY 4.0)" in the video description |
| Narration, Italian (Piper fallback) | Piper TTS voice `it-riccardo_fasol-x-low`, trained on the M-AILABS speech dataset | See the dataset terms linked in `tools/piper/voices/it-riccardo_fasol-x-low.MODEL_CARD.md`; verify before commercial use |
| Narration (optional) | ElevenLabs API | Governed by your ElevenLabs plan's terms |
| Piper engine | [rhasspy/piper](https://github.com/rhasspy/piper) | MIT |

## Using your own tracks

Drop a file named `music.(mp3|wav|ogg|m4a|flac)` in this folder to replace the music, or put
recordings named after an effect in `sfx/` (e.g. `sfx/hammer.wav`) to replace that effect; an
`ambience.*` file here replaces the whole effects track. **Add a row to the table above with its source and license**
(royalty-free with a license that allows use in monetized videos, e.g. CC0 or CC BY with credit).
