"""Starter graphics for `--overlays`, drawn in code: no downloads, no API key, same result on every machine.

`make(name, out)` draws one graphic as a transparent PNG (or, for the animated ones, a folder of PNG frames).
`art_for_subject(subject)` says which drawing fits a graphic subject from engine.overlays (None when there is none).
Colours are the Inbox Rev look: purple and white, with green for money and growth.

Animated: `chart` (bars that grow, then an arrow). Everything else is a still: the pop-in, float and fade come from
engine.overlays.
"""
import math
import os

SIZE = 768
SS = 2                      # drawn at 2x and scaled down: smooth edges
PURPLE, DEEP, LILAC = (168, 85, 247), (91, 33, 182), (233, 213, 255)
WHITE, INK = (255, 255, 255), (30, 27, 46)
GREEN, GOLD, GOLD_D = (34, 197, 94), (250, 204, 21), (202, 138, 4)
RED, BLUE, GREY = (239, 68, 68), (59, 130, 246), (148, 163, 184)

FRAMES = 24                 # frames in an animated graphic (0.8 s at 30 fps)

# graphic subject (from engine.overlays) -> drawing
SUBJECT_ART = {
    "stack of cash bills": "dollar", "pile of gold coins": "dollar",
    "rising stock chart arrow": "chart",
    "envelope with a notification badge": "email",
    "calendar page with a checkmark": "calendar",
    "smartphone": "phone",
    "sales funnel": "funnel",
    "vintage alarm clock": "clock",
    "glossy red 3D heart": "heart",
    "glowing light bulb": "lightbulb",
    "dartboard with an arrow in the bullseye": "target",
    "golden trophy": "trophy",
}
ANIMATED = {"chart"}


_BY_SUBJECT = {k.lower(): v for k, v in SUBJECT_ART.items()}


def art_for_subject(subject):
    return _BY_SUBJECT.get((subject or "").strip().lower())


def is_animated(name):
    return name in ANIMATED


# ----------------------------------------------------------------------------------------------------- helpers

def _canvas():
    from PIL import Image, ImageDraw
    img = Image.new("RGBA", (SIZE * SS, SIZE * SS), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def _s(v):
    """Scale a coordinate from the 768 grid to the supersampled canvas."""
    return v * SS


def _box(x0, y0, x1, y1):
    return [_s(x0), _s(y0), _s(x1), _s(y1)]


def _finish(img):
    from PIL import Image
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def _font(size):
    from PIL import ImageFont
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/Library/Fonts/Arial Bold.ttf",
                 "/System/Library/Fonts/Supplemental/Arial Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"):
        if os.path.isfile(path):
            return ImageFont.truetype(path, int(size * SS))
    try:
        return ImageFont.load_default(int(size * SS))
    except TypeError:
        return ImageFont.load_default()


def _text(d, xy, text, size, fill):
    d.text((_s(xy[0]), _s(xy[1])), text, font=_font(size), fill=fill, anchor="mm")


def _rounded(d, box, radius, fill, outline=None, width=0):
    d.rounded_rectangle(_box(*box), radius=_s(radius), fill=fill, outline=outline, width=_s(width))


def _ease(t):
    t = min(1.0, max(0.0, t))
    return 1 - (1 - t) ** 3


# ----------------------------------------------------------------------------------------------------- the art

def draw_dollar():
    img, d = _canvas()
    for cx, cy, r in ((300, 470, 190), (470, 330, 215)):                       # two coins, the front one bigger
        d.ellipse(_box(cx - r, cy - r + 14, cx + r, cy + r + 14), fill=GOLD_D)
        d.ellipse(_box(cx - r, cy - r, cx + r, cy + r), fill=GOLD, outline=GOLD_D, width=_s(8))
        d.ellipse(_box(cx - r + 34, cy - r + 34, cx + r - 34, cy + r - 34), outline=GOLD_D, width=_s(6))
    _text(d, (470, 336), "$", 250, (146, 96, 0))
    return _finish(img)


def _bars(d, t):
    """The bar chart at progress t (0..1): a card, five bars growing in turn, a growth arrow at the end."""
    _rounded(d, (70, 90, 700, 680), 60, DEEP)
    d.line([_s(135), _s(610), _s(635), _s(610)], fill=LILAC, width=_s(8))           # baseline
    heights = (130, 210, 290, 390, 480)
    for i, h in enumerate(heights):
        grow = _ease((t - i * 0.12) / 0.45)
        if grow <= 0:
            continue
        x0 = 150 + i * 96
        top = 600 - h * grow
        d.rounded_rectangle(_box(x0, top, x0 + 68, 600), radius=_s(12), fill=GREEN if i == 4 else WHITE)
    a = _ease((t - 0.62) / 0.38)
    if a > 0:                                                                        # arrow along the bar tops
        pts = [(170, 430), (266, 360), (362, 290), (458, 190), (554, 105)]
        n = max(1, int(a * (len(pts) - 1)))
        d.line([(_s(x), _s(y)) for x, y in pts[: n + 1]], fill=GOLD, width=_s(14), joint="curve")
        if a > 0.95:
            x, y = pts[-1]
            d.polygon([(_s(x + 46), _s(y - 26)), (_s(x - 8), _s(y - 34)), (_s(x + 30), _s(y + 22))], fill=GOLD)


