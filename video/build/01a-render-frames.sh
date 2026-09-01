#!/usr/bin/env bash
# Render the HTML frames to PNG with headless Chromium at RENDER_WxRENDER_H.
# Input:  video/build/frames/out/*.html  (written by frames/make-frames.py)
# Output: video/build/frames/png/*.png
#
# Playwright's own CLI is used so the project needs no browser automation code.
set -euo pipefail

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)

# shellcheck source=/dev/null
. "$SCRIPT_DIR/video.config"

RENDER_W="${RENDER_W:-1920}"
RENDER_H="${RENDER_H:-1080}"

html_dir="$SCRIPT_DIR/frames/out"
png_dir="$SCRIPT_DIR/frames/png"

if [ ! -d "$html_dir" ]; then
  echo "No frames. Run: python3 video/build/frames/make-frames.py" >&2
  exit 1
fi

html_files=("$html_dir"/*.html)
if [ ! -e "${html_files[0]}" ]; then
  echo "ERROR: no *.html files in $html_dir - make-frames.py produced nothing" >&2
  exit 1
fi

mkdir -p "$png_dir"
count=0

# Chromium needs a real file URL. Git Bash reports paths as /d/... or /tmp/...,
# which Windows Chromium cannot open; cygpath -m turns them into d:/... form.
to_file_url() {
  local path="$1"
  if command -v cygpath >/dev/null 2>&1; then
    printf 'file:///%s' "$(cygpath -m "$path")"
  else
    printf 'file://%s' "$path"
  fi
}

render_log="$png_dir/.render.log"
for html_file in "${html_files[@]}"; do
  name="$(basename "$html_file" .html)"
  target="$png_dir/$name.png"
  url="$(to_file_url "$html_file")"

  # Playwright output goes to a log so a failure is diagnosable (first run
  # downloads the browser, sandboxes differ between machines).
  npx --yes playwright screenshot \
    --viewport-size="$RENDER_W,$RENDER_H" \
    --browser=chromium \
    --wait-for-timeout=400 \
    "$url" "$target" >"$render_log" 2>&1 || true

  if [ ! -s "$target" ]; then
    echo "::error::failed to render $name" >&2
    cat "$render_log" >&2
    exit 1
  fi
  echo "ok $name"
  count=$((count + 1))
done

echo "rendered: $count frame(s) into $png_dir"
