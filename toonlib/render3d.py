"""3D cartoon renderer: story JSON -> MP4 via Blender (EEVEE, toon shading). CPU-only works.

Usage:
    python -m toonlib.render3d stories/demo.json -o out/demo_3d.mp4
    python -m toonlib.render3d stories/demo.json -o out/demo_3d.mp4 --preview      # half-res, fast
    python -m toonlib.render3d stories/demo.json --frame 5.0 -o still.png          # one still

Each scene is split into chunks; every chunk is rendered by its own headless
Blender process, then the chunks are faded, joined and given music. Hours-long
stories work the same way, just with more chunks.
"""
import argparse
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor

from . import story as S
from .render2d import finalize_audio

HERE = os.path.dirname(os.path.abspath(__file__))
SCENE_SCRIPT = os.path.join(HERE, "blender_scene.py")


def blender_bin():
    for c in (os.environ.get("BLENDER"), shutil.which("blender"),
              "/Applications/Blender.app/Contents/MacOS/Blender",
              r"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"):
        if c and os.path.exists(c):
            return c
    sys.exit("Blender not found. Install it (apt install blender / blender.org) or set BLENDER=/path/to/blender")


def run_chunk(job):
    story_path, idx, f0, f1, out, preview, log = job
    cmd = [blender_bin(), "-b", "--factory-startup", "-noaudio", "-P", SCENE_SCRIPT, "--",
           story_path, str(idx), str(f0), str(f1), out] + (["preview"] if preview else [])
    with open(log, "w") as lf:
        r = subprocess.run(cmd, stdout=lf, stderr=subprocess.STDOUT)
    # Blender names animation output with the frame range suffix unless the path has an extension it keeps
    if not os.path.exists(out):
        cands = [p for p in os.listdir(os.path.dirname(out)) if p.startswith(os.path.basename(out)[:-4])]
        if cands:
            os.rename(os.path.join(os.path.dirname(out), cands[0]), out)
    if r.returncode != 0 or not os.path.exists(out):
        tail = open(log).read()[-2000:]
        raise RuntimeError(f"Blender failed for scene {idx} frames {f0}-{f1}:\n{tail}")
    return out


def render_video(story_path, out, workers=2, preview=False, chunk_seconds=20, music_on=True):
    story = S.load_story(story_path)
    fps = story["fps"]
    tmp = tempfile.mkdtemp(prefix="toon3d_")
    jobs, plan = [], []
    for idx, sd in enumerate(story["scenes"]):
        n = int(round(sd["duration"] * fps))
        k = max(1, math.ceil(n / (chunk_seconds * fps)))
        bounds = [round(i * n / k) for i in range(k + 1)]
        for c in range(k):
            f0, f1 = bounds[c], bounds[c + 1]
            seg = os.path.join(tmp, f"s{idx:04d}_{c:03d}.mp4")
            jobs.append((os.path.abspath(story_path), idx, f0, f1, seg, preview, seg + ".log"))
            plan.append((sd, f0, f1, n, seg))
    total = sum(j[3] - j[2] for j in jobs)
    print(f"3D: {len(story['scenes'])} scenes, {total} frames ({total / fps:.1f}s), {len(jobs)} Blender jobs, {workers} parallel")
    t0 = time.time()
    done = 0
    with ThreadPoolExecutor(workers) as ex:
        for seg in ex.map(run_chunk, jobs):
            done += 1
            el = time.time() - t0
            print(f"  [{done}/{len(jobs)}] {os.path.basename(seg)}  elapsed {el / 60:.1f} min, "
                  f"eta ~{el / done * (len(jobs) - done) / 60:.1f} min", flush=True)

    # scene fades, applied per chunk (only the chunk holding a scene's start/end gets a fade)
    faded = []
    w, h = story["resolution"]
    if preview:
        w, h = w // 2, h // 2
    for i, (sd, f0, f1, n, seg) in enumerate(plan):
        f = sd.get("fade", 0.4)
        filters = [f"scale={w}:{h}", "format=yuv420p"]
        if f > 0 and f0 == 0:
            filters.append(f"fade=t=in:st=0:d={f}")
        if f > 0 and f1 == n:
            filters.append(f"fade=t=out:st={max(0, (f1 - f0) / fps - f)}:d={f}")
        fo = seg.replace(".mp4", "_f.mp4")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", seg, "-vf", ",".join(filters), "-r", str(fps),
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", fo], check=True)
        faded.append(fo)
    listfile = os.path.join(tmp, "list.txt")
    with open(listfile, "w") as fh:
        fh.writelines(f"file '{p}'\n" for p in faded)
    joined = os.path.join(tmp, "joined.mp4")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", listfile,
                    "-c", "copy", joined], check=True)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    finalize_audio(story, joined, out, tmp, music_on)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"Done: {out}  ({(time.time() - t0) / 60:.1f} min)")


def render_still(story_path, t, out):
    story = S.load_story(story_path)
    sc, lt, idx = S.scene_at(story, t)
    f = int(lt * story["fps"])
    tmp = tempfile.mkdtemp(prefix="toon3d_")
    seg = os.path.join(tmp, "still.mp4")
    run_chunk((os.path.abspath(story_path), idx, f, f + 1, seg, False, seg + ".log"))
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", seg, "-frames:v", "1", out], check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    print("Saved", out)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Render a story JSON as a 3D cartoon video with Blender")
    ap.add_argument("story")
    ap.add_argument("-o", "--out", default="out/video_3d.mp4")
    ap.add_argument("--workers", type=int, default=2, help="parallel Blender processes")
    ap.add_argument("--preview", action="store_true", help="half resolution, fewer samples")
    ap.add_argument("--chunk-seconds", type=float, default=20)
    ap.add_argument("--no-music", action="store_true")
    ap.add_argument("--frame", type=float, default=None, help="render one still at this time (s) to PNG")
    a = ap.parse_args(argv)
    if a.frame is not None:
        render_still(a.story, a.frame, a.out)
    else:
        render_video(a.story, a.out, a.workers, a.preview, a.chunk_seconds, not a.no_music)


if __name__ == "__main__":
    main()
