#!/usr/bin/env bash
# Join the built segments into one file with the concat demuxer (stream copy, no re-encode).
set -euo pipefail

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

# shellcheck source=/dev/null
. "$SCRIPT_DIR/video.config"

FINAL_NAME="${FINAL_NAME:-promo}"
OUT="$SCRIPT_DIR/out"
LIST="$OUT/concat.txt"
FULL="$OUT/$FINAL_NAME-full.mp4"

[ -d "$OUT" ] || { echo "ERROR: $OUT does not exist. Run 01b-build-segments.sh first." >&2; exit 1; }

segments=("$OUT"/seg*.mp4)
if [ ! -e "${segments[0]}" ]; then
  echo "ERROR: no segments in $OUT. Run 01b-build-segments.sh first." >&2
  exit 1
fi

: > "$LIST"
for f in "${segments[@]}"; do
  # Paths inside the list are resolved relative to the list file, so a bare name is enough
  # and avoids Windows drive-letter quoting problems.
  printf "file '%s'\n" "$(basename "$f")" >> "$LIST"
done

ffmpeg -hide_banner -loglevel error -y \
  -f concat -safe 0 -i "$LIST" \
  -c copy -movflags +faststart \
  "$FULL"

dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$FULL")
size=$(wc -c < "$FULL")
printf 'Concat done: %s (%d segments)\n' "$FULL" "${#segments[@]}"
printf 'Duration: %.2f s   Size: %.1f MiB\n' "$dur" "$(awk -v s="$size" 'BEGIN{printf "%.4f", s/1048576}')"
