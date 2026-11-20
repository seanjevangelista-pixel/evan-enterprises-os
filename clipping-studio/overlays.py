"""Transparent word-synced graphics (`--overlays`).

When a concrete thing ("Lego", "restaurant", "coffee") or an abstract idea ("love", "time", "freedom") is spoken, a
transparent cut-out graphic pops in near the top of the frame on that word, floats for ~2 s and fades out. Audio and
captions are untouched. Unlike `--broll` (full-width stock footage) this is a sticker-style object with no box around it.

Pieces (all offline-testable except the image generation call):
  * `pick_overlays`     words -> [{start, end, keyword, concept, subject}] (concept lexicon; optional LLM `ask`)
  * `resolve_asset`     your library -> cache -> image generator -> text card fallback -> None
  * `prepare_png`       trims, fits and adds a soft drop shadow so the graphic reads on any footage
  * `key_background`    removes a flat background colour (for generators that cannot return transparency)
  * `generate_openai`   OpenAI-compatible image API with a transparent background (needs OPENAI_API_KEY)
  * `render_overlays`   one FFmpeg pass: pop-in, gentle float, fade-out (video re-encoded, audio copied)
  * `apply_to_clip`     the whole thing for one finished clip; never raises, the clip is left alone on failure

Your own art always wins: drop `love.png`, `lego.png`, ... (transparent PNGs) into `assets/overlays/` and they are used
instead of generating anything. Without a library, an API key or `text_fallback`, nothing is added.
"""
import base64
import os
import re
import shutil
import subprocess

from engine import broll

LIBRARY_DIR = os.path.join("assets", "overlays")
CACHE_DIR = os.path.join("assets", "overlays", "cache")

MIN_START = 1.5         # the hook lives in the first seconds
HOOK_MIN_START = 3.0
MIN_SPACING = 5.0       # start to start; graphics are small and quick, so tighter than B-roll
MIN_LEN, DEFAULT_LEN, MAX_LEN = 1.4, 2.2, 3.2
LEAD = 0.10             # appear just before the word lands
TAIL_GUARD = 0.4
MAX_PER_CLIP = 6
POP_SECONDS = 0.28
FADE_OUT = 0.22
SIZE_FRAC = 0.42        # graphic width as a share of the frame width
ASSET_SIDE = 768        # px, longest side of a prepared graphic

# Placement: (centre x offset as a share of frame width, centre y as a share of frame height).
# "top" keeps clear of the speaker's face in a typical 9:16 talking-head shot; captions sit lower.
POSITIONS = {"top": (0.0, 0.17), "left": (-0.21, 0.20), "right": (0.21, 0.20), "center": (0.0, 0.36)}

