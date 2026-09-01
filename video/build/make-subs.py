"""Generate video/build/subs.srt from the narration text and the built segments.

Timings come from two real measurements, not from the script timecodes: the length of
each voiceover file (how long the narration actually lasts) and the length of each built
segment (where the next one starts). Inside a segment the lines are spread proportionally
to their character count, which is close enough for burned-in subtitles.

Run after 01b-build-segments.sh:
    python3 video/build/make-subs.py
"""

import re
import subprocess
import sys
from pathlib import Path

BUILD = Path(__file__).parent
ROOT = BUILD.parents[1]
TEXT = ROOT / "video" / "voiceover" / "text"
AUDIO = ROOT / "video" / "voiceover"
SEGMENTS = BUILD / "out"


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


def duration(path: Path) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


def split_lines(text: str, max_line: int) -> list[str]:
    """Break narration into subtitle-sized chunks at sentence, then word boundaries."""
    chunks: list[str] = []
    for sentence in re.split(r"(?<=[.!?:])\s+", " ".join(text.split())):
        if not sentence:
            continue
        if len(sentence) <= max_line:
            chunks.append(sentence)
            continue
        current = ""
        for word in sentence.split():
            if current and len(current) + 1 + len(word) > max_line:
                chunks.append(current)
                current = word
            else:
                current = f"{current} {word}".strip()
        if current:
            chunks.append(current)
    return chunks


def timestamp(seconds: float) -> str:
    milliseconds = int(round(seconds * 1000))
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    secs, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{milliseconds:03d}"


def build() -> str:
    cfg = load_config()
    max_line = int(cfg.get("SUBS_MAX_LINE", "42"))

    segment_ids = sorted(
        path.stem.removeprefix("seg") for path in TEXT.glob("seg*.txt")
    ) if TEXT.exists() else []
    if not segment_ids:
        print(f"No narration texts in {TEXT}. Run extract-voiceover.py first.",
              file=sys.stderr)
        sys.exit(1)

    missing = [
        str(path) for path in
        [AUDIO / f"seg{i}.mp3" for i in segment_ids] +
        [SEGMENTS / f"seg{i}.mp4" for i in segment_ids]
        if not path.exists()
    ]
    if missing:
        print("Missing inputs:", *missing, sep="\n  ", file=sys.stderr)
        print("\nRun 00-voiceover.sh and 01b-build-segments.sh first.", file=sys.stderr)
        sys.exit(1)

    entries: list[str] = []
    index = 1
    offset = 0.0

    for seg in segment_ids:
        speech = duration(AUDIO / f"seg{seg}.mp3")
        lines = split_lines((TEXT / f"seg{seg}.txt").read_text(encoding="utf-8"), max_line)
        weights = [len(line) for line in lines]
        total_weight = sum(weights) or 1

        cursor = offset
        for line, weight in zip(lines, weights):
            span = speech * weight / total_weight
            entries.append(
                f"{index}\n{timestamp(cursor)} --> {timestamp(cursor + span)}\n{line}\n"
            )
            cursor += span
            index += 1

        offset += duration(SEGMENTS / f"seg{seg}.mp4")

    print(f"{index - 1} subtitle lines, total video {offset:.1f}s")
    return "\n".join(entries)


if __name__ == "__main__":
    (BUILD / "subs.srt").write_text(build(), encoding="utf-8")
    print(f"Written: {BUILD / 'subs.srt'}")
