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

for f in overlays.py test_overlays.py overlays_integration.patch post-clips.mjs; do
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
if git apply --reverse --check "$HERE/overlays_integration.patch" >/dev/null 2>&1; then
  echo "Already applied."
elif git apply --check "$HERE/overlays_integration.patch" >/dev/null 2>&1; then
  git apply "$HERE/overlays_integration.patch"
  echo "Applied."
else
  fail "The overlay patch does not fit this ShortsFlow checkout. Run: cd $APP && git status"
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

# 6. Launcher ---------------------------------------------------------------------------------------------------------
cat > "$DEST/clip" <<EOF
#!/usr/bin/env bash
# Usage: ./clip my_video.mp4 [extra ShortsFlow options]
# Default: captions + overlay graphics + filler/silence cleanup + punch-in zooms. Output lands in $APP/output.
[ \$# -ge 1 ] || { echo "Usage: \$0 VIDEO_OR_URL [options]"; exit 2; }
SRC="\$1"; shift
cd "$APP"
exec "$DEST/venv/bin/python" main.py --source_video "\$SRC" --extract_mode shorts --smart_crop --tighten \\
  --remove_fillers --use_remotion --caption_style HORMOZI --auto_zoom --overlays --overlay_text_fallback "\$@"
EOF
chmod +x "$DEST/clip"

# 7. Posting to Buffer ----------------------------------------------------------------------------------------------
say "Setting up posting to Buffer"
cp "$HERE/post-clips.mjs" "$DEST/post-clips.mjs"
if [ ! -f "$DEST/.social.env" ]; then
  cat > "$DEST/.social.env" <<'SOCIALENV'
# Used by clip-post. INTERNAL_API_KEY is the same value as in your Vercel environment variables.
INTERNAL_API_KEY=
SITE_URL=https://evan-enterprises-os.vercel.app
SOCIALENV
  chmod 600 "$DEST/.social.env"
fi
cat > "$DEST/clip-post" <<EOF
#!/usr/bin/env bash
# Usage: ./clip-post my_video.mp4 [--send] [--start 2026-12-01T10:00 --every 180] [--dry-run]
# Clips the video, then sends every clip to Buffer for Instagram, Facebook, TikTok, YouTube Shorts and LinkedIn.
# Without --send the clips land as DRAFTS in Buffer, so nothing goes live until you approve it there.
[ \$# -ge 1 ] || { echo "Usage: \$0 VIDEO_OR_URL [--send] [--start ISO --every MINUTES] [--dry-run]"; exit 2; }
SRC="\$1"; shift
POST_ARGS=(); CLIP_ARGS=()
while [ \$# -gt 0 ]; do
  case "\$1" in
    --send|--dry-run|--force) POST_ARGS+=("\$1"); shift ;;
    --start|--every|--only)   POST_ARGS+=("\$1" "\${2:?\$1 needs a value}"); shift 2 ;;
    *) CLIP_ARGS+=("\$1"); shift ;;
  esac
done
SESSION="$APP/sessions/post_\$(date +%s)"
"$DEST/clip" "\$SRC" --session_dir "\$SESSION" "\${CLIP_ARGS[@]}" || exit \$?
exec node "$DEST/post-clips.mjs" "\$SESSION" "\${POST_ARGS[@]}"
EOF
chmod +x "$DEST/clip-post"

# 8. Checks -------------------------------------------------------------------------------------------------------------
say "Running checks"
"$DEST/venv/bin/python" -m pytest tests/test_overlays.py tests/test_broll.py -q -p no:cacheprovider
"$DEST/venv/bin/shortsflow" doctor || true

cat <<EOF

Done. Installed in: $DEST

Try it:
  $DEST/clip ~/Videos/my_video.mp4              # clips only, nothing is posted
  $DEST/clip-post ~/Videos/my_video.mp4         # clips, then sends DRAFTS to Buffer (add --send to queue them)

Before clip-post works, put your INTERNAL_API_KEY in $DEST/.social.env.

Notes:
  * First run downloads the Whisper speech model (needs internet), then works offline.
  * Graphics for words like "love" or "Lego": put transparent PNGs named love.png, lego.png ... in
    $APP/assets/overlays/  -- or add OPENAI_API_KEY to $APP/.env to generate them.
  * Remotion (animated captions) is free for individuals and small teams; check remotion.dev/license before
    charging clients for it at larger scale.
EOF
