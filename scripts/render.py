#!/usr/bin/env python3
"""Lancia Blender headless su uno script di scena con un preset di formato."""
import argparse, json, os, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def find_blender():
    for c in (os.environ.get("BLENDER"), shutil.which("blender"), str(Path.home() / "blender/blender")):
        if c and Path(c).exists():
            return c
    sys.exit("Blender non trovato: esegui scripts/setup.sh")

def main():
    p = argparse.ArgumentParser()
    p.add_argument("scene")
    p.add_argument("--preset", default="short", choices=json.loads((ROOT / "presets/presets.json").read_text()))
    p.add_argument("--seconds", type=float, default=10)
    p.add_argument("--text", default="Hello")
    p.add_argument("--out", default=None)
    a = p.parse_args()
    cfg = json.loads((ROOT / "presets/presets.json").read_text())[a.preset]
    if cfg["max_seconds"] and a.seconds > cfg["max_seconds"]:
        sys.exit(f"{a.preset}: max {cfg['max_seconds']}s")
    out = a.out or str(ROOT / "output" / f"{Path(a.scene).stem}_{a.preset}.mp4")
    env = dict(os.environ, VF_WIDTH=str(cfg["width"]), VF_HEIGHT=str(cfg["height"]),
               VF_FPS=str(cfg["fps"]), VF_SECONDS=str(a.seconds), VF_TEXT=a.text, VF_OUT=out)
    subprocess.run([find_blender(), "-b", "--factory-startup", "-P", a.scene], env=env, check=True)
    print(out)

if __name__ == "__main__":
    main()