# spoken word(s) -> image subject. Abstract ideas map to a symbol people recognise at a glance.
CONCEPTS = {
    # life / emotion
    "love": "glossy red 3D heart", "loved": "glossy red 3D heart", "loving": "glossy red 3D heart",
    "heart": "glossy red 3D heart", "relationship": "two interlocking hearts", "marriage": "pair of gold wedding rings",
    "family": "cartoon family of four holding hands", "friends": "two friends high-fiving",
    "happy": "bright yellow smiley face", "happiness": "bright yellow smiley face", "smile": "bright yellow smiley face",
    "peace": "white dove with an olive branch", "health": "green apple with a stethoscope",
    "time": "vintage alarm clock", "clock": "vintage alarm clock", "years": "hourglass with flowing sand",
    "life": "green sprouting plant in soil", "growth": "green sprouting plant in soil",
    "grow": "green sprouting plant in soil", "journey": "winding road toward mountains",
    "freedom": "bird flying out of an open cage", "dream": "crescent moon with stars", "dreams": "crescent moon with stars",
    "fear": "dark storm cloud with lightning", "pain": "cracked glass heart", "death": "hourglass nearly empty",
    # business / money
    "money": "stack of cash bills", "cash": "stack of cash bills", "dollars": "stack of cash bills",
    "wealth": "pile of gold coins", "rich": "pile of gold coins", "millionaire": "pile of gold coins",
    "broke": "empty open wallet", "debt": "chain with a heavy ball", "invest": "rising stock chart arrow",
    "investing": "rising stock chart arrow", "profit": "rising stock chart arrow", "revenue": "rising stock chart arrow",
    "business": "leather briefcase", "company": "modern glass office building", "boss": "crown",
    "job": "leather briefcase", "career": "leather briefcase", "clients": "handshake", "customers": "handshake",
    "deal": "handshake", "sales": "shopping bag with a price tag", "brand": "star badge",
    "idea": "glowing light bulb", "ideas": "glowing light bulb", "plan": "folded blueprint with a pencil",
    "goal": "dartboard with an arrow in the bullseye", "goals": "dartboard with an arrow in the bullseye",
    "target": "dartboard with an arrow in the bullseye", "success": "golden trophy", "win": "golden trophy",
    "winning": "golden trophy", "champion": "golden trophy", "mindset": "glowing brain", "mind": "glowing brain",
    "brain": "glowing brain", "think": "glowing brain", "learn": "stack of books", "knowledge": "stack of books",
    "book": "stack of books", "books": "stack of books", "work": "laptop computer", "hustle": "flexed arm",
    "discipline": "flexed arm", "strong": "flexed arm", "strength": "flexed arm", "fire": "bright flame",
    "passion": "bright flame", "energy": "lightning bolt", "power": "lightning bolt", "rocket": "rocket ship",
    "scale": "rocket ship", "launch": "rocket ship", "opportunity": "golden key", "key": "golden key",
    "door": "open wooden door with light behind", "risk": "red warning triangle", "mistake": "red x mark",
    "fail": "red x mark", "failure": "red x mark", "quit": "white surrender flag", "luck": "four-leaf clover",
    "diamond": "sparkling diamond", "crown": "crown", "king": "crown",
    # things
    "lego": "colorful Lego brick set", "legos": "colorful Lego brick set",
    "restaurant": "cozy restaurant storefront with awning", "food": "plated gourmet meal", "dinner": "plated gourmet meal",
    "pizza": "whole pizza", "burger": "cheeseburger", "coffee": "steaming coffee cup", "cooking": "chef hat and frying pan",
    "house": "cozy family house", "home": "cozy family house", "car": "sleek sports car", "phone": "smartphone",
    "computer": "laptop computer", "laptop": "laptop computer", "dog": "cute golden retriever", "cat": "cute cat",
    "gym": "dumbbell", "workout": "dumbbell", "plane": "passenger airplane", "flight": "passenger airplane",
    "world": "planet earth globe", "earth": "planet earth globe", "mountain": "snow-capped mountain",
    "ocean": "ocean wave", "beach": "palm tree on a small island", "sun": "bright sun", "moon": "crescent moon",
    "star": "gold star", "music": "musical notes", "camera": "vintage camera", "school": "graduation cap",
    "college": "graduation cap", "university": "graduation cap", "baby": "baby bottle", "gift": "wrapped gift box",
}

# Business words: email, meetings, calls, leads, results. These have drawings built in (engine.overlay_art).
CONCEPTS.update({w: "envelope with a notification badge" for w in
                 "email emails inbox outreach campaign campaigns reply replies newsletter".split()})
CONCEPTS.update({w: "calendar page with a checkmark" for w in
                 "meeting meetings calendar booked booking appointment appointments schedule".split()})
CONCEPTS.update({w: "smartphone" for w in "call calls dial dialing".split()})
CONCEPTS.update({w: "sales funnel" for w in "lead leads pipeline funnel prospect prospects conversion".split()})
CONCEPTS.update({w: "rising stock chart arrow" for w in
                 "results increase increased scaling scaled doubled tripled record metrics stats".split()})
CONCEPTS.update({w: "stack of cash bills" for w in "million millions billion billions".split()})

# Anything in the B-roll lexicon (concrete nouns) also gets a graphic, using its stock query as the subject.
_STOP = {"it", "the", "a", "an", "and", "or", "but", "so", "to", "of", "in", "on", "at", "for", "is", "are", "was"}


