#!/usr/bin/env python3
"""Upload YouTube: youtube.py video.mp4 --title T [--desc D] [--tags a,b] [--short] [--privacy private]"""
import argparse, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import env
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]

def creds():
    tok = env("YOUTUBE_TOKEN_FILE")
    c = Credentials.from_authorized_user_file(tok, SCOPES) if os.path.exists(tok) else None
    if c and c.expired and c.refresh_token:
        c.refresh(Request())
    elif not c or not c.valid:
        c = InstalledAppFlow.from_client_secrets_file(env("YOUTUBE_CLIENT_SECRETS"), SCOPES).run_local_server(port=0)
    os.makedirs(os.path.dirname(tok) or ".", exist_ok=True)
    with open(tok, "w") as f:
        f.write(c.to_json())
    return c

def main():
    p = argparse.ArgumentParser()
    p.add_argument("video"); p.add_argument("--title", required=True)
    p.add_argument("--desc", default=""); p.add_argument("--tags", default="")
    p.add_argument("--short", action="store_true"); p.add_argument("--privacy", default="private")
    a = p.parse_args()
    desc = a.desc + ("\n#Shorts" if a.short else "")
    body = {"snippet": {"title": a.title, "description": desc, "tags": [t for t in a.tags.split(",") if t]},
            "status": {"privacyStatus": a.privacy, "selfDeclaredMadeForKids": False}}
    yt = build("youtube", "v3", credentials=creds())
    req = yt.videos().insert(part="snippet,status", body=body, media_body=MediaFileUpload(a.video, resumable=True))
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    print("https://youtu.be/" + resp["id"])

if __name__ == "__main__":
    main()
