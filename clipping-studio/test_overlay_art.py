import os
import shutil
import subprocess

import pytest
from PIL import Image

from engine import overlay_art as oa
from engine import overlays


def W(word, start, end=None):
    return {"word": word, "start": start, "end": end if end is not None else start + 0.3}


@pytest.mark.parametrize("name", sorted(oa.DRAW))
def test_every_drawing_is_a_transparent_768_square(name):
    img = oa.DRAW[name]()
    assert img.size == (oa.SIZE, oa.SIZE) and img.mode == "RGBA"
    lo, hi = img.getchannel("A").getextrema()
    assert lo == 0 and hi == 255                               # a cut-out: transparent around, solid inside


def test_make_writes_a_png_or_a_folder_of_frames(tmp_path):
    png = oa.make("email", str(tmp_path / "email.png"))
    assert Image.open(png).size == (oa.SIZE, oa.SIZE)
    folder = oa.make("chart", str(tmp_path / "chart"))
    frames = sorted(os.listdir(folder))
    assert len(frames) == oa.FRAMES and frames[0] == "f_000.png" and frames[-1] == f"f_{oa.FRAMES - 1:03d}.png"
    first, last = Image.open(os.path.join(folder, frames[0])), Image.open(os.path.join(folder, frames[-1]))
    assert first.tobytes() != last.tobytes()                   # the bars really grow
    with pytest.raises(KeyError):
        oa.make("nope", str(tmp_path / "x.png"))


def test_subjects_map_to_drawings_and_the_business_words_reach_them():
    assert oa.art_for_subject("stack of cash bills") == "dollar" and oa.art_for_subject("unknown") is None
    assert oa.is_animated("chart") and not oa.is_animated("email")
    for word, art in (("email", "email"), ("emails", "email"), ("meetings", "calendar"), ("calls", "phone"),
                      ("leads", "funnel"), ("results", "chart"), ("million", "dollar"), ("money", "dollar"),
                      ("time", "clock"), ("love", "heart"), ("idea", "lightbulb"), ("goal", "target"), ("success", "trophy")):
        key = overlays.normalize_word(word)
        assert oa.art_for_subject(overlays.subject_for(key)) == art, word


def test_every_drawing_is_reachable_from_some_word():
    reachable = {oa.art_for_subject(s) for s in overlays.CONCEPTS.values()}
    assert set(oa.DRAW) <= reachable


def test_b2b_transcript_picks_graphics_with_no_setup():
    words = [W("We", 0.5), W("sent", 1.0), W("emails", 2.5), W("booked", 8.0), W("meetings", 8.4), W("results", 14.5)]
    keys = [p["keyword"] for p in overlays.pick_overlays(words, duration=25.0)]
    assert "email" in keys and "meeting" in keys or "meetings" in keys or "booked" in keys
    assert "results" in keys


def test_resolve_prefers_your_art_then_draws_the_built_in_one_offline(tmp_path):
    lib, cache = tmp_path / "lib", tmp_path / "cache"
    lib.mkdir()
    Image.new("RGBA", (200, 200), (255, 0, 0, 255)).save(lib / "money.png")
    mine = overlays.resolve_asset("money", "stack of cash bills", str(lib), str(cache), None)
    assert mine == str(lib / "money.png")                       # your PNG beats the built-in drawing
    built = overlays.resolve_asset("cash", "stack of cash bills", str(lib / "none"), str(cache), None)
    assert os.path.isfile(built) and built.endswith("builtin-dollar.png")
    assert overlays.resolve_asset("cash", "stack of cash bills", str(lib / "none"), str(cache), None) == built   # cached
    chart = overlays.resolve_asset("results", "rising stock chart arrow", str(lib / "none"), str(cache), None)
    assert os.path.isdir(chart) and os.path.isfile(os.path.join(chart, "f_000.png"))
    assert overlays.resolve_asset("zzz", "unknown thing", str(lib / "none"), str(cache), None) is None


def test_generator_is_only_called_when_there_is_no_built_in_art(tmp_path):
    calls = []
    gen = lambda subject, out: calls.append(subject)
    overlays.resolve_asset("cash", "stack of cash bills", str(tmp_path / "l"), str(tmp_path / "c"), gen)
    assert calls == []
    overlays.resolve_asset("pizza", "whole pizza", str(tmp_path / "l"), str(tmp_path / "c"), gen)
    assert calls == ["whole pizza"]


def test_command_reads_a_folder_of_frames_as_a_sequence(tmp_path):
    folder = oa.make("chart", str(tmp_path / "chart"))
    cmd = overlays.build_overlay_command("ffmpeg", "in.mp4", [{"start": 3.0, "end": 5.2, "asset": folder}], (1080, 1920), "o.mp4")
    assert any(a.endswith("f_%03d.png") for a in cmd)
    graph = cmd[cmd.index("-filter_complex") + 1]
    assert "tpad=stop_mode=clone" in graph and "trim=duration=2.200" in graph


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg missing")
def test_animated_and_still_graphics_render_and_keep_audio(tmp_path):
    v = tmp_path / "clip.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=gray:s=540x960:r=30:d=12",
                    "-f", "lavfi", "-i", "sine=frequency=300:duration=12", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-shortest", str(v)], check=True)
    res = lambda kw, subj, text_fallback=False: overlays.resolve_asset(kw, subj, str(tmp_path / "lib"), str(tmp_path / "cache"), None)
    assert overlays.apply_to_clip(str(v), [W("results", 2.5), W("email", 8.0)], resolve=res, face_aware=False) == 2
    err = subprocess.run(["ffmpeg", "-i", str(v)], capture_output=True, text=True).stderr
    assert "Audio:" in err and "Duration: 00:00:12" in err
