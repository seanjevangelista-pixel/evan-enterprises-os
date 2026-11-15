import os
import shutil
import subprocess

import pytest
from PIL import Image, ImageDraw

from engine import overlays


def W(word, start, end=None):
    return {"word": word, "start": start, "end": end if end is not None else start + 0.3}


def test_normalize_and_subjects():
    assert overlays.normalize_word("Love,") == "love"
    assert overlays.normalize_word("Cars!") == "car"
    assert overlays.subject_for("love") == "glossy red 3D heart"
    assert overlays.subject_for("lego") == "colorful Lego brick set"
    assert overlays.subject_for("really") is None


def test_pick_respects_start_spacing_end_guard_and_dedupes():
    words = [W("love", 0.4), W("time", 2.0), W("lego", 3.0), W("money", 5.2), W("love", 12.0), W("goal", 19.8)]
    picks = overlays.pick_overlays(words, duration=20.0)
    keys = [p["keyword"] for p in picks]
    assert "love" not in keys[:1] or picks[0]["start"] >= overlays.MIN_START   # first love is inside the hook
    starts = [p["start"] for p in picks]
    assert starts == sorted(starts)
    assert all(b - a >= overlays.MIN_SPACING for a, b in zip(starts, starts[1:]))
    assert all(overlays.MIN_LEN <= p["end"] - p["start"] <= overlays.MAX_LEN for p in picks)
    assert all(p["end"] <= 20.0 - overlays.TAIL_GUARD for p in picks)
    assert "goal" not in keys                       # too close to the end
    assert len(keys) == len(set(keys))


def test_pick_caps_the_count_and_ignores_plain_words():
    words = [W("love", 2 + 6 * i) for i in range(1)] + [W(w, 8 + 6 * i) for i, w in enumerate(
        ["time", "money", "goal", "idea", "success", "growth", "freedom"])]
    assert len(overlays.pick_overlays(words, duration=80.0)) == overlays.MAX_PER_CLIP
    assert overlays.pick_overlays([W("really", 3.0), W("important", 6.0)], duration=30.0) == []


def test_llm_subjects_can_add_graphics_and_failures_fall_back():
    words = [W("tacos", 3.0)]
    picks = overlays.pick_overlays(words, duration=20.0, ask=lambda p: {"tacos": "plate of three tacos"})
    assert picks and picks[0]["subject"] == "plate of three tacos"
    def boom(_):
        raise RuntimeError("no network")
    assert overlays.pick_overlays(words, duration=20.0, ask=boom) == []


def _opaque_white_heart(path):
    im = Image.new("RGBA", (400, 400), (255, 255, 255, 255))
    ImageDraw.Draw(im).ellipse((100, 100, 300, 300), fill=(220, 20, 60, 255))
    im.save(path)


def test_key_background_makes_flat_backdrop_transparent(tmp_path):
    src = tmp_path / "raw.png"
    _opaque_white_heart(src)
    out = overlays.key_background(Image.open(src))
    assert out.getpixel((5, 5))[3] == 0            # corner: backdrop gone
    assert out.getpixel((200, 200))[3] == 255      # centre: subject kept


def test_prepare_png_trims_fits_and_keeps_transparency(tmp_path):
    src, dst = tmp_path / "raw.png", tmp_path / "ready.png"
    _opaque_white_heart(src)
    overlays.prepare_png(src, dst)
    img = Image.open(dst)
    assert img.mode == "RGBA" and max(img.size) <= overlays.ASSET_SIDE
    assert overlays.has_transparency(img)


def test_resolve_prefers_library_then_cache_then_generator(tmp_path):
    lib, cache = tmp_path / "lib", tmp_path / "cache"
    lib.mkdir()
    _opaque_white_heart(lib / "love.png")
    calls = []
    gen = lambda subject, out: calls.append(subject)
    assert overlays.resolve_asset("love", "glossy red 3D heart", str(lib), str(cache), gen) == str(lib / "love.png")
    assert calls == []                                      # your own art wins; nothing generated

    def fake_gen(subject, out):
        calls.append(subject)
        _opaque_white_heart(out)
        return out
    p = overlays.resolve_asset("time", "vintage alarm clock", str(lib), str(cache), fake_gen)
    assert p and os.path.isfile(p) and calls == ["vintage alarm clock"]
    overlays.resolve_asset("time", "vintage alarm clock", str(lib), str(cache), fake_gen)
    assert calls == ["vintage alarm clock"]                 # second time comes from the cache
    assert overlays.resolve_asset("zzz", "unknown thing", str(lib), str(cache), None) is None


