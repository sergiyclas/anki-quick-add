#!/usr/bin/env bash
# Narration from the script text files.
# Engine comes from video.config: elevenlabs (needs ELEVENLABS_API_KEY, falls back
# to edge-tts with a warning) or edge-tts (free, no account, no quota).
# Input:  video/voiceover/text/segNN.txt  (written by extract-voiceover.py)
# Output: video/voiceover/segNN.mp3
#
# Re-running is cheap: only missing or stale files are generated unless FORCE=1.
set -euo pipefail

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/../.." && pwd)

# shellcheck source=/dev/null
. "$SCRIPT_DIR/video.config"

text_dir="$ROOT/video/voiceover/text"
out_dir="$ROOT/video/voiceover"
engine="${TTS_ENGINE:-edge-tts}"
edge_voice="${VOICE:-${EDGE_VOICE:-uk-UA-OstapNeural}}"
force="${FORCE:-0}"

if [ ! -d "$text_dir" ]; then
  echo "No narration texts. Run: python3 video/build/extract-voiceover.py" >&2
  exit 1
fi

if [ "$engine" = "elevenlabs" ] && [ -z "${ELEVENLABS_API_KEY:-}" ]; then
  echo "WARNING: TTS_ENGINE=elevenlabs but ELEVENLABS_API_KEY is not set."
  echo "WARNING: falling back to edge-tts voice $edge_voice."
  engine="edge-tts"
fi

if [ "$engine" = "elevenlabs" ] && [ -z "${ELEVENLABS_VOICE_ID:-}" ]; then
  echo "WARNING: ELEVENLABS_VOICE_ID is empty in video.config."
  echo "WARNING: pick one with: python3 $SCRIPT_DIR/tts-elevenlabs.py --list-voices"
  echo "WARNING: falling back to edge-tts voice $edge_voice."
  engine="edge-tts"
fi

mkdir -p "$out_dir"
count=0

for text_file in "$text_dir"/seg*.txt; do
  name="$(basename "$text_file" .txt)"
  target="$out_dir/$name.mp3"

  # Regenerate when the text is newer than the audio: an edited line that keeps the old
  # mp3 ships a video whose narration silently contradicts the script.
  if [ -f "$target" ] && [ "$force" != "1" ] && [ ! "$text_file" -nt "$target" ]; then
    echo "skip $name (up to date, FORCE=1 to redo)"
    continue
  fi

  if [ "$engine" = "elevenlabs" ]; then
    python3 "$SCRIPT_DIR/tts-elevenlabs.py" \
      --text-file "$text_file" --out "$target" \
      ${ELEVENLABS_VOICE_ID:+--voice-id "$ELEVENLABS_VOICE_ID"}
  else
    python3 -m edge_tts --voice "$edge_voice" --file "$text_file" --write-media "$target"
  fi

  duration="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$target")"
  printf 'ok %s  %.1fs  %s\n' "$name" "$duration" "$engine"
  count=$((count + 1))
done

echo "generated: $count file(s), engine $engine"
