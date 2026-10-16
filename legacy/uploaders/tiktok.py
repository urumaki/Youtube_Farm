#!/usr/bin/env python3
"""Upload TikTok (Content Posting API, inbox/draft): tiktok.py video.mp4
Il video arriva nelle bozze dell'app TikTok; app non verificate non possono pubblicare direttamente."""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import requests
from common import env

def main():
    p = argparse.ArgumentParser(); p.add_argument("video"); a = p.parse_args()
    size = os.path.getsize(a.video)
    h = {"Authorization": f"Bearer {env('TIKTOK_ACCESS_TOKEN')}", "Content-Type": "application/json; charset=UTF-8"}
    r = requests.post("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", headers=h, timeout=60,
                      json={"source_info": {"source": "FILE_UPLOAD", "video_size": size,
                                            "chunk_size": size, "total_chunk_count": 1}})
    r.raise_for_status(); d = r.json()["data"]
    with open(a.video, "rb") as f:
        u = requests.put(d["upload_url"], data=f, timeout=600, headers={
            "Content-Type": "video/mp4", "Content-Range": f"bytes 0-{size-1}/{size}"})
    u.raise_for_status(); print("Caricato in bozze TikTok, publish_id:", d["publish_id"])

if __name__ == "__main__":
    main()
