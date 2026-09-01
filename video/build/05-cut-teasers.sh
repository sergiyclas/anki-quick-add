#!/usr/bin/env bash
# Cut ad teasers out of the finished video, each in 9:16 (1080x1920) and 1:1 (1080x1080).
# Source is the subtitled cut, so the teasers keep the burned-in subtitles.
#
# Teasers are defined in teasers.conf, one per line:
#   name  segID[:maxdur]  [segID:maxdur]
# e.g. "v1 01:13 03:15" = 13s from the start of segment 01 + 15s from segment 03.
# Offsets are measured from the built segments (ffprobe), never guessed.
set -euo pipefail

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/../.." && pwd)

# shellcheck source=/dev/null
. "$SCRIPT_DIR/video.config"

FINAL_NAME="${FINAL_NAME:-promo}"
OUT="$SCRIPT_DIR/out"
CUTS="$ROOT/video/cuts"
CONF="$SCRIPT_DIR/teasers.conf"

[ -f "$CONF" ] || { echo "ERROR: $CONF not found. Copy teasers.conf.example and adjust." >&2; exit 1; }

if [ -f "$OUT/$FINAL_NAME-full-subs.mp4" ]; then
  SRC="$OUT/$FINAL_NAME-full-subs.mp4"
elif [ -f "$OUT/$FINAL_NAME-full.mp4" ]; then
  SRC="$OUT/$FINAL_NAME-full.mp4"
  echo "WARNING: subtitled cut not found, teasers will have no subtitles."
else
  echo "ERROR: no source video. Run 01b, 03-concat.sh and 02-subtitles.sh first." >&2
  exit 1
fi

mkdir -p "$CUTS"

duration_of() {
  ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$1"
}

# Segment offsets inside the final video, measured from the built segments.
declare -A seg_start seg_dur
acc=0
found=0
for f in "$OUT"/seg*.mp4; do
  [ -e "$f" ] || continue
  id="$(basename "$f" .mp4)"; id="${id#seg}"
  d=$(duration_of "$f")
  seg_start[$id]="$acc"
  seg_dur[$id]="$d"
  acc=$(awk -v a="$acc" -v d="$d" 'BEGIN{printf "%.3f", a+d}')
  found=1
done
[ "$found" = "1" ] || { echo "ERROR: no built segments in $OUT" >&2; exit 1; }

clamp() { # $1 = available duration, $2 = wanted duration
  awk -v a="$1" -v w="$2" 'BEGIN{ if (a < w) printf "%.3f", a; else printf "%.3f", w }'
}

resolve() { # $1 = segID[:maxdur] -> "start dur"
  local spec="$1" id want avail
  id="${spec%%:*}"
  want="${spec#*:}"
  { [ "$want" = "$id" ] || [ -z "$want" ]; } && want=9999
  [ -n "${seg_start[$id]:-}" ] || { echo "ERROR: segment $id not found for teaser spec '$spec'" >&2; exit 1; }
  avail="${seg_dur[$id]}"
  printf '%s %s' "${seg_start[$id]}" "$(clamp "$avail" "$want")"
}

# Blurred-background frame: the full source picture is never cropped, the padding around it
# is a zoomed and blurred copy of the same frame.
frame_filter() { # $1 = input label, $2 = width, $3 = height
  printf '%s' "[$1]split=2[bg][fg];\
[bg]scale=$2:$3:force_original_aspect_ratio=increase,crop=$2:$3,gblur=sigma=50,eq=brightness=-0.12[bgb];\
[fg]scale=$2:-2[fgs];\
[bgb][fgs]overlay=(W-w)/2:(H-h)/2,setsar=1,format=yuv420p[v]"
}

ENC="-c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -r 30 -c:a aac -b:a 128k -ar 48000 -ac 1 -movflags +faststart"

cut_single() { # $1 = output, $2 = width, $3 = height, $4 = start, $5 = duration
  echo "  $1  ($2x$3, ${5}s from ${4}s)"
  # shellcheck disable=SC2086
  ffmpeg -hide_banner -loglevel error -y \
    -ss "$4" -t "$5" -i "$SRC" \
    -filter_complex "$(frame_filter 0:v "$2" "$3")" \
    -map "[v]" -map 0:a $ENC "$1"
}

cut_double() { # $1 = output, $2 = w, $3 = h, $4/$5 = start/dur A, $6/$7 = start/dur B
  echo "  $1  ($2x$3, ${5}s from ${4}s + ${7}s from ${6}s)"
  # shellcheck disable=SC2086
  ffmpeg -hide_banner -loglevel error -y \
    -ss "$4" -t "$5" -i "$SRC" \
    -ss "$6" -t "$7" -i "$SRC" \
    -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[cv][ca];$(frame_filter cv "$2" "$3")" \
    -map "[v]" -map "[ca]" $ENC "$1"
}

echo "Cutting teasers into $CUTS"

while read -r name spec_a spec_b _; do
  case "$name" in ""|\#*) continue ;; esac
  read -r a_start a_dur <<< "$(resolve "$spec_a")"
  [ -n "$a_start" ] || exit 1
  if [ -n "${spec_b:-}" ]; then
    read -r b_start b_dur <<< "$(resolve "$spec_b")"
    [ -n "$b_start" ] || exit 1
    cut_double "$CUTS/$name-9x16.mp4" 1080 1920 "$a_start" "$a_dur" "$b_start" "$b_dur"
    cut_double "$CUTS/$name-1x1.mp4"  1080 1080 "$a_start" "$a_dur" "$b_start" "$b_dur"
  else
    cut_single "$CUTS/$name-9x16.mp4" 1080 1920 "$a_start" "$a_dur"
    cut_single "$CUTS/$name-1x1.mp4"  1080 1080 "$a_start" "$a_dur"
  fi
done < "$CONF"

echo
echo "Done:"
for f in "$CUTS"/*.mp4; do
  [ -e "$f" ] || continue
  printf '  %-24s %6.2f s  %6.2f MiB\n' "$(basename "$f")" \
    "$(duration_of "$f")" "$(awk -v s="$(wc -c < "$f")" 'BEGIN{printf "%.4f", s/1048576}')"
done
