#!/usr/bin/env python3
"""Pubblica Reel: instagram.py nome_file.mp4 --caption C
Il file deve essere raggiungibile a IG_VIDEO_PUBLIC_URL_BASE/nome_file.mp4 (requisito Graph API)."""
import argparse, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
import requests
from common import env

API = "https://graph.facebook.com/v21.0"

def main():
    p = argparse.ArgumentParser(); p.add_argument("video"); p.add_argument("--caption", default="")
    a = p.parse_args()
    uid, tok = env("IG_USER_ID"), env("IG_ACCESS_TOKEN")
    url = env("IG_VIDEO_PUBLIC_URL_BASE").rstrip("/") + "/" + os.path.basename(a.video)
    r = requests.post(f"{API}/{uid}/media", data={"media_type": "REELS", "video_url": url,
                      "caption": a.caption, "access_token": tok}, timeout=60)
    r.raise_for_status(); cid = r.json()["id"]
    for _ in range(60):
        s = requests.get(f"{API}/{cid}", params={"fields": "status_code", "access_token": tok}, timeout=30).json()
        if s.get("status_code") == "FINISHED": break
        if s.get("status_code") == "ERROR": raise SystemExit(f"Errore elaborazione: {s}")
        time.sleep(5)
    r = requests.post(f"{API}/{uid}/media_publish", data={"creation_id": cid, "access_token": tok}, timeout=60)
    r.raise_for_status(); print("Pubblicato:", r.json()["id"])

if __name__ == "__main__":
    main()