def normalize_word(word):
    """Lower-case, strip punctuation and a plural 's' when the singular is known (`goals` stays, `cars` -> `car`)."""
    w = re.sub(r"[^a-z0-9']", "", (word or "").lower()).replace("'s", "")
    if w in CONCEPTS:                               # an explicit entry ("dollars", "goals") is kept as written
        return w
    for suffix in ("es", "s"):                      # otherwise singular first, so car/cars share one graphic and slot
        base = w[: -len(suffix)] if w.endswith(suffix) else ""
        if base and (base in CONCEPTS or base in broll._QUERY):
            return base
    return w


def subject_for(key):
    if key in CONCEPTS:
        return CONCEPTS[key]
    q = broll._QUERY.get(key)
    return q if q and key not in _STOP else None


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", (text or "").lower()).strip("-") or "graphic"


def llm_subjects(words, ask, limit=8):
    """Optional: `ask(prompt) -> parsed JSON` names words worth a graphic and what to draw. Any failure gives {}."""
    text = " ".join(w.get("word", "") for w in words)[:3000]
    prompt = (
        "Pick up to %d words from this transcript that a viewer would enjoy seeing as a small sticker graphic "
        "(an object, place, or a symbol for an idea such as love or time). For each give 2-5 words describing ONE "
        "simple isolated object to draw. Reply as JSON: {\"word\": \"what to draw\"}.\n\nTranscript: %s" % (limit, text))
    try:
        data = ask(prompt)
        return {normalize_word(k): str(v).strip() for k, v in (data or {}).items() if str(v).strip()}
    except Exception:
        return {}


def pick_overlays(words, duration, min_start=MIN_START, spacing=MIN_SPACING, length=DEFAULT_LEN, ask=None,
                  max_items=MAX_PER_CLIP):
    """Choose the moments. `words`: [{'word','start','end'}] on the finished clip's timeline (seconds).

    Rules: nothing before `min_start`, at least `spacing` seconds between starts, each graphic MIN_LEN..MAX_LEN long,
    never into the last TAIL_GUARD seconds, each keyword once per clip, at most `max_items`.
    Returns [{'start','end','keyword','subject'}] in time order.
    """
    extra = llm_subjects(words, ask) if ask else {}
    length = min(MAX_LEN, max(MIN_LEN, length))
    seen, candidates = set(), []
    for w in words:
        key = normalize_word(w.get("word"))
        subject = extra.get(key) or subject_for(key)
        if not subject or key in seen or float(w["start"]) < min_start:
            continue
        start = max(min_start, float(w["start"]) - LEAD)
        end = min(start + length, duration - TAIL_GUARD)
        if end - start < MIN_LEN:
            continue
        seen.add(key)
        # abstract/emotional ideas and LLM picks beat plain object words when two compete for a slot
        score = 2 if (key in extra or key in CONCEPTS) else 1
        candidates.append({"start": round(start, 2), "end": round(end, 2), "keyword": key, "subject": subject,
                           "score": score})
    candidates.sort(key=lambda c: (-c["score"], c["start"]))
    chosen = []
    for c in candidates:
        if len(chosen) < max_items and all(abs(c["start"] - o["start"]) >= spacing for o in chosen):
            chosen.append(c)
    chosen.sort(key=lambda c: c["start"])
    return [{k: c[k] for k in ("start", "end", "keyword", "subject")} for c in chosen]


# ---------------------------------------------------------------------------------------------- image handling