def draw_chart(t=1.0):
    img, d = _canvas()
    _bars(d, t)
    return _finish(img)


def draw_email():
    img, d = _canvas()
    _rounded(d, (90, 200, 680, 600), 40, WHITE, LILAC, 8)
    d.line([_s(110), _s(230), _s(385), _s(440), _s(660), _s(230)], fill=PURPLE, width=_s(16), joint="curve")
    d.line([_s(110), _s(580), _s(300), _s(400)], fill=LILAC, width=_s(8))
    d.line([_s(660), _s(580), _s(470), _s(400)], fill=LILAC, width=_s(8))
    d.ellipse(_box(560, 130, 700, 270), fill=RED, outline=WHITE, width=_s(8))     # notification badge
    _text(d, (630, 202), "1", 100, WHITE)
    return _finish(img)


def draw_calendar():
    img, d = _canvas()
    _rounded(d, (110, 150, 660, 660), 50, WHITE)
    d.rounded_rectangle(_box(110, 150, 660, 290), radius=_s(50), fill=PURPLE)
    d.rectangle(_box(110, 240, 660, 290), fill=PURPLE)
    for x in (230, 540):
        d.rounded_rectangle(_box(x - 18, 100, x + 18, 210), radius=_s(18), fill=INK)
    for r in range(3):
        for c in range(4):
            x, y = 160 + c * 112, 330 + r * 100
            d.rounded_rectangle(_box(x, y, x + 74, y + 66), radius=_s(14), fill=LILAC)
    d.ellipse(_box(430, 460, 640, 670), fill=GREEN, outline=WHITE, width=_s(10))   # booked check
    d.line([_s(480), _s(565), _s(520), _s(610), _s(595), _s(515)], fill=WHITE, width=_s(24), joint="curve")
    return _finish(img)


def draw_phone():
    img, d = _canvas()
    _rounded(d, (220, 110, 548, 710), 70, INK)
    _rounded(d, (242, 170, 526, 650), 40, PURPLE)
    d.ellipse(_box(314, 330, 454, 470), fill=GREEN)                                  # call button with a handset
    d.arc(_box(346, 366, 422, 442), start=200, end=340, fill=WHITE, width=_s(16))
    for x in (346, 422):
        d.ellipse(_box(x - 14, 400, x + 14, 428), fill=WHITE)
    d.rounded_rectangle(_box(330, 530, 438, 548), radius=_s(9), fill=LILAC)
    for side in (-1, 1):                                                              # it is ringing: two marks each side
        for (x0, y0, x1, y1) in ((200, 190, 248, 146), (222, 250, 280, 226)):
            d.line([_s(384 + side * x0), _s(y0), _s(384 + side * x1), _s(y1)], fill=GOLD, width=_s(16))
    return _finish(img)


def draw_funnel():
    img, d = _canvas()
    layers = ((110, 660, 250, 250, 520, PURPLE), (190, 580, 340, 290, 480, (192, 132, 252)), (280, 490, 430, 345, 425, LILAC))
    d.polygon([(_s(110), _s(170)), (_s(660), _s(170)), (_s(470), _s(440)), (_s(470), _s(620)),
               (_s(300), _s(670)), (_s(300), _s(440))], fill=PURPLE)
    d.polygon([(_s(110), _s(170)), (_s(660), _s(170)), (_s(620), _s(230)), (_s(150), _s(230))], fill=LILAC)
    for x, y, c in ((260, 110, WHITE), (390, 70, GREEN), (520, 110, GOLD)):         # leads dropping in
        d.ellipse(_box(x - 34, y - 34, x + 34, y + 34), fill=c)
    d.ellipse(_box(342, 650, 428, 736), fill=GREEN)
    return _finish(img)


