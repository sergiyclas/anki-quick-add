#!/usr/bin/env bash
# Finalize the video and extract a poster frame.
#
# TARGET_MIB=0 (default): the subtitled cut is already the final quality - just rename
# it into out/FINAL_NAME.mp4. TARGET_MIB>0: two-pass H.264 to fit a hosting size limit
# (e.g. Cloudflare Pages 25 MiB), retrying with a lower bitrate when the result is
# still too big. PUBLISH_DIR (optional) receives a copy of the final mp4 and poster.
set -euo pipefail

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/../.." && pwd)

# shellcheck source=/dev/null
. "$SCRIPT_DIR/video.config"

FINAL_NAME="${FINAL_NAME:-promo}"
TARGET_MIB="${TARGET_MIB:-0}"
LIMIT_MIB="${LIMIT_MIB:-24}"
AUDIO_KBPS="${AUDIO_KBPS:-64}"
PUBLISH_DIR="${PUBLISH_DIR:-}"

OUT="$SCRIPT_DIR/out"
FINAL="$OUT/$FINAL_NAME.mp4"
POSTER="$OUT/$FINAL_NAME-poster.jpg"
PASSLOG="$OUT/ffmpeg2pass"
LIMIT_BYTES=$((LIMIT_MIB * 1024 * 1024))
MAX_ATTEMPTS=3

# Prefer the subtitled cut, fall back to the plain concat.
if [ -f "$OUT/$FINAL_NAME-full-subs.mp4" ]; then
  SRC="$OUT/$FINAL_NAME-full-subs.mp4"
elif [ -f "$OUT/$FINAL_NAME-full.mp4" ]; then
  SRC="$OUT/$FINAL_NAME-full.mp4"
  echo "WARNING: $FINAL_NAME-full-subs.mp4 not found, using the version without subtitles."
else
  echo "ERROR: nothing to finalize. Run 01b, 03-concat.sh and 02-subtitles.sh first." >&2
  exit 1
fi

dur=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$SRC")
[ -n "$dur" ] || { echo "ERROR: cannot read duration of $SRC" >&2; exit 1; }

if [ "$TARGET_MIB" = "0" ]; then
  cp "$SRC" "$FINAL"
  printf 'Final (no size squeeze): %s (%.2f MiB)\n' "$FINAL" \
    "$(awk -v s="$(wc -c < "$FINAL")" 'BEGIN{printf "%.4f", s/1048576}')"
else
  vbitrate=$(awk -v mib="$TARGET_MIB" -v d="$dur" -v a="$AUDIO_KBPS" 'BEGIN{
    total = mib * 1024 * 1024 * 8 / d / 1000;
    v = total - a;
    if (v < 120) v = 120;
    printf "%d", v;
  }')

  echo "Source:   $SRC"
  printf 'Duration: %.2f s\n' "$dur"
  echo "Target:   under $TARGET_MIB MiB (hard limit $LIMIT_MIB MiB)"
  echo

  attempt=1
  while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
    echo "Attempt $attempt/$MAX_ATTEMPTS: two-pass H.264 at ${vbitrate}k video + ${AUDIO_KBPS}k mono AAC"

    echo "  pass 1/2 ..."
    ffmpeg -hide_banner -loglevel error -y \
      -i "$SRC" \
      -c:v libx264 -preset slow -b:v "${vbitrate}k" -pix_fmt yuv420p \
      -pass 1 -passlogfile "$PASSLOG" \
      -an -f null -

    echo "  pass 2/2 ..."
    ffmpeg -hide_banner -loglevel error -y \
      -i "$SRC" \
      -c:v libx264 -preset slow -b:v "${vbitrate}k" -pix_fmt yuv420p \
      -pass 2 -passlogfile "$PASSLOG" \
      -c:a aac -b:a "${AUDIO_KBPS}k" -ac 1 -ar 44100 \
      -movflags +faststart \
      "$FINAL"

    size=$(wc -c < "$FINAL")
    printf '  result: %s bytes (%.2f MiB)\n' "$size" "$(awk -v s="$size" 'BEGIN{printf "%.4f", s/1048576}')"

    if [ "$size" -le "$LIMIT_BYTES" ]; then
      echo "  size is within the limit"
      break
    fi

    if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
      echo "ERROR: still over $LIMIT_MIB MiB after $MAX_ATTEMPTS attempts." >&2
      echo "ERROR: shorten the video or lower TARGET_MIB in video.config." >&2
      rm -f "$PASSLOG"-*.log "$PASSLOG"-*.log.mbtree
      exit 1
    fi

    vbitrate=$(awk -v v="$vbitrate" 'BEGIN{ n = int(v * 0.85); if (n < 120) n = 120; print n }')
    echo "  too big, retrying at ${vbitrate}k"
    attempt=$((attempt + 1))
  done

  rm -f "$PASSLOG"-*.log "$PASSLOG"-*.log.mbtree
fi

# Poster frame from 0:03; fall back to the first frame on very short clips.
poster_ts=$(awk -v d="$dur" 'BEGIN{ if (d > 4) print 3; else print 0 }')
ffmpeg -hide_banner -loglevel error -y \
  -ss "$poster_ts" -i "$FINAL" \
  -frames:v 1 -q:v 3 \
  "$POSTER"

echo
echo "Final:"
printf '  %s  (%.2f MiB)\n' "$FINAL" "$(awk -v s="$(wc -c < "$FINAL")" 'BEGIN{printf "%.4f", s/1048576}')"
printf '  %s  (poster at %ss)\n' "$POSTER" "$poster_ts"

if [ -n "$PUBLISH_DIR" ]; then
  dest="$ROOT/$PUBLISH_DIR"
  mkdir -p "$dest"
  cp "$FINAL" "$dest/"
  cp "$POSTER" "$dest/"
  echo "Published to: $dest"
fi
