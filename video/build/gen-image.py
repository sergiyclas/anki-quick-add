"""Image generation via the Gemini API (nano banana), plain HTTP, no SDK.

Reads GEMINI_API_KEY from the environment. Produces one image per call; use it
for illustration frames the HTML/CSS approach cannot draw. On a regional block
(HTTP 403/451) route through a proxy first.

Usage:
    python3 gen-image.py --prompt "..." --out frame.png
    python3 gen-image.py --prompt-file prompt.txt --out frame.png --aspect 16:9 --size 2K

Models (2026): gemini-3.1-flash-image (default), gemini-3-pro-image (best),
gemini-2.5-flash-image (legacy). Aspect ratios: 1:1, 3:2, 2:3, 3:4, 4:3, 4:5,
5:4, 9:16, 16:9, 21:9. Sizes: 1K, 2K, 4K.
API reference: https://ai.google.dev/gemini-api/docs/image-generation
"""

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_MODEL = "gemini-3.1-flash-image"
API_VERSION = os.environ.get("GEMINI_API_VERSION", "v1beta")


def generate(prompt: str, model: str, aspect: str, size: str) -> tuple[bytes, str]:
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        sys.exit("ERROR: GEMINI_API_KEY is not set")

    url = (f"https://generativelanguage.googleapis.com/{API_VERSION}"
           f"/models/{model}:generateContent")
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
            "imageConfig": {"aspectRatio": aspect, "imageSize": size},
        },
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), method="POST")
    req.add_header("x-goog-api-key", key)
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=180) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        if error.code in (403, 451):
            print("HINT: this looks like a regional block, try a US proxy.", file=sys.stderr)
        sys.exit(f"ERROR: Gemini API {error.code}: {detail}")
    except urllib.error.URLError as error:
        sys.exit(f"ERROR: network error calling Gemini: {error.reason}")

    for candidate in body.get("candidates", []):
        for part in candidate.get("content", {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return base64.b64decode(inline["data"]), mime

    sys.exit(f"ERROR: no image in the response: {json.dumps(body)[:2000]}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--prompt")
    group.add_argument("--prompt-file", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--aspect", default="16:9")
    parser.add_argument("--size", default="2K")
    args = parser.parse_args()

    prompt = args.prompt or args.prompt_file.read_text(encoding="utf-8").strip()
    image, mime = generate(prompt, args.model, args.aspect, args.size)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(image)
    print(f"ok {args.out} ({len(image)} bytes, {mime}, {args.model})")


if __name__ == "__main__":
    main()
