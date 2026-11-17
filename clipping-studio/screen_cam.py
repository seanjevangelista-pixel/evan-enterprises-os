"""`--layout screen_cam`: the speaker's webcam on the top third, what they are showing (the screen) below it, and
`--clip_plan`: cut exactly the moments you choose instead of letting the program guess.

screen_cam (for screen recordings with a small webcam in a corner):
  * top    1/3  the webcam, found with the same face detector the crop uses (or `--cam_box x,y,w,h`, shares of the frame)
  * below       the WHOLE screen picture at full width (nothing cropped off the sides), zoomed in on the part of the screen
                that changes (engine.screen_region), over a blurred copy of itself
  * captions    sit in the gap under the webcam, clear of the speaker and of the screen content
When no webcam face is found and no --cam_box is given, the clip falls back to the plain `fit` layout.

clip_plan: a text or JSON file with the moments to cut, one per line, e.g.
    4:12-4:41  Claude objections -> close rate
    7:33-7:57  Do not go direct offer
or JSON: [{"start": 252, "end": 281, "title": "Claude objections"}].  Times are m:ss, h:mm:ss or seconds.
"""
import json
import re

CAM_FRAC = 1 / 3            # share of the frame height for the webcam
CAPTION_Y = 700             # Remotion caption top edge for screen_cam: in the gap under the webcam
MIN_FACE_DIV = 40           # a webcam inset is small: a face counts when it is at least 1/40 of the frame wide
TALKING_HEAD = 0.22         # a face taller than this share of the frame means the webcam is full screen: no screen to show
FACE_WINDOW = 3.2           # webcam window height as a multiple of the face height (head and shoulders)
MIN_WINDOW, MAX_WINDOW = 0.18, 1.0
SOURCE_ASPECT = 16 / 9      # only used to size a --cam_box window


def _even(n):
    return int(n) // 2 * 2


def parse_time(text):
    """'4:12' -> 252.0, '1:02:03' -> 3723.0, '252' -> 252.0, '4m12s' style is not accepted (raises ValueError)."""
    parts = [float(p) for p in str(text).strip().split(":")]
    if not parts or len(parts) > 3:
        raise ValueError(f"bad time: {text!r}")
    total = 0.0
    for p in parts:
        total = total * 60 + p
    return total


_LINE = re.compile(r"^\s*(?P<a>\d+(?::\d+){0,2}(?:\.\d+)?)\s*(?:-|–|—|to)\s*(?P<b>\d+(?::\d+){0,2}(?:\.\d+)?)\s*(?P<title>.*)$")


def parse_clip_plan(path):
    """Moments from a plan file as [{'start','end','title'}] sorted by start. Raises ValueError on a bad line or bad range."""
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read()
    items = []
    stripped = raw.lstrip()
    if stripped.startswith("["):
        for n, row in enumerate(json.loads(raw), start=1):
            if not isinstance(row, dict) or "start" not in row or "end" not in row:
                raise ValueError(f"clip plan entry {n} needs start and end")
            items.append({"start": parse_time(row["start"]), "end": parse_time(row["end"]),
                          "title": str(row.get("title") or "").strip()})
    else:
        for n, line in enumerate(raw.splitlines(), start=1):
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            m = _LINE.match(line)
            if not m:
                raise ValueError(f"clip plan line {n} is not 'start-end title': {line!r}")
            items.append({"start": parse_time(m.group("a")), "end": parse_time(m.group("b")),
                          "title": m.group("title").strip(" \t-–—:")})
    for it in items:
        if it["end"] <= it["start"]:
            raise ValueError(f"clip {it['title'] or it['start']}: end must be after start")
        if it["end"] - it["start"] > 90:
            raise ValueError(f"clip {it['title'] or it['start']}: longer than 90 s")
    return sorted(items, key=lambda i: i["start"])


def plan_to_highlights(items):
    """Plan items shaped like the highlights the rest of the pipeline expects."""
    out = []
    for it in items:
        title = it.get("title") or "Clip"
        out.append({"start": float(it["start"]), "end": float(it["end"]), "viral_score": 90, "final_score": 90,
                    "reason": title, "hook_text": title, "from_plan": True})
    return out


