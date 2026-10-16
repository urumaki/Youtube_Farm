#!/usr/bin/env bash
# Installa Blender (headless) e ffmpeg
set -euo pipefail
VER="${BLENDER_VERSION:-4.2.3}"
DIR="${BLENDER_DIR:-$HOME/blender}"
command -v ffmpeg >/dev/null || sudo apt-get install -y ffmpeg
if ! command -v blender >/dev/null && [ ! -x "$DIR/blender" ]; then
  apt-get install -y libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libxkbcommon0 libsm6 2>/dev/null || true
  url="https://download.blender.org/release/Blender${VER%.*}/blender-${VER}-linux-x64.tar.xz"
  mkdir -p "$DIR" && curl -L "$url" | tar -xJ --strip-components=1 -C "$DIR"
  echo "Blender in $DIR (export BLENDER=$DIR/blender)"
fi
