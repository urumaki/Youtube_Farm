#!/usr/bin/env bash
# Aggiunge voce e/o musica: audio.sh video.mp4 [voce.wav|-] [musica.mp3|-] [vol_musica=0.2]
set -euo pipefail
v="$1"; voice="${2:--}"; music="${3:--}"; mv="${4:-0.2}"; out="${v%.*}_audio.mp4"
in=(-i "$v"); f=""; n=1; maps=()
if [ "$voice" != - ]; then in+=(-i "$voice"); f+="[$n:a]volume=1.0[vo];"; maps+=("[vo]"); n=$((n+1)); fi
if [ "$music" != - ]; then in+=(-stream_loop -1 -i "$music"); f+="[$n:a]volume=$mv[mu];"; maps+=("[mu]"); fi
[ ${#maps[@]} -eq 0 ] && { echo "nessun audio"; exit 1; }
f+="$(printf '%s' "${maps[@]}")amix=inputs=${#maps[@]}:duration=first:normalize=0[a]"
ffmpeg -y "${in[@]}" -filter_complex "$f" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest "$out"
echo "$out"
