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
POSITIONS = {"top": (0.0, 0.17), "left": (-0.26, 0.20), "right": (0.26, 0.20), "center": (0.0, 0.36)}

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
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=60, fill=(255, 214, 0, 255))
    d.text((w / 2, h / 2), word, font=font, fill=(20, 20, 20, 255), anchor="mm")
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
        # alternate sides a little when the position is "top" would hide the speaker; keep to the chosen spot
        cx = width / 2 + dx_share * width
        cy = cy_share * height
        base = size_frac * width
        cmd += ["-loop", "1", "-framerate", str(fps), "-t", f"{length:.3f}", "-i", it["asset"]]
        chain.append(
            f"[{n}:v]format=rgba,"
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


def apply_to_clip(video, words, hook_overlay=False, ask=None, position="top", text_fallback=False,
                  resolve=resolve_asset, events=None):
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
        for p in picks:
            asset = resolve(p["keyword"], p["subject"], text_fallback=text_fallback)
            if asset:
                items.append(dict(p, asset=asset))
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
