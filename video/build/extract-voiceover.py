"""Extract the narration of each segment from the video script into plain text files.

The script markdown (SCRIPT_MD in video.config) holds one heading per segment
("## Сегмент NN" or "## Segment NN") followed by screen descriptions and
quoted narration lines (">"). Only the quoted lines are spoken.

Run: python3 video/build/extract-voiceover.py
"""

import re
import sys
from pathlib import Path

BUILD = Path(__file__).parent
ROOT = BUILD.parents[1]

SEGMENT_HEADING = re.compile(r"^## (?:Сегмент|Segment) (\d{2})")


def load_config() -> dict[str, str]:
    cfg: dict[str, str] = {}
    path = BUILD / "video.config"
    if not path.exists():
        sys.exit(f"ERROR: {path} not found. Copy video.config.example and adjust.")
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        cfg[key.strip()] = value.split("#", 1)[0].strip().strip('"')
    return cfg


def extract():
    cfg = load_config()
    script = ROOT / cfg.get("SCRIPT_MD", "video/script.md")
    if not script.exists():
        sys.exit(f"ERROR: script not found: {script}")

    out = ROOT / "video" / "voiceover" / "text"
    out.mkdir(parents=True, exist_ok=True)

    segments: dict[str, list[str]] = {}
    current = None

    for line in script.read_text(encoding="utf-8").splitlines():
        heading = SEGMENT_HEADING.match(line)
        if heading:
            current = heading.group(1)
            segments[current] = []
        elif line.startswith("---"):
            current = None
        elif current and line.startswith(">"):
            segments[current].append(line.lstrip("> ").strip())

    if not segments:
        sys.exit(f"ERROR: no '## Сегмент NN' / '## Segment NN' headings in {script}")

    # Drop texts for segments that no longer exist in the script.
    for stale in out.glob("seg*.txt"):
        if stale.stem.removeprefix("seg") not in segments:
            stale.unlink()

    total = 0
    for number, lines in segments.items():
        # Blank quote lines separate paragraphs; keep them as paragraph breaks.
        text = "\n".join(lines).replace("\n\n\n", "\n\n").strip() + "\n"
        path = out / f"seg{number}.txt"
        # Unchanged text keeps its mtime, so 00-voiceover.sh skips the (paid) TTS call.
        if not path.exists() or path.read_text(encoding="utf-8") != text:
            path.write_text(text, encoding="utf-8")
        total += len(text) - 1
        print(f"seg{number}.txt  {len(text) - 1:>5} chars")

    print(f"\nSegments: {len(segments)}, {total} chars total")
    return segments, total


if __name__ == "__main__":
    extract()
