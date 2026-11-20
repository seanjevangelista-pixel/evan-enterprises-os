# Clipping Studio

Cuts long videos into captioned vertical clips with graphics. Built on [ShortsFlow](https://github.com/ghost1412/shortsflow) (MIT)
with additions made for Evan Enterprises. Runs on your own computer, no per-video fee.

## Install or update (Mac or Linux; Windows: use WSL2 Ubuntu)

```bash
brew install git python@3.12 ffmpeg node          # Mac, first time only
cd ~/evan-enterprises-os && git pull               # use the branch that has this folder
cd clipping-studio && ./setup.sh                   # installs into ~/clipping-studio, safe to re-run
```

`setup.sh` ends with a pass/fail check. The three `FIX` lines (voice, AI key, Pexels key) are optional.

## Run it

| Video type | Command |
|---|---|
| Someone talking to camera | `~/clipping-studio/clip VIDEO.mp4` |
| Screen recording with a small webcam | `~/clipping-studio/clip-screen VIDEO.mp4 PLAN.txt` |

Finished clips land in `~/clipping-studio/shortsflow/sessions/extraction_<number>/` (the log prints the exact folder).
The first run downloads the speech model and needs internet. A 14-minute video took about 10 minutes on a MacBook.

## Choose the moments yourself: plan files

A text file, one moment per line: `start-end title` (times `m:ss`, `h:mm:ss` or seconds). Lines starting with `#` are ignored.
Examples for the two Inbox Rev videos are in `plans/` (copied to `~/clipping-studio/plans/`). Times can be off by 1-3 seconds:
nudge them after you watch the first run. Without a plan file the software guesses, and with no AI key it guesses poorly.

## What the layouts and extras do

- **`clip-screen` / `--layout screen_cam`:** webcam on the top third, the screen below it, zoomed onto the page content so small
  text is readable. Captions sit in the gap between them. Moments where the speaker fills the frame use the normal face crop.
  If the webcam isn't found, add `--cam_box x,y,w,h` (shares of the frame, e.g. `0.01,0.65,0.29,0.31`).
- **Captions:** the active word is purple (`#A855F7`), the other words white, word by word. Change the color with `--caption_color "#RRGGBB"`.
- **Progress bar** along the bottom of every clip.
- **Graphics** pop in on spoken words, clear of the face: a growing bar graph (results, scaling), coins (money, million),
  email, calendar (meetings), phone (calls), sales funnel (leads), clock, heart, light bulb, target, trophy. They are drawn in
  code. Put your own transparent PNG in `~/clipping-studio/shortsflow/assets/overlays/` (named like `love.png`) and yours wins.
  List of words and prompts for your own art: the "Overlay Graphics Library" sheet in Drive.
- **`--no_overlay_face_aware`**, **`--overlay_position`**, **`--overlay_text_fallback`**: placement and fallback options.

## Not built / known limits

- No graphic of a specific person's face (needs their photo).
- Written titles and descriptions need an AI key (free: GROQ_API_KEY from console.groq.com in `shortsflow/.env`). Clips work without it.
- The purple Remotion captions and the page zoom were verified on test footage, not on every kind of recording.
- A small hook-title card flashed at the start of one early clip; the cause isn't known.
- Remotion (the caption renderer) is free for individuals and small teams. Check remotion.dev/license before charging clients at scale.

## Troubleshooting

- `FileNotFoundError: Source video Not Found`: the path is wrong. `ls -lt ~/Downloads | head` shows what's there.
- Empty `extraction_` folder: it is still running (clips appear at the end). Check Terminal for the `$` prompt.
- `[Warning] ... LLM providers failed`: only titles/descriptions are affected. Safe to ignore.
