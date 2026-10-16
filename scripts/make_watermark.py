#!/usr/bin/env python3
"""Genera assets/brand/watermark.png (corona + nome canale, sfondo trasparente).
Uso: make_watermark.py [--top SUBSCRIBER] [--bottom KINGDOM] [--font percorso.ttf]"""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

GOLD, WHITE, SHADOW = (255, 200, 61, 235), (255, 255, 255, 235), (0, 0, 0, 140)
FONTS = ["/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
         "C:/Windows/Fonts/georgiab.ttf", "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"]

def font(path, size):
    for p in [path, *FONTS]:
        if p and Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)

def main():
    a = argparse.ArgumentParser()
    a.add_argument("--top", default="SUBSCRIBER"); a.add_argument("--bottom", default="KINGDOM")
    a.add_argument("--font"); a.add_argument("--out", default="assets/brand/watermark.png")
    a = a.parse_args()
    s = 4  # supersampling per bordi lisci
    W, H = 640 * s, 160 * s
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    crown = [(20, 115), (20, 45), (50, 78), (80, 25), (110, 78), (140, 45), (140, 115)]
    for off, col in ((4, SHADOW), (0, GOLD)):
        d.polygon([((x + off) * s, (y + off) * s) for x, y in crown], fill=col)
        d.rounded_rectangle([(20 + off) * s, (122 + off) * s, (140 + off) * s, (138 + off) * s], 3 * s, fill=col)
    for i, x in enumerate((50, 80, 110)):
        d.ellipse([(x - 6) * s, (95 - 6) * s, (x + 6) * s, (95 + 6) * s], fill=(200, 40, 60, 235) if i == 1 else WHITE)
    f = font(a.font, 50 * s)
    for text, y, col in ((a.top, 22, WHITE), (a.bottom, 80, GOLD)):
        d.text((165 * s, y * s), text, font=f, fill=col, stroke_width=3 * s, stroke_fill=SHADOW)
    img = img.resize((W // s, H // s), Image.LANCZOS)
    img = img.crop(img.getbbox())
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    img.save(a.out); print(a.out, img.size)

if __name__ == "__main__":
    main()
