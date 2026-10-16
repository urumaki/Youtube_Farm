# Youtube_Farm

Pipeline Blender → video per YouTube (Shorts + lunghi), Instagram Reels, TikTok.

```bash
bash scripts/setup.sh                                   # Blender + ffmpeg
python3 scripts/render.py scenes/demo_text.py --preset short --seconds 8 --text "Ciao"
bash scripts/export.sh output/demo_text_short.mp4 tiktok
```

- `scripts/watermark.sh video.mp4 [tr|tl|br|bl|c]` — watermark (`scripts/make_watermark.py` lo rigenera).
- `presets/presets.json` — formati (short 9:16, long 16:9, square).
- `scenes/` — script bpy; `common.py` per setup render.
- `.claude/skills/` — skill `caveman` (risposte brevi) e `blender-video`.

## Audio e upload

```bash
pip install -r requirements.txt
cp .env.example .env    # inserisci chiavi SOLO qui (.env è in .gitignore)
bash scripts/audio.sh output/x_tiktok.mp4 voce.wav musica.mp3 0.2
python3 uploaders/youtube.py output/x_audio.mp4 --title "Titolo" --short
python3 uploaders/instagram.py output/x_audio.mp4 --caption "..."
python3 uploaders/tiktok.py output/x_audio.mp4
```

Credenziali OAuth/token in `credentials/` (ignorata da git).
