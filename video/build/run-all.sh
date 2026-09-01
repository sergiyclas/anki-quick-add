#!/usr/bin/env bash
# Full build, from the script to the final video. No camera, no screen recording:
# frames are HTML rendered to PNG, the narration is generated speech.
#
# Order matters: subtitles are timed against the whole timeline, so they come after the
# segments exist; they are burned in after concat because the timing is global.
# Teasers (05-cut-teasers.sh) stay a separate step - run them once the video is approved.
set -euo pipefail

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

[ -f "$SCRIPT_DIR/video.config" ] || {
  echo "ERROR: $SCRIPT_DIR/video.config not found. Copy video.config.example and adjust." >&2
  exit 1
}

banner() {
  echo "=============================================================="
  echo "== $1"
  echo "=============================================================="
}

banner "extract-voiceover.py"
python3 "$SCRIPT_DIR/extract-voiceover.py"
echo

banner "00-voiceover.sh"
bash "$SCRIPT_DIR/00-voiceover.sh"
echo

# make-frames.py is written per product: it turns the storyboard into HTML frames.
if [ -f "$SCRIPT_DIR/frames/make-frames.py" ]; then
  banner "frames/make-frames.py"
  python3 "$SCRIPT_DIR/frames/make-frames.py"
  echo
else
  echo "ERROR: $SCRIPT_DIR/frames/make-frames.py not found." >&2
  echo "ERROR: write it for this product (it generates frames/out/NNx-name.html)." >&2
  exit 1
fi

for step in 01a-render-frames.sh 01b-build-segments.sh; do
  banner "$step"
  bash "$SCRIPT_DIR/$step"
  echo
done

banner "make-subs.py"
python3 "$SCRIPT_DIR/make-subs.py"
echo

for step in 03-concat.sh 02-subtitles.sh 04-compress.sh; do
  banner "$step"
  bash "$SCRIPT_DIR/$step"
  echo
done

echo "=============================================================="
echo "== Build finished"
echo "=============================================================="
echo "Final video: video/build/out/ (see 04-compress.sh output above)"
echo "Teasers:     run 05-cut-teasers.sh"