def test_generate_openai_without_key_returns_none(tmp_path, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert overlays.generate_openai("heart", str(tmp_path / "x.png")) is None


def test_command_animates_and_positions():
    items = [{"start": 3.0, "end": 5.2, "asset": "a.png"}]
    cmd = overlays.build_overlay_command("ffmpeg", "in.mp4", items, (1080, 1920), "out.mp4", position="top")
    graph = cmd[cmd.index("-filter_complex") + 1]
    assert "eval=frame" in graph and "setpts=PTS+3.000/TB" in graph and "alpha=1" in graph
    assert "-c:a" in cmd and cmd[cmd.index("-c:a") + 1] == "copy"
    left = overlays.build_overlay_command("ffmpeg", "in.mp4", items, (1080, 1920), "o.mp4", position="left")
    assert left[left.index("-filter_complex") + 1] != graph


def test_horizontal_clip_is_left_alone(tmp_path):
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg missing")
    v = tmp_path / "wide.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=640x360:d=3", str(v)], check=True)
    before = v.read_bytes()
    assert overlays.apply_to_clip(str(v), [W("love", 1.5)]) == 0
    assert v.read_bytes() == before


def test_end_to_end_render_keeps_duration_and_audio(tmp_path):
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg missing")
    v = tmp_path / "clip.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=gray:s=540x960:r=30:d=8",
                    "-f", "lavfi", "-i", "sine=frequency=300:duration=8", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-shortest", str(v)], check=True)
    art = tmp_path / "love.png"
    _opaque_white_heart(art)
    resolve = lambda kw, subj, text_fallback=False: str(art)
    events = []
    assert overlays.apply_to_clip(str(v), [W("love", 3.0)], resolve=resolve, events=events) == 1
    assert events and events[0]["keyword"] == "love"
    err = subprocess.run(["ffmpeg", "-i", str(v)], capture_output=True, text=True).stderr
    assert "Audio:" in err and "Duration: 00:00:08" in err


def test_apply_never_raises_on_bad_input():
    assert overlays.apply_to_clip("does-not-exist.mp4", [W("love", 3.0)]) == 0


# ---------------------------------------------------------------------------------- face-aware placement

FRAME = (1080, 1920)
CAPTION_LIMIT = int((1150 - 170) * 1920 / 1920)   # the lowest row a graphic may reach with default captions


def test_face_zone_pads_and_unions_faces():
    assert overlays.face_zone([]) is None
    zone = overlays.face_zone([(0.4, 0.3, 0.6, 0.45)])
    assert zone[0] < 0.4 and zone[1] < 0.3 and zone[2] > 0.6 and zone[3] > 0.45     # padded all round
    two = overlays.face_zone([(0.1, 0.3, 0.3, 0.45), (0.7, 0.3, 0.9, 0.45)])
    assert two[0] <= 0.1 and two[2] >= 0.9                                           # one box around both people


def test_no_face_information_uses_the_preferred_spot():
    spot = overlays.place_graphic(FRAME, 1.0, None, preferred="top", bottom_limit=CAPTION_LIMIT)
    assert spot["slot"] == "top" and spot["cx"] == 540
    right = overlays.place_graphic(FRAME, 1.0, None, preferred="right", bottom_limit=CAPTION_LIMIT)
    assert right["slot"] == "right" and right["cx"] > 540


def test_graphic_moves_off_a_face_and_never_overlaps_it():
    face = (0.38, 0.06, 0.62, 0.20)            # a head sitting high in the frame, right where "top" would go
    zone = overlays.face_zone([face])
    spot = overlays.place_graphic(FRAME, 1.0, zone, preferred="top", bottom_limit=CAPTION_LIMIT)
    assert spot is not None and spot["slot"] != "top"
    half = spot["w"] * overlays.POP_GROW / 2
    box = ((spot["cx"] - half) / 1080, (spot["cy"] - half) / 1920, (spot["cx"] + half) / 1080, (spot["cy"] + half) / 1920)
    assert not overlays._overlap(box, zone)


