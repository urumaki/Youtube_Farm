#!/usr/bin/env bash
# Applica watermark: watermark.sh video.mp4 [posizione=tr|tl|br|bl|c] [larghezza_%=22] [opacità=0.8]
set -euo pipefail
v="$1"; pos="${2:-tr}"; pct="${3:-22}"; op="${4:-0.8}"
wm="$(dirname "$0")/../assets/brand/watermark.png"; out="${v%.*}_wm.mp4"
[ -f "$wm" ] || python3 "$(dirname "$0")/make_watermark.py" --out "$wm"
m=40
case "$pos" in
  tl) xy="$m:$m" ;; tr) xy="W-w-$m:$m" ;; bl) xy="$m:H-h-$m" ;; br) xy="W-w-$m:H-h-$m" ;; c) xy="(W-w)/2:(H-h)/2" ;;
  *) echo "posizione: tr|tl|br|bl|c"; exit 1 ;;
esac
ffmpeg -y -i "$v" -i "$wm" -filter_complex \
  "[1:v][0:v]scale2ref=w=iw*$pct/100:h=ow/mdar[wm][base];[wm]format=rgba,colorchannelmixer=aa=$op[wm2];[base][wm2]overlay=$xy" \
  -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a copy -movflags +faststart "$out"
echo "$out"
