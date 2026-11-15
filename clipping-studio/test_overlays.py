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
