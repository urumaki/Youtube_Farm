# Youtube_Farm

Pipeline Blender → video per YouTube (Shorts + lunghi), Instagram Reels, TikTok.

```bash
bash scripts/setup.sh                                   # Blender + ffmpeg
python3 scripts/render.py scenes/demo_text.py --preset short --seconds 8 --text "Ciao"
bash scripts/export.sh output/demo_text_short.mp4 tiktok
```

- `presets/presets.json` — formati (short 9:16, long 16:9, square).
- `scenes/` — script bpy; `common.py` per setup render.
- `.claude/skills/` — skill `caveman` (risposte brevi) e `blender-video`.
