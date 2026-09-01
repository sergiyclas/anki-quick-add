#!/usr/bin/env bash
# Build one mp4 per segment out of the rendered PNG frames.
#
# Each frame gets a slow zoom (Ken Burns) and a short fade in and out, so the
# picture is never static and the cuts read as intentional. Encoding parameters
# are identical to the ones 03-concat.sh expects, so segments stream-copy together.
#
# Segment length = max(voiceover + TAIL_SECONDS, slot from segments.conf).
# segments.conf is optional; without it a segment ends shortly after the narration,
# which avoids long silent tails. The frames of a segment split the length evenly.
set -euo pipefail

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH='' cd -- "$SCRIPT_DIR/../.." && pwd)

# shellcheck source=/dev/null
. "$SCRIPT_DIR/video.config"

OUT_W="${OUT_W:-1280}"
OUT_H="${OUT_H:-720}"
FPS="${FPS:-30}"
ZOOM_MAX="${ZOOM_MAX:-1.09}"
FADE="${FADE:-0.45}"
TAIL_SECONDS="${TAIL_SECONDS:-0.7}"

PNG="$SCRIPT_DIR/frames/png"
VOICEOVER="$ROOT/video/voiceover"
OUT="$SCRIPT_DIR/out"
CONF="$SCRIPT_DIR/segments.conf"

# Zoompan works on a supersampled source, otherwise the pan jitters.
SUPER_W=$((OUT_W * 2))
SUPER_H=$((OUT_H * 2))

mkdir -p "$OUT"

if [ ! -d "$PNG" ]; then
  echo "ERROR: no rendered frames. Run 01a-render-frames.sh first" >&2
  exit 1
fi

duration_of() {
  ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$1"
}

slot_of() {
  if [ -f "$CONF" ]; then
    awk -v seg="$1" '$1 == seg { print $2; found = 1 } END { if (!found) print 0 }' "$CONF"
  else
    echo 0
  fi
}

# Segments are whatever the narration step produced.
seg_ids=()
for audio in "$VOICEOVER"/seg*.mp3; do
  [ -e "$audio" ] || continue
  name="$(basename "$audio" .mp3)"
  seg_ids+=("${name#seg}")
done
if [ ${#seg_ids[@]} -eq 0 ]; then
  echo "ERROR: no voiceover files in $VOICEOVER. Run 00-voiceover.sh first" >&2
  exit 1
fi

for i in "${seg_ids[@]}"; do
  audio="$VOICEOVER/seg$i.mp3"

  # A plain glob: it sorts the same way and does not choke on odd filenames. When
  # nothing matches, bash leaves the pattern itself in the array, hence the -e test.
  frames=("$PNG/$i"*.png)
  if [ ! -e "${frames[0]}" ]; then
    echo "ERROR: no frames for segment $i in $PNG" >&2
    exit 1
  fi

  voice=$(duration_of "$audio")
  slot=$(slot_of "$i")
  total=$(awk -v a="$voice" -v t="$TAIL_SECONDS" -v c="$slot" \
    'BEGIN{ n = a + t; printf "%.3f", (c > n ? c : n) }')
  per=$(awk -v t="$total" -v n="${#frames[@]}" 'BEGIN{ printf "%.3f", t / n }')

  echo "seg$i: ${#frames[@]} frame(s), voiceover ${voice}s, slot ${slot}s -> ${per}s per frame"

  inputs=()
  filters=""
  labels=""
  index=0
  for frame in "${frames[@]}"; do
    inputs+=(-loop 1 -t "$per" -i "$frame")
    # Alternate the zoom direction so consecutive frames do not feel identical.
    if [ $((index % 2)) -eq 0 ]; then
      zoom="1+($ZOOM_MAX-1)*on/($per*$FPS)"
    else
      zoom="$ZOOM_MAX-($ZOOM_MAX-1)*on/($per*$FPS)"
    fi
    fade_out=$(awk -v p="$per" -v f="$FADE" 'BEGIN{ printf "%.3f", (p - f > 0 ? p - f : 0) }')
    filters="${filters}[$index:v]scale=$SUPER_W:$SUPER_H,\
zoompan=z='$zoom':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${OUT_W}x${OUT_H}:fps=$FPS,\
fade=t=in:st=0:d=$FADE,fade=t=out:st=$fade_out:d=$FADE,setsar=1,format=yuv420p[v$index];"
    labels="${labels}[v$index]"
    index=$((index + 1))
  done

  ffmpeg -hide_banner -loglevel error -y \
    "${inputs[@]}" -i "$audio" \
    -filter_complex "$filters${labels}concat=n=$index:v=1:a=0[v];\
[$index:a]loudnorm=I=-16:TP=-1.5:LRA=11,\
aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono,apad[a]" \
    -map "[v]" -map "[a]" \
    -t "$total" \
    -c:v libx264 -preset medium -crf 20 -profile:v high -level 4.0 -pix_fmt yuv420p -g 60 \
    -c:a aac -b:a 128k -ar 48000 -ac 1 \
    -movflags +faststart \
    "$OUT/seg$i.mp4"
done

echo
echo "Done. Segments written to $OUT"
ls -1 "$OUT"/seg*.mp4
