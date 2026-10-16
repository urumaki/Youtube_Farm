#!/usr/bin/env bash
# Ricodifica per piattaforma: export.sh input.mp4 youtube|instagram|tiktok|youtube_long
set -euo pipefail
in="$1"; plat="$2"; out="${in%.*}_${plat}.mp4"
case "$plat" in
  youtube|instagram|tiktok) vf="scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"; max=(-t 60) ;;
  youtube_long) vf="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"; max=() ;;
  *) echo "piattaforma sconosciuta"; exit 1 ;;
esac
[ "$plat" = instagram ] && max=(-t 90)
[ "$plat" = tiktok ] && max=(-t 180)
ffmpeg -y -i "$in" "${max[@]}" -vf "$vf" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 \
  -c:a aac -b:a 192k -movflags +faststart "$out"
echo "$out"