def draw_clock():
    img, d = _canvas()
    d.ellipse(_box(120, 130, 650, 660), fill=PURPLE)
    d.ellipse(_box(160, 170, 610, 620), fill=WHITE)
    for k in range(12):
        a = math.radians(k * 30)
        r0, r1 = (180, 205) if k % 3 else (165, 205)
        d.line([_s(385 + r0 * math.sin(a)), _s(395 - r0 * math.cos(a)), _s(385 + r1 * math.sin(a)), _s(395 - r1 * math.cos(a))],
               fill=INK, width=_s(10 if k % 3 == 0 else 6))
    d.line([_s(385), _s(395), _s(385), _s(270)], fill=INK, width=_s(18))
    d.line([_s(385), _s(395), _s(470), _s(440)], fill=PURPLE, width=_s(18))
    d.ellipse(_box(365, 375, 405, 415), fill=INK)
    return _finish(img)


def draw_heart():
    img, d = _canvas()
    d.ellipse(_box(120, 160, 400, 440), fill=RED)
    d.ellipse(_box(370, 160, 650, 440), fill=RED)
    d.polygon([(_s(138), _s(350)), (_s(632), _s(350)), (_s(385), _s(680))], fill=RED)
    d.ellipse(_box(190, 210, 270, 290), fill=(252, 165, 165))                       # highlight
    return _finish(img)


def draw_lightbulb():
    img, d = _canvas()
    for k in range(7):                                                              # rays
        a = math.radians(-90 + (k - 3) * 38)
        d.line([_s(385 + 240 * math.cos(a)), _s(300 + 240 * math.sin(a)), _s(385 + 310 * math.cos(a)), _s(300 + 310 * math.sin(a))],
               fill=GOLD, width=_s(16))
    d.ellipse(_box(215, 130, 555, 470), fill=GOLD)
    d.polygon([(_s(290), _s(420)), (_s(480), _s(420)), (_s(455), _s(540)), (_s(315), _s(540))], fill=GOLD)
    d.ellipse(_box(255, 170, 335, 250), fill=(254, 240, 138))
    _rounded(d, (310, 540, 460, 600), 18, GREY)
    _rounded(d, (330, 610, 440, 660), 18, GREY)
    return _finish(img)


def draw_target():
    img, d = _canvas()
    for r, c in ((290, RED), (225, WHITE), (160, RED), (95, WHITE), (40, RED)):
        d.ellipse(_box(385 - r, 400 - r, 385 + r, 400 + r), fill=c, outline=INK, width=_s(4))
    d.line([_s(400), _s(385), _s(640), _s(140)], fill=INK, width=_s(14))              # the arrow
    d.polygon([(_s(640), _s(140)), (_s(700), _s(100)), (_s(690), _s(185))], fill=PURPLE)
    d.polygon([(_s(610), _s(170)), (_s(690), _s(100)), (_s(660), _s(210))], fill=PURPLE)
    return _finish(img)


def draw_trophy():
    img, d = _canvas()
    d.polygon([(_s(215), _s(130)), (_s(555), _s(130)), (_s(520), _s(360)), (_s(385), _s(440)), (_s(250), _s(360))], fill=GOLD)
    for side in (-1, 1):                                                              # handles
        x = 385 + side * 190
        d.arc(_box(x - 85, 150, x + 85, 320), start=90 if side > 0 else 270, end=270 if side > 0 else 90, fill=GOLD_D, width=_s(22))
    d.rectangle(_box(350, 430, 420, 560), fill=GOLD_D)
    _rounded(d, (255, 560, 515, 640), 22, GOLD)
    _rounded(d, (215, 630, 555, 690), 22, GOLD_D)
    d.polygon([(_s(385), _s(190)), (_s(405), _s(240)), (_s(460), _s(246)), (_s(418), _s(282)), (_s(432), _s(336)),
               (_s(385), _s(306)), (_s(338), _s(336)), (_s(352), _s(282)), (_s(310), _s(246)), (_s(365), _s(240))], fill=WHITE)
    return _finish(img)


DRAW = {"dollar": draw_dollar, "chart": draw_chart, "email": draw_email, "calendar": draw_calendar, "phone": draw_phone,
        "funnel": draw_funnel, "clock": draw_clock, "heart": draw_heart, "lightbulb": draw_lightbulb, "target": draw_target,
        "trophy": draw_trophy}


def make(name, out):
    """Draw `name` to `out`. Stills: `out` is a .png path. Animated: `out` is a folder that gets f_000.png ... f_023.png.
    Returns `out`. Raises KeyError for an unknown name."""
    if name not in DRAW:
        raise KeyError(name)
    if is_animated(name):
        os.makedirs(out, exist_ok=True)
        for i in range(FRAMES):
            draw_chart(i / (FRAMES - 1)).save(os.path.join(out, f"f_{i:03d}.png"), "PNG")
        return out
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    DRAW[name]().save(out, "PNG")
    return out
