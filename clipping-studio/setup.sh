#!/usr/bin/env bash
# Clipping Studio setup for macOS and Linux (Windows: run this inside WSL2 Ubuntu).
#
# Installs ShortsFlow (MIT) pinned to a known commit, adds the word-synced overlay graphics (--overlays),
# and checks that everything works. Nothing outside the install folder is changed.
#
#   ./setup.sh                      # installs into ~/clipping-studio
#   ./setup.sh --dir /some/folder   # installs somewhere else
#
# Needs: git, Python 3.10+, FFmpeg, Node.js 18+ (animated captions). About 3 GB of disk.
set -euo pipefail

PIN="ec297145d619d13baf1404dca86d52fb5e36c194"      # ShortsFlow commit these overlay files were built and tested on
REPO="https://github.com/ghost1412/shortsflow"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${HOME}/clipping-studio"

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DEST="${2:?--dir needs a folder}"; shift 2 ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

say()  { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

# 1. Tools ---------------------------------------------------------------------------------------------------------
say "Checking tools"
need() { command -v "$1" >/dev/null 2>&1 || fail "$1 is missing. $2"; }
need git    "macOS: xcode-select --install   Ubuntu: sudo apt install git"
need ffmpeg "macOS: brew install ffmpeg      Ubuntu: sudo apt install ffmpeg"
need node   "macOS: brew install node        Ubuntu: sudo apt install nodejs npm (or https://nodejs.org)"
need npm    "Comes with Node.js."
PY=""
for cand in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then
    PY="$cand"; break
  fi
done
[ -n "$PY" ] || fail "Python 3.10 or newer is needed. macOS: brew install python   Ubuntu: sudo apt install python3 python3-venv"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 18+ is needed (found $(node -v))."
echo "git, ffmpeg, $($PY --version), node $(node -v): OK"

for f in overlays.py test_overlays.py screen_cam.py test_screen_cam.py overlays_integration.patch; do
  [ -f "$HERE/$f" ] || fail "$f is missing next to setup.sh. Keep the whole clipping-studio folder together."
done

# 2. ShortsFlow at the pinned commit -------------------------------------------------------------------------------
say "Getting ShortsFlow into $DEST"
mkdir -p "$DEST"
APP="$DEST/shortsflow"
if [ ! -d "$APP/.git" ]; then
  git clone --quiet "$REPO" "$APP"
fi
cd "$APP"
git fetch --quiet origin "$PIN" 2>/dev/null || git fetch --quiet origin
if git diff --quiet && git diff --cached --quiet; then
  git checkout --quiet "$PIN"
else
  echo "Your edits in $APP are kept; not switching commits."
fi

# 3. Overlay graphics (idempotent) --------------------------------------------------------------------------------
say "Adding the overlay graphics feature"
cp "$HERE/overlays.py" engine/overlays.py
cp "$HERE/test_overlays.py" tests/test_overlays.py
cp "$HERE/screen_cam.py" engine/screen_cam.py
cp "$HERE/test_screen_cam.py" tests/test_screen_cam.py
if git apply --reverse --check "$HERE/overlays_integration.patch" >/dev/null 2>&1; then
  echo "Already applied."
elif git apply --check "$HERE/overlays_integration.patch" >/dev/null 2>&1; then
  git apply "$HERE/overlays_integration.patch"
  echo "Applied."
else
  echo "Updating the overlay patch from an older version..."
  git checkout --quiet "$PIN" -- engine/modes/clip_extract.py shortsflow/_main.py engine/video_gen.py remotion-video/src/ShortFlow.tsx
  git apply --check "$HERE/overlays_integration.patch" >/dev/null 2>&1 \
    || fail "The overlay patch does not fit this ShortsFlow checkout. Run: cd $APP && git status"
  git apply "$HERE/overlays_integration.patch"
  echo "Applied."
fi
mkdir -p assets/overlays      # drop your own transparent PNGs here (love.png, lego.png, ...)

# 4. Python environment + Remotion captions ------------------------------------------------------------------------
say "Installing Python packages (a few minutes; the Whisper speech model downloads on first use)"
if [ ! -x "$DEST/venv/bin/python" ]; then "$PY" -m venv "$DEST/venv"; fi
"$DEST/venv/bin/python" -m pip install --quiet --upgrade pip
"$DEST/venv/bin/python" -m pip install --quiet -e ".[clip]" pytest

say "Installing animated-caption renderer (Remotion)"
( cd remotion-video && npm install --no-audit --no-fund --silent )

# 5. Settings file ----------------------------------------------------------------------------------------------------
if [ ! -f .env ]; then
  cat > .env <<'EOF'
# Optional. Clipping and captions work with none of these.
# OPENAI_API_KEY=       # generates transparent graphics for --overlays when you have no PNG for a word
# GROQ_API_KEY=         # free; AI-picked moments and titles (console.groq.com)
# PEXELS_API_KEY=       # free; stock cutaways for --broll (pexels.com/api)
EOF
  chmod 600 .env
fi

# 5b. Ready-made clip plans
mkdir -p "$DEST/plans"
cp "$HERE"/plans/*.txt "$DEST/plans/" 2>/dev/null || true

# 6. Launcher ---------------------------------------------------------------------------------------------------------
cat > "$DEST/clip" <<EOF
#!/usr/bin/env bash
# Usage: ./clip my_video.mp4 [extra ShortsFlow options]
# Default: captions + overlay graphics + filler/silence cleanup + punch-in zooms. Output lands in $APP/output.
[ \$# -ge 1 ] || { echo "Usage: \$0 VIDEO_OR_URL [options]"; exit 2; }
SRC="\$1"; shift
cd "$APP"
exec "$DEST/venv/bin/python" main.py --source_video "\$SRC" --extract_mode shorts --smart_crop --tighten \\
  --remove_fillers --use_remotion --caption_style HORMOZI --caption_color "#A855F7" --auto_zoom --overlays --overlay_text_fallback "\$@"
EOF
chmod +x "$DEST/clip"

cat > "$DEST/clip-screen" <<EOF
#!/usr/bin/env bash
# For screen recordings with a small webcam: webcam on the top third, the screen below it, zoomed on what changes.
# Usage: ./clip-screen VIDEO [PLAN_FILE] [options]
#   PLAN_FILE (optional) = a text file of the moments to cut, one "start-end title" per line (examples: $DEST/plans).
# Add  --cam_box x,y,w,h  (shares of the frame, e.g. 0.01,0.65,0.29,0.31) if the webcam is not found by itself.
[ \$# -ge 1 ] || { echo "Usage: \$0 VIDEO [PLAN_FILE] [options]"; exit 2; }
SRC="\$1"; shift
PLAN=""
if [ \$# -ge 1 ] && [ -f "\$1" ] && [[ "\$1" == *.txt || "\$1" == *.json ]]; then PLAN="\$1"; shift; fi
cd "$APP"
if [ -n "\$PLAN" ]; then set -- --clip_plan "\$PLAN" "\$@"; fi
exec "$DEST/venv/bin/python" main.py --source_video "\$SRC" --extract_mode shorts --layout screen_cam --tighten \\
  --remove_fillers --use_remotion --caption_style HORMOZI --caption_color "#A855F7" --auto_zoom --overlays --overlay_text_fallback "\$@"
EOF
chmod +x "$DEST/clip-screen"

# 7. Checks -------------------------------------------------------------------------------------------------------------
say "Running checks"
"$DEST/venv/bin/python" -m pytest tests/test_overlays.py tests/test_screen_cam.py tests/test_broll.py -q -p no:cacheprovider
"$DEST/venv/bin/shortsflow" doctor || true

cat <<EOF

Done. Installed in: $DEST

Try it:
  $DEST/clip ~/Videos/my_video.mp4                                               (talking-head videos)
  $DEST/clip-screen ~/Videos/my_video.mp4 $DEST/plans/inboxrev_book-calls.txt    (screen recording + webcam, exact moments)

Notes:
  * First run downloads the Whisper speech model (needs internet), then works offline.
  * Graphics for words like "love" or "Lego": put transparent PNGs named love.png, lego.png ... in
    $APP/assets/overlays/  -- or add OPENAI_API_KEY to $APP/.env to generate them.
  * Remotion (animated captions) is free for individuals and small teams; check remotion.dev/license before
    charging clients for it at larger scale.
EOF