def test_graphic_shrinks_when_only_a_small_gap_is_free():
    zone = (0.10, 0.0, 0.90, 0.40)             # people fill the top: the full-size spots all collide
    spot = overlays.place_graphic(FRAME, 1.0, zone, preferred="top", bottom_limit=CAPTION_LIMIT)
    if spot is not None:                       # if anything fits it must be clear, and smaller than full size
        assert spot["w"] < overlays.SIZE_FRAC * 1080


def test_graphic_is_skipped_when_every_spot_hits_the_face():
    zone = (0.0, 0.0, 1.0, 1.0)                # a face that fills the frame
    assert overlays.place_graphic(FRAME, 1.0, zone, bottom_limit=CAPTION_LIMIT) is None


def test_tall_graphic_stays_above_the_caption_line():
    spot = overlays.place_graphic(FRAME, 2.5, None, preferred="center", bottom_limit=CAPTION_LIMIT)
    if spot is not None:
        assert spot["cy"] + spot["w"] * 2.5 * overlays.POP_GROW / 2 <= CAPTION_LIMIT


def test_sample_faces_on_a_video_without_faces_returns_nothing(tmp_path):
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg missing")
    v = tmp_path / "plain.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=green:s=540x960:d=3", str(v)], check=True)
    assert overlays.sample_faces(str(v), 0.5, 2.5) == []
    assert overlays.sample_faces("missing.mp4", 0, 1) == []          # failure is a warning, not a crash


def _clip(tmp_path, seconds=8):
    v = tmp_path / "clip.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"color=c=gray:s=540x960:r=30:d={seconds}",
                    "-f", "lavfi", "-i", f"sine=frequency=300:duration={seconds}", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-shortest", str(v)], check=True)
    return v


def test_apply_places_each_graphic_by_the_faces_found(tmp_path):
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg missing")
    v, art = _clip(tmp_path, 14), tmp_path / "art.png"
    _opaque_white_heart(art)
    seen = []
    # head high in frame for the first graphic (top is blocked), nowhere in sight for the second
    faces = {3.0: [(0.38, 0.06, 0.62, 0.20)]}
    detect = lambda video, start, end: faces.get(round(start + overlays.LEAD, 1), [])
    items_seen = []
    real = overlays.render_overlays
    overlays.render_overlays = lambda video, items, frame, ffmpeg=None, position="top": (items_seen.extend(items) or real(video, items, frame, ffmpeg, position))
    try:
        n = overlays.apply_to_clip(str(v), [W("love", 3.0), W("time", 10.0)], face_aware=True, detect=detect,
                                   resolve=lambda kw, subj, text_fallback=False: str(art))
    finally:
        overlays.render_overlays = real
    assert n == 2
    by_kw = {i["keyword"]: i for i in items_seen}
    assert by_kw["love"]["slot"] != "top"          # moved off the face
    assert by_kw["time"]["slot"] == "top"          # no face there: preferred spot


def test_apply_skips_a_graphic_that_would_cover_the_face(tmp_path):
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg missing")
    v, art = _clip(tmp_path), tmp_path / "art.png"
    _opaque_white_heart(art)
    before = v.read_bytes()
    big_face = lambda video, start, end: [(0.0, 0.0, 1.0, 1.0)]
    assert overlays.apply_to_clip(str(v), [W("love", 3.0)], detect=big_face,
                                  resolve=lambda kw, subj, text_fallback=False: str(art)) == 0
    assert v.read_bytes() == before                # nothing placed, clip untouched


def test_face_aware_can_be_turned_off(tmp_path):
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg missing")
    v, art = _clip(tmp_path), tmp_path / "art.png"
    _opaque_white_heart(art)
    boom = lambda *a, **k: (_ for _ in ()).throw(AssertionError("detector must not run"))
    assert overlays.apply_to_clip(str(v), [W("love", 3.0)], face_aware=False, detect=boom,
                                  resolve=lambda kw, subj, text_fallback=False: str(art)) == 1
