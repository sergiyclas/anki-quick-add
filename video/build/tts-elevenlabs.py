"""ElevenLabs text-to-speech, plain HTTP, no SDK.

Reads ELEVENLABS_API_KEY from the environment. Called by 00-voiceover.sh when
TTS_ENGINE=elevenlabs, one segment text file per call.

Usage:
    python3 tts-elevenlabs.py --text-file seg01.txt --out seg01.mp3 --voice-id <id>
    python3 tts-elevenlabs.py --list-voices

API reference: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
The default model eleven_multilingual_v2 supports Ukrainian.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

API_BASE = "https://api.elevenlabs.io"
DEFAULT_MODEL = "eleven_multilingual_v2"
DEFAULT_OUTPUT_FORMAT = "mp3_44100_128"


def api_key() -> str:
    key = os.environ.get("ELEVENLABS_API_KEY", "")
    if not key:
        sys.exit("ERROR: ELEVENLABS_API_KEY is not set")
    return key


def request(url: str, payload: dict | None = None) -> bytes:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, method="POST" if data else "GET")
    req.add_header("xi-api-key", api_key())
    if data:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        sys.exit(f"ERROR: ElevenLabs API {error.code}: {detail}")
    except urllib.error.URLError as error:
        sys.exit(f"ERROR: network error calling ElevenLabs: {error.reason}")


def list_voices() -> None:
    body = json.loads(request(f"{API_BASE}/v2/voices").decode("utf-8"))
    for voice in body.get("voices", []):
        labels = ", ".join(f"{k}={v}" for k, v in (voice.get("labels") or {}).items())
        print(f"{voice['voice_id']}  {voice['name']:<20} {voice.get('category', '')}  {labels}")


def synthesize(text_file: Path, out: Path, voice_id: str, model_id: str, output_format: str) -> None:
    text = text_file.read_text(encoding="utf-8").strip()
    if not text:
        sys.exit(f"ERROR: {text_file} is empty")
    url = f"{API_BASE}/v1/text-to-speech/{voice_id}?output_format={output_format}"
    audio = request(url, {"text": text, "model_id": model_id})
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(audio)
    print(f"ok {out} ({len(audio)} bytes, {model_id})")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--text-file", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--voice-id")
    parser.add_argument("--model-id", default=DEFAULT_MODEL)
    parser.add_argument("--output-format", default=DEFAULT_OUTPUT_FORMAT)
    parser.add_argument("--list-voices", action="store_true")
    args = parser.parse_args()

    if args.list_voices:
        list_voices()
        return
    if not args.text_file or not args.out:
        parser.error("--text-file and --out are required (or use --list-voices)")
    if not args.voice_id:
        parser.error("--voice-id is required (find one with --list-voices, "
                     "then set ELEVENLABS_VOICE_ID in video.config)")
    synthesize(args.text_file, args.out, args.voice_id, args.model_id, args.output_format)


if __name__ == "__main__":
    main()