def parse_cam_box(text):
    """'0.02,0.62,0.30,0.36' -> (x, y, w, h) shares of the frame; raises ValueError when not 4 numbers in 0..1."""
    try:
        x, y, w, h = [float(v) for v in str(text).split(",")]
    except ValueError:
        raise ValueError("--cam_box needs four numbers: x,y,w,h as shares of the frame, e.g. 0.02,0.62,0.30,0.36")
    if not (0 <= x < 1 and 0 <= y < 1 and 0 < w <= 1 and 0 < h <= 1):
        raise ValueError("--cam_box numbers must be between 0 and 1 (w and h above 0)")
    return x, y, w, h


def window_from_face(face):
    """(cx, cy, wh) from a (cx, cy, face_height) face measurement: window centre and height as shares of the source."""
    cx, cy, size = face
    wh = min(MAX_WINDOW, max(MIN_WINDOW, size * FACE_WINDOW))
    return cx, min(1 - wh / 2, max(wh / 2, cy + 0.10 * wh)), wh


def window_from_box(box, top_w=1080, top_h=640):
    """(cx, cy, wh) for a --cam_box: the window is at least as tall as the box and as wide as the box."""
    x, y, w, h = box
    aspect = top_w / top_h
    wh = min(MAX_WINDOW, max(h, w * SOURCE_ASPECT / aspect))
    cx, cy = x + w / 2, y + h / 2
    return cx, min(1 - wh / 2, max(wh / 2, cy)), wh


def detect_cam(video, start, end, cam_box=None, top_w=1080, top_h=640, face_track=None):
    """The webcam window (cx, cy, wh) for a clip; "talking_head" when the speaker fills the frame (no screen to show, so the
    normal face crop is better); None when there is no way to find the webcam."""
    if cam_box:
        return window_from_box(cam_box, top_w, top_h)
    try:
        if face_track is None:
            from engine.clip_picture import face_track
        track = [t for t in face_track(video, samples=8, start=start, end=end, min_face_div=MIN_FACE_DIV) if t]
    except Exception as e:
        print(f"[Warning] screen_cam: webcam search failed ({str(e)[:100]}).")
        return None
    if not track:
        return None
    mid = lambda i: sorted(t[i] for t in track)[len(track) // 2]
    if mid(2) > TALKING_HEAD:
        return "talking_head"
    return window_from_face((mid(0), mid(1), mid(2)))


def generate_filter(target_w=1080, target_h=1920, cam=None, zoom=None, cam_frac=CAM_FRAC, letterbox_crop=None):
    """FFmpeg filter chain for the layout: webcam on top, the whole screen (optionally zoomed with `zoom`, an ffmpeg crop
    filter) centred in the lower part over a blurred copy of itself. `cam` is (cx, cy, wh) from detect_cam."""
    cx, cy, wh = cam
    top_h = _even(round(target_h * cam_frac))
    bot_h = target_h - top_h
    asp = target_w / top_h
    radius = max(2, min(28, target_w // 4 - 1))
    pre = f"{letterbox_crop}," if letterbox_crop else ""
    zoom_chain = f"{zoom}," if zoom else ""
    cam_crop = (f"crop=w='min(iw,ih*{wh:.4f}*{asp:.5f})':h='min(ih,ih*{wh:.4f})':"
                f"x='max(0,min(iw-ow,iw*{cx:.4f}-ow/2))':y='max(0,min(ih-oh,ih*{cy:.4f}-oh/2))'")
    return (f"{pre}split=2[scsrc][scscr];"
            f"[scsrc]{cam_crop},scale={target_w}:{top_h}:flags=lanczos,setsar=1[sctop];"
            f"[scscr]{zoom_chain}split=2[scbg][scfg];"
            f"[scbg]scale={target_w}:{bot_h}:force_original_aspect_ratio=increase,crop={target_w}:{bot_h},"
            f"boxblur={radius}:3,eq=brightness=-0.1:saturation=1.1[scbgb];"
            f"[scfg]scale={target_w}:{bot_h}:force_original_aspect_ratio=decrease,setsar=1[scfgs];"
            f"[scbgb][scfgs]overlay=(W-w)/2:(H-h)/2[scbot];"
            f"[sctop][scbot]vstack=inputs=2,format=yuv420p")
