---
name: blender-video
description: Crea animazioni Blender e renderizza Shorts/Reels/TikTok (9:16) e video lunghi YouTube (16:9). Usa per generare scene, renderizzare ed esportare video social.
---
Pipeline:
1. `bash scripts/setup.sh` — installa Blender + ffmpeg (una volta).
2. Scena: modifica/crea script in `scenes/` (Python bpy). Esempio: `scenes/demo_text.py`.
3. Render: `python3 scripts/render.py scenes/demo_text.py --preset short --text "Ciao"`
   Preset in `presets/presets.json`: short (1080x1920, 60s max), long (1920x1080), square (1080x1080).
4. Export per piattaforma: `bash scripts/export.sh output/<file>.mp4 <youtube|instagram|tiktok|youtube_long>`
5. Usa Eevee per velocità; Cycles solo se serve qualità.
