import json
import shutil
import subprocess

import pytest

from engine import screen_cam as sc


def test_parse_time_accepts_minutes_hours_and_seconds():
    assert sc.parse_time("4:12") == 252
    assert sc.parse_time("1:02:03") == 3723
    assert sc.parse_time("252") == 252
    assert sc.parse_time("7:33.5") == pytest.approx(453.5)
    with pytest.raises(ValueError):
        sc.parse_time("1:2:3:4")


def test_clip_plan_text_lines_titles_and_comments(tmp_path):
    p = tmp_path / "plan.txt"
    p.write_text("# first video\n7:33-7:57  Do not go direct offer\n\n4:12 - 4:41 - Claude objections -> close rate\n0:03 to 0:39\n",
                 encoding="utf-8")
    items = sc.parse_clip_plan(str(p))
    assert [(i["start"], i["end"]) for i in items] == [(3, 39), (252, 281), (453, 477)]     # sorted by start
    assert items[1]["title"] == "Claude objections -> close rate"
    assert items[2]["title"] == "Do not go direct offer"
    assert items[0]["title"] == ""


def test_clip_plan_json_and_errors(tmp_path):
    p = tmp_path / "plan.json"
    p.write_text(json.dumps([{"start": "4:12", "end": 281, "title": "A"}]), encoding="utf-8")
    assert sc.parse_clip_plan(str(p)) == [{"start": 252, "end": 281, "title": "A"}]
    bad = tmp_path / "bad.txt"
    bad.write_text("not a clip line\n", encoding="utf-8")
    with pytest.raises(ValueError):
        sc.parse_clip_plan(str(bad))
    backwards = tmp_path / "back.txt"
    backwards.write_text("5:00-4:00 oops\n", encoding="utf-8")
    with pytest.raises(ValueError):
        sc.parse_clip_plan(str(backwards))
    long = tmp_path / "long.txt"
    long.write_text("0:00-3:00 too long\n", encoding="utf-8")
    with pytest.raises(ValueError):
        sc.parse_clip_plan(str(long))


def test_plan_to_highlights_has_what_the_pipeline_reads():
    h = sc.plan_to_highlights([{"start": 252, "end": 281, "title": "Claude objections"}])[0]
    assert h["start"] == 252 and h["end"] == 281 and h["hook_text"] == "Claude objections" and h["final_score"] > 0


def test_cam_box_parsing():
    assert sc.parse_cam_box("0.02,0.6,0.3,0.36") == (0.02, 0.6, 0.3, 0.36)
    for bad in ("1,2,3", "a,b,c,d", "0.1,0.1,0,0.3", "1.5,0.1,0.2,0.2"):
        with pytest.raises(ValueError):
            sc.parse_cam_box(bad)


def test_windows_stay_inside_the_frame():
    for face in [(0.1, 0.9, 0.12), (0.9, 0.05, 0.3), (0.5, 0.5, 0.01)]:
        cx, cy, wh = sc.window_from_face(face)
        assert sc.MIN_WINDOW <= wh <= sc.MAX_WINDOW
        assert wh / 2 <= cy <= 1 - wh / 2
    cx, cy, wh = sc.window_from_box((0.0, 0.65, 0.3, 0.35))
    assert wh >= 0.35 and wh / 2 <= cy <= 1 - wh / 2


def test_detect_cam_uses_box_then_faces_then_gives_up():
    box = (0.01, 0.65, 0.29, 0.31)
    assert sc.detect_cam("x.mp4", 0, 5, cam_box=box) == sc.window_from_box(box)
    small_face = lambda video, **kw: [(0.1, 0.8, 0.12), None, (0.11, 0.8, 0.12)]
    cam = sc.detect_cam("x.mp4", 0, 5, face_track=small_face)
    assert isinstance(cam, tuple) and len(cam) == 3
    big_face = lambda video, **kw: [(0.5, 0.5, 0.45)] * 4
    assert sc.detect_cam("x.mp4", 0, 5, face_track=big_face) == "talking_head"      # full-screen webcam: no screen to show
    assert sc.detect_cam("x.mp4", 0, 5, face_track=lambda video, **kw: [None, None]) is None
    def boom(video, **kw):
        raise RuntimeError("no detector")
    assert sc.detect_cam("x.mp4", 0, 5, face_track=boom) is None


def test_filter_has_both_halves_and_even_sizes():
    vf = sc.generate_filter(1080, 1920, (0.15, 0.8, 0.3), zoom="crop=iw*0.8:ih*0.8:iw*0.1:ih*0.1")
    assert "vstack=inputs=2" in vf and "scale=1080:640" in vf and "scale=1080:1280" in vf
    assert "crop=iw*0.8" in vf                                  # the zoom applies to the screen half only
    assert vf.index("crop=iw*0.8") > vf.index("[scscr]")


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg missing")
def test_filter_renders_a_1080x1920_frame(tmp_path):
    src = tmp_path / "src.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=2",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", str(src)], check=True)
    out = tmp_path / "out.png"
    vf = sc.generate_filter(1080, 1920, sc.window_from_box((0.01, 0.65, 0.29, 0.31)))
    res = subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "1", "-i", str(src), "-vf", vf, "-frames:v", "1", str(out)],
                         capture_output=True, text=True)
    assert res.returncode == 0, res.stderr
    info = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height", "-of", "csv=p=0", str(out)],
                          capture_output=True, text=True).stdout.strip()
    assert info == "1080,1920"
