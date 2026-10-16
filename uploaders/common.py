"""Carica segreti da .env / ambiente. Mai hardcodare chiavi."""
import os
from dotenv import load_dotenv

load_dotenv()

def env(name):
    v = os.environ.get(name)
    if not v:
        raise SystemExit(f"Variabile mancante: {name} (vedi .env.example)")
    return v