def key_background(img, tolerance=60, feather=40):
    """RGBA image with the flat background colour removed. The colour is the median of the border pixels, so it works
    for a white, black or green studio backdrop alike. Pixels within `tolerance` become transparent, `feather` more
    fade out (soft edge)."""
    from PIL import Image
    rgba = img.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    border = [px[x, y][:3] for x in range(0, w, max(1, w // 40)) for y in (0, h - 1)]
    border += [px[x, y][:3] for y in range(0, h, max(1, h // 40)) for x in (0, w - 1)]
    bg = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))
    out = Image.new("RGBA", rgba.size)
    src, dst = rgba.getdata(), []
    for r, g, b, a in src:
        d = max(abs(r - bg[0]), abs(g - bg[1]), abs(b - bg[2]))
        if d <= tolerance:
            dst.append((r, g, b, 0))
        elif d <= tolerance + feather:
            dst.append((r, g, b, int(a * (d - tolerance) / feather)))
        else:
            dst.append((r, g, b, a))
    out.putdata(dst)
    return out


def has_transparency(img):
    return img.mode == "RGBA" and img.getchannel("A").getextrema()[0] < 250


def prepare_png(src, dst, side=ASSET_SIDE, shadow=True):
    """Trim to the visible pixels, fit into `side` x `side`, add a soft drop shadow, save as PNG. Returns dst."""
    from PIL import Image, ImageFilter
    img = Image.open(src).convert("RGBA")
    if not has_transparency(img):
        img = key_background(img)
    box = img.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if box:
        img = img.crop(box)
    pad = 28 if shadow else 0
    inner = side - 2 * pad
    scale = min(inner / img.width, inner / img.height)
    img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (img.width + 2 * pad, img.height + 2 * pad), (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
        sh.paste((0, 0, 0, 130), (pad, pad + 8), img.getchannel("A"))
        canvas = Image.alpha_composite(canvas, sh.filter(ImageFilter.GaussianBlur(10)))
    canvas.alpha_composite(img, (pad, pad))
    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    canvas.save(dst, "PNG")
    return dst


def text_card(word, dst, side=ASSET_SIDE):
    """Offline fallback: the spoken word on a rounded card. Returns dst, or None when no usable font is found."""
    from PIL import Image, ImageDraw, ImageFont
    font = None
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/Library/Fonts/Arial Bold.ttf",
                 "C:/Windows/Fonts/arialbd.ttf"):
        if os.path.isfile(path):
            font = ImageFont.truetype(path, 150)
            break
    if font is None:
        return None
    word = (word or "").upper()
    probe = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    tw = probe.textlength(word, font=font)
    w, h = int(tw + 120), 300
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=60, fill=(124, 58, 237, 255))
    d.text((w / 2, h / 2), word, font=font, fill=(255, 255, 255, 255), anchor="mm")
    tmp = dst + ".raw.png"
    card.save(tmp)
    try:
        return prepare_png(tmp, dst, side=side)
    finally:
        os.remove(tmp)


def generate_openai(subject, out_path, api_key=None, base_url=None, model=None, session=None):
    """One transparent PNG from an OpenAI-compatible image API. Returns out_path or None. Never raises.
    Env: OPENAI_API_KEY (required), OPENAI_BASE_URL, OVERLAY_IMAGE_MODEL (default gpt-image-1)."""
    key = api_key or os.environ.get("OPENAI_API_KEY")
    if not key:
        return None
    base = (base_url or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
    prompt = (f"{subject}. Single isolated object, centered, glossy polished 3D sticker style, bold clean shapes, "
              "soft studio lighting, no text, no letters, no background.")
    try:
        import requests
        post = (session or requests).post
        res = post(f"{base}/images/generations", timeout=180,
                   headers={"Authorization": f"Bearer {key}"},
                   json={"model": model or os.environ.get("OVERLAY_IMAGE_MODEL", "gpt-image-1"), "prompt": prompt,
                         "size": "1024x1024", "background": "transparent", "output_format": "png", "n": 1})
        res.raise_for_status()
        item = res.json()["data"][0]
        raw = base64.b64decode(item["b64_json"]) if item.get("b64_json") else requests.get(item["url"], timeout=60).content
        os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
        with open(out_path, "wb") as f:
            f.write(raw)
        return out_path
    except Exception as e:
        print(f"[Warning] Overlay image for '{subject}' not generated: {str(e)[:200]}")
        return None


def _builtin_art(subject, cache_dir):
    """A drawing from engine.overlay_art for this subject (a prepared PNG, or a folder of frames for an animated one), or None."""
    from engine import overlay_art
    name = overlay_art.art_for_subject(subject)
    if not name:
        return None
    try:
        if overlay_art.is_animated(name):
            folder = os.path.join(cache_dir, f"builtin-{name}")
            if not os.path.isfile(os.path.join(folder, "f_000.png")):
                overlay_art.make(name, folder)
            return folder
        path = os.path.join(cache_dir, f"builtin-{name}.png")
        if not os.path.isfile(path):
            raw = path + ".raw.png"
            os.makedirs(cache_dir, exist_ok=True)
            overlay_art.make(name, raw)
            try:
                prepare_png(raw, path)
            finally:
                if os.path.exists(raw):
                    os.remove(raw)
        return path
    except Exception as e:
        print(f"[Warning] Built-in graphic {name} not drawn: {e}")
        return None


def resolve_asset(keyword, subject, library_dir=LIBRARY_DIR, cache_dir=CACHE_DIR, generate=generate_openai,
                  text_fallback=False):
    """A prepared transparent PNG for this word, or None. Order: your library (by keyword or subject), the cache,
    the image generator, then (only when `text_fallback`) a text card."""
    for name in (keyword, slug(subject)):
        for folder in (library_dir,):
            p = os.path.join(folder, f"{slug(name)}.png")
            if os.path.isfile(p):
                return p
    cached = os.path.join(cache_dir, f"{slug(subject)}.png")
    if os.path.isfile(cached):
        return cached
    art = _builtin_art(subject, cache_dir)
    if art:
        return art
    if generate:
        os.makedirs(cache_dir, exist_ok=True)
        raw = generate(subject, cached + ".raw.png")
        if raw and os.path.isfile(raw):
            try:
                prepare_png(raw, cached)
                return cached
            except Exception as e:
                print(f"[Warning] Overlay image for '{subject}' unusable: {e}")
            finally:
                if os.path.exists(raw):
                    os.remove(raw)
    if text_fallback:
        os.makedirs(cache_dir, exist_ok=True)
        return text_card(keyword, os.path.join(cache_dir, f"card-{slug(keyword)}.png"))
    return None


# ------------------------------------------------------------------------------------------ face-aware placement

# Candidate spots, as (name, centre x offset from the middle as a share of frame width, centre y as a share of height).
SLOTS = [("top", 0.0, 0.17), ("left", -0.21, 0.20), ("right", 0.21, 0.20),
         ("upper_left", -0.21, 0.11), ("upper_right", 0.21, 0.11),
         ("mid_left", -0.21, 0.36), ("mid_right", 0.21, 0.36), ("center", 0.0, 0.36)]
SCALES = (1.0, 0.8, 0.65)      # try the full size in every spot before shrinking the graphic
POP_GROW = 1.15                # the pop-in overshoots; keep clear of the face at the biggest moment
EDGE = 0.04                    # keep this share of the frame width free at the sides
FACE_PAD = (0.25, 0.45, 0.15)          # extra room around a face as shares of its size: each side, above (hair), below (neck)
SAMPLES_PER_ITEM = 5
MIN_FACE_DIV = 14              # a face counts when it is at least 1/14 of the frame wide


def sample_faces(video, start, end, samples=SAMPLES_PER_ITEM, min_face_div=MIN_FACE_DIV):
    """Face boxes seen between `start` and `end` seconds, as [(x0, y0, x1, y1)] shares of the frame (0..1).
    Uses the same detector as the speaker crop (YuNet, else Haar). Returns [] when no face is found or detection fails."""
    try:
        import cv2
        from engine.speaker_focus import _detect_faces, _make_detector
        cap = cv2.VideoCapture(video)
        det = _make_detector()
        boxes = []
        for i in range(samples):
            t = start + (end - start) * (i + 0.5) / samples
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
            ok, frame = cap.read()
            if not ok:
                continue
            h, w = frame.shape[:2]
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            for x, y, fw, fh in _detect_faces(frame, gray, det):
                if fw >= w // min_face_div:
                    boxes.append((x / w, y / h, (x + fw) / w, (y + fh) / h))
        cap.release()
        return boxes
    except Exception as e:
        print(f"[Warning] Overlay face detection failed ({str(e)[:120]}); using the fixed position.")
        return []


def face_zone(boxes, pad=FACE_PAD):
    """One padded keep-clear box (x0, y0, x1, y1 as shares) around every face seen; None when there are none.
    Padding adds room for hair above, shoulders at the sides and a bit of neck below."""
    if not boxes:
        return None
    x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    fw, fh = x1 - x0, y1 - y0
    return (max(0.0, x0 - pad[0] * fw), max(0.0, y0 - pad[1] * fh), min(1.0, x1 + pad[0] * fw), min(1.0, y1 + pad[2] * fh))


def _overlap(a, b):
    return a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]


def place_graphic(frame, aspect, zone, preferred="top", size_frac=SIZE_FRAC, bottom_limit=None):
    """Pick where a graphic goes so it never covers the face.
    frame: (width, height) px; aspect: graphic height / width; zone: padded face box in shares, or None when no face was
    seen; bottom_limit: lowest pixel row the graphic may reach (the caption line). Returns
    {'cx','cy','w','slot'} in pixels, or None when no spot clears the face (the graphic is then skipped).
    With no face information the preferred spot is used (shrunk if it does not fit)."""
    width, height = frame
    limit = bottom_limit if bottom_limit else height * 0.6
    names = [slot[0] for slot in SLOTS]
    order = sorted(SLOTS, key=lambda slot: -1 if slot[0] == preferred else names.index(slot[0]))
    by_name = {slot[0]: slot for slot in SLOTS}
    tries = []
    if zone is None and preferred in by_name:
        tries += [(by_name[preferred], scale) for scale in SCALES]
    tries += [(slot, scale) for scale in SCALES for slot in order]       # full size in every spot before shrinking
    for (name, dx, cy_share), scale in tries:
        gw = size_frac * width * scale
        gh = gw * aspect
        cx, cy = width / 2 + dx * width, cy_share * height
        half_w, half_h = gw * POP_GROW / 2, gh * POP_GROW / 2 + 8        # +8: the float animation
        x0, x1, y0, y1 = cx - half_w, cx + half_w, cy - half_h, cy + half_h
        if x0 < EDGE * width or x1 > width * (1 - EDGE) or y0 < 0 or y1 > limit:
            continue
        if zone is not None and _overlap((x0 / width, y0 / height, x1 / width, y1 / height), zone):
            continue
        return {"cx": round(cx, 1), "cy": round(cy, 1), "w": round(gw, 1), "slot": name}
    return None


# ------------------------------------------------------------------------------------------------ rendering

def _pop(p="min(t/%.2f,1)" % POP_SECONDS):
    """Ease-out-back curve (0 -> overshoot -> 1) as an FFmpeg expression of the item-local time t."""
    return f"(1+2.70158*pow({p}-1,3)+1.70158*pow({p}-1,2))"


def build_overlay_command(ffmpeg, video, items, frame, output, fps=30, position="top", size_frac=SIZE_FRAC):
    """FFmpeg command animating each item's PNG over `video`. items: [{'start','end','asset'}]; frame: (width, height)."""
    width, height = frame
    dx_share, cy_share = POSITIONS.get(position, POSITIONS["top"])
    cmd = [ffmpeg, "-y", "-i", video]
    chain, last = [], "0:v"
    for n, it in enumerate(items, start=1):
        length = it["end"] - it["start"]
        cx = it.get("cx", width / 2 + dx_share * width)       # face-aware placement sets cx, cy, w per graphic
        cy = it.get("cy", cy_share * height)
        base = it.get("w", size_frac * width)
        if os.path.isdir(it["asset"]):                      # animated: PNG frames, the last one held
            cmd += ["-framerate", str(fps), "-i", os.path.join(it["asset"], "f_%03d.png")]
            head = f"[{n}:v]tpad=stop_mode=clone:stop_duration={length + 1:.2f},trim=duration={length:.3f},setpts=PTS-STARTPTS,format=rgba,"
        else:
            cmd += ["-loop", "1", "-framerate", str(fps), "-t", f"{length:.3f}", "-i", it["asset"]]
            head = f"[{n}:v]format=rgba,"
        chain.append(
            f"{head}"
            f"scale=w='max(8,trunc({base:.1f}*max(0.02,{_pop()})*(1+0.025*sin(2*PI*0.8*t))/2)*2)':h=-2:eval=frame,"
            f"fade=t=in:st=0:d=0.08:alpha=1,fade=t=out:st={max(0.0, length - FADE_OUT):.3f}:d={FADE_OUT}:alpha=1,"
            f"setpts=PTS+{it['start']:.3f}/TB[g{n}]")
        chain.append(
            f"[{last}][g{n}]overlay=x='{cx:.1f}-w/2':y='{cy:.1f}-h/2+7*sin(2*PI*0.7*(t-{it['start']:.3f}))':"
            f"eof_action=pass:format=auto[v{n}]")
        last = f"v{n}"
    cmd += ["-filter_complex", ";".join(chain), "-map", f"[{last}]", "-map", "0:a?",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
            "-c:a", "copy", "-movflags", "+faststart", output]
    return cmd


def render_overlays(video, items, frame, ffmpeg=None, position="top"):
    """Overlay `items` on `video` in place. True when the file was replaced; on any failure it is left as it was."""
    ffmpeg = ffmpeg or broll._ffmpeg()
    tmp = os.path.join(os.path.dirname(os.path.abspath(video)), f".overlay_{os.getpid()}_{os.path.basename(video)}")
    try:
        res = subprocess.run(build_overlay_command(ffmpeg, video, items, frame, tmp, position=position),
                             capture_output=True, text=True)
        if res.returncode != 0 or not os.path.isfile(tmp) or os.path.getsize(tmp) < 1000:
            print(f"[Warning] Overlay render failed: {res.stderr[-300:].strip()}")
            return False
        from engine.fsutil import replace_file
        replace_file(tmp, video)
        return True
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def _aspect(path):
    """Height / width of a graphic (1.0 when it cannot be read)."""
    try:
        from PIL import Image
        if os.path.isdir(path):
            path = os.path.join(path, "f_000.png")
        with Image.open(path) as im:
            return im.height / max(1, im.width)
    except Exception:
        return 1.0


def apply_to_clip(video, words, hook_overlay=False, ask=None, position="top", text_fallback=False,
                  resolve=resolve_asset, events=None, face_aware=True, detect=sample_faces,
                  caption_y=broll.DEFAULT_CAPTION_Y):
    """Graphics for one finished clip. Returns the number placed (0 = clip untouched). Never raises.
    `events`, when given, receives {"t", "kind", "keyword"} per graphic (for sound effects)."""
    try:
        ffmpeg = broll._ffmpeg()
        width, height, duration = broll._probe(video, ffmpeg)
        if height <= width:
            print("[Log] Overlays: only vertical clips get graphics; skipped.")
            return 0
        picks = pick_overlays(words, duration, min_start=HOOK_MIN_START if hook_overlay else MIN_START, ask=ask)
        items = []
        region = broll.cutaway_region(width, height, "single", caption_y)
        bottom_limit = region[3] if region else None
        for p in picks:
            asset = resolve(p["keyword"], p["subject"], text_fallback=text_fallback)
            if not asset:
                continue
            item = dict(p, asset=asset)
            if face_aware:
                zone = face_zone(detect(video, p["start"], p["end"]))
                spot = place_graphic((width, height), _aspect(asset), zone, preferred=position, bottom_limit=bottom_limit)
                if spot is None:
                    print(f"[Log] Overlays: no spot clear of the face for '{p['keyword']}'; skipped.")
                    continue
                item.update(cx=spot["cx"], cy=spot["cy"], w=spot["w"], slot=spot["slot"])
            items.append(item)
        if not items:
            print("[Log] Overlays: no matching moments or no graphics available (add transparent PNGs to "
                  f"{LIBRARY_DIR}, set OPENAI_API_KEY, or use text fallback); clip left as it was.")
            return 0
        if render_overlays(video, items, (width, height), ffmpeg, position=position):
            if events is not None:
                events.extend({"t": i["start"], "kind": "pop", "keyword": i["keyword"]} for i in items)
            print(f"[Log] Overlays: {len(items)} graphic(s) in {os.path.basename(video)} "
                  f"({', '.join(i['keyword'] for i in items)})")
            return len(items)
    except Exception as e:
        print(f"[Warning] Overlays skipped for {os.path.basename(str(video))}: {e}")
    return 0
