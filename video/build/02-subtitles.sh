#!/usr/bin/env bash
# Burn subs.srt into the concatenated video.
# Runs AFTER 03-concat.sh: subs.srt timecodes are written against the full timeline.
# Usage: 02-subtitles.sh [input.mp4] [output.mp4]
set -euo pipefail

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

# shellcheck source=/dev/null
. "$SCRIPT_DIR/video.config"

FINAL_NAME="${FINAL_NAME:-promo}"
SUBS_FONT="${SUBS_FONT:-Arial}"
SUBS_FONTSIZE="${SUBS_FONTSIZE:-24}"
SUBS_MARGINV="${SUBS_MARGINV:-20}"

OUT="$SCRIPT_DIR/out"
SRT="$SCRIPT_DIR/subs.srt"

IN=${1:-"$OUT/$FINAL_NAME-full.mp4"}
DST=${2:-"$OUT/$FINAL_NAME-full-subs.mp4"}

[ -f "$IN" ] || { echo "ERROR: input $IN not found. Run 01b-build-segments.sh and 03-concat.sh first." >&2; exit 1; }

if [ ! -f "$SRT" ]; then
  echo "WARNING: $SRT not found - no subtitles will be burned in."
  echo "WARNING: copying the video as-is. Run make-subs.py and this script again."
  ffmpeg -hide_banner -loglevel error -y -i "$IN" -c copy -movflags +faststart "$DST"
  echo "Copied without subtitles: $DST"
  exit 0
fi

# FontSize is in ASS script units. FFmpeg converts SRT with PlayResY=288, so libass scales
# everything by video_height/288 - FontSize 24 renders as ~60 px on 720p.
STYLE="FontName=$SUBS_FONT,FontSize=$SUBS_FONTSIZE,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=$SUBS_MARGINV,Alignment=2"

# The subtitles filter parses ':' as an option separator, so a Windows absolute path breaks it.
# Run from the directory that holds subs.srt and pass a bare filename.
cd "$SCRIPT_DIR"

ffmpeg -hide_banner -loglevel error -y \
  -i "$IN" \
  -vf "subtitles=subs.srt:force_style='$STYLE'" \
  -c:v libx264 -preset medium -crf 20 -profile:v high -level 4.0 -pix_fmt yuv420p -g 60 \
  -c:a copy \
  -movflags +faststart \
  "$DST"

echo "Subtitles burned in: $DST"
