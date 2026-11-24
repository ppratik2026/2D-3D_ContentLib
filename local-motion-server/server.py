"""
AI motion server for the "Video Generation" Chrome extension (v4.3).
Turns each scene picture into a real moving video clip (image-to-video) on a GPU,
optionally with lip-sync to the scene's voice. Runs on your own PC or on a free
Kaggle / Colab GPU (see kaggle_colab.ipynb).

  python server.py --model ltx  --port 7871               (fast, ~12 GB VRAM)
  python server.py --model wan  --port 7871               (better, ~24 GB VRAM)
  python server.py --model mock --port 7871               (no GPU, only to test the connection)
  add --lipsync to sync the speaker's lips to the voice (LatentSync, install_lipsync first)
  add --token SECRET to require that token (always do this on Kaggle / Colab)

Endpoints (JSON):
  GET  /health            -> {"ok", "model", "ready", "device", "vram_gb", "lipsync", "error", "queue"}
  POST /animate           -> body {"image": b64, "prompt", "negative", "seconds", "width", "height",
                              "audio": b64 wav (optional), "lipsync": bool, "seed"}  -> {"job": id}
  GET  /job?id=ID         -> {"state": queued|running|done|error, "progress": 0-1, "message", "error"}
  GET  /result?id=ID      -> video/mp4
Only the standard library here; each model's libraries are imported by its backend.
"""
import argparse
import base64
import importlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
WORK = os.path.join(HERE, "motion_jobs")

STATE = {"model": None, "backend": None, "ready": False, "error": None, "device": "cpu", "vram_gb": 0,
         "lipsync": False, "lipsync_error": None, "token": ""}
JOBS = {}
QUEUE = []
QLOCK = threading.Condition()


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def ffmpeg_bin():
    for c in (os.environ.get("FFMPEG"), shutil.which("ffmpeg")):
        if c:
            return c
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def run(cmd):
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if p.returncode != 0:
        raise RuntimeError(" ".join(cmd[:3]) + " failed: " + p.stdout[-800:])
    return p.stdout


def last_frame(video, out_png):
    run([ffmpeg_bin(), "-loglevel", "error", "-y", "-sseof", "-0.1", "-i", video, "-frames:v", "1", out_png])


def concat(parts, out):
    lst = out + ".txt"
    with open(lst, "w") as f:
        for p in parts:
            f.write("file '%s'\n" % p.replace("\\", "/"))
    run([ffmpeg_bin(), "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst,
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", out])


def trim(src, seconds, out):
    run([ffmpeg_bin(), "-loglevel", "error", "-y", "-i", src, "-t", "%.3f" % seconds, "-an",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", out])


# ---------------------------------------------------------------- the job worker
def do_job(job):
    d = job["dir"]
    req = job["req"]
    img = os.path.join(d, "in.png")
    with open(img, "wb") as f:
        f.write(base64.b64decode(req["image"]))
    audio = None
    if req.get("audio"):
        audio = os.path.join(d, "voice.wav")
        with open(audio, "wb") as f:
            f.write(base64.b64decode(req["audio"]))
    seconds = max(1.0, min(60.0, float(req.get("seconds") or 5)))
    B = STATE["backend"]
    seg_len = B.SEGMENT_SECONDS
    n_seg = max(1, int(-(-seconds // seg_len)))  # ceil
    parts, start = [], img
    for k in range(n_seg):
        job["message"] = "clip %d/%d" % (k + 1, n_seg)

        def prog(p, k=k):
            job["progress"] = min(0.95, (k + p) / n_seg * (0.8 if audio and req.get("lipsync") else 1.0))

        out = os.path.join(d, "seg%02d.mp4" % k)
        B.animate(start, req.get("prompt") or "", req.get("negative") or "", out,
                  width=int(req.get("width") or 0), height=int(req.get("height") or 0),
                  seed=int(req.get("seed") or 0) + k, progress=prog)
        parts.append(out)
        if k < n_seg - 1:  # agla hissa pichhle ke aakhri frame se — ek hi lambi chaal
            start = os.path.join(d, "last%02d.png" % k)
            last_frame(out, start)
    joined = os.path.join(d, "joined.mp4")
    concat(parts, joined) if len(parts) > 1 else shutil.copy(parts[0], joined)
    final = os.path.join(d, "final.mp4")
    trim(joined, seconds, final)
    if audio and req.get("lipsync"):
        if STATE["lipsync"]:
            job["message"] = "lip-sync"
            try:
                import lipsync
                synced = os.path.join(d, "synced.mp4")
                lipsync.sync(final, audio, synced)
                trim(synced, seconds, final)
                job["lipsynced"] = True
            except Exception as e:
                job["warning"] = "lip-sync skipped: %s" % str(e)[:300]
                log("lip-sync failed:", e)
        else:
            job["warning"] = "lip-sync is not installed on this server"
    job["result"] = final
    job["progress"] = 1.0


def worker():
    while True:
        with QLOCK:
            while not QUEUE:
                QLOCK.wait()
            jid = QUEUE.pop(0)
        job = JOBS.get(jid)
        if not job:
            continue
        job["state"] = "running"
        t0 = time.time()
        try:
            do_job(job)
            job["state"] = "done"
            job["message"] = "done in %ds" % (time.time() - t0)
            log("job", jid, "done in %.0fs" % (time.time() - t0))
        except Exception as e:
            traceback.print_exc()
            job["state"] = "error"
            job["error"] = str(e)[:500]


def cleanup_old():
    now = time.time()
    for jid, j in list(JOBS.items()):
        if now - j["created"] > 6 * 3600:
            shutil.rmtree(j["dir"], ignore_errors=True)
            JOBS.pop(jid, None)


# ---------------------------------------------------------------- HTTP
class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type, x-token")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self._cors()
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def _auth(self):
        tok = STATE["token"]
        if tok and self.headers.get("x-token", "") != tok:
            self._json(401, {"ok": False, "error": "wrong or missing token"})
            return False
        return True

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path, _, q = self.path.partition("?")
        args = dict(p.split("=", 1) for p in q.split("&") if "=" in p)
        if path == "/health":
            if not self._auth():
                return
            return self._json(200, {"ok": True, "model": STATE["model"], "ready": STATE["ready"], "device": STATE["device"],
                                    "vram_gb": STATE["vram_gb"], "lipsync": STATE["lipsync"], "lipsync_error": STATE["lipsync_error"],
                                    "error": STATE["error"], "queue": len(QUEUE),
                                    "segment_seconds": getattr(STATE["backend"], "SEGMENT_SECONDS", None)})
        if not self._auth():
            return
        job = JOBS.get(args.get("id", ""))
        if path == "/job":
            if not job:
                return self._json(404, {"state": "error", "error": "unknown job (server restarted?)"})
            pos = QUEUE.index(job["id"]) + 1 if job["id"] in QUEUE else 0
            return self._json(200, {"state": job["state"], "progress": job["progress"], "message": job.get("message", ""),
                                    "error": job.get("error"), "warning": job.get("warning"), "lipsynced": job.get("lipsynced", False),
                                    "queue_position": pos})
        if path == "/result":
            if not job or job["state"] != "done":
                return self._json(404, {"error": "not ready"})
            with open(job["result"], "rb") as f:
                b = f.read()
            self.send_response(200)
            self._cors()
            self.send_header("content-type", "video/mp4")
            self.send_header("content-length", str(len(b)))
            self.end_headers()
            self.wfile.write(b)
            return
        self._json(404, {"error": "not found"})

    def do_POST(self):
        if not self._auth():
            return
        if self.path.split("?")[0] != "/animate":
            return self._json(404, {"error": "not found"})
        if not STATE["ready"]:
            return self._json(503, {"error": "model not ready: %s" % (STATE["error"] or "still loading")})
        n = int(self.headers.get("content-length", "0"))
        try:
            req = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return self._json(400, {"error": "bad JSON"})
        if not req.get("image"):
            return self._json(400, {"error": "image missing"})
        cleanup_old()
        jid = uuid.uuid4().hex[:12]
        d = os.path.join(WORK, jid)
        os.makedirs(d, exist_ok=True)
        JOBS[jid] = {"id": jid, "dir": d, "req": req, "state": "queued", "progress": 0.0, "created": time.time()}
        with QLOCK:
            QUEUE.append(jid)
            QLOCK.notify()
        log("job", jid, "queued · %.1fs · %s" % (float(req.get("seconds") or 5), (req.get("prompt") or "")[:70]))
        self._json(200, {"job": jid})


def load(model, device, want_lipsync):
    try:
        if device != "cpu":
            try:
                import torch
                if torch.cuda.is_available():
                    STATE["device"] = "cuda"
                    STATE["vram_gb"] = round(torch.cuda.get_device_properties(0).total_memory / 2**30, 1)
            except Exception:
                pass
        mod = importlib.import_module("backends." + model)
        log("loading %s on %s (first time downloads the model, this can take a while)..." % (model, STATE["device"]))
        mod.load(STATE["device"])
        STATE["backend"] = mod
        STATE["ready"] = True
        log("%s ready" % model)
    except Exception as e:
        traceback.print_exc()
        STATE["error"] = "%s: %s" % (type(e).__name__, str(e)[:400])
    if want_lipsync:
        try:
            import lipsync
            lipsync.check()
            STATE["lipsync"] = True
            log("lip-sync (LatentSync) ready")
        except Exception as e:
            STATE["lipsync_error"] = str(e)[:300]
            log("lip-sync not available:", e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="ltx", choices=["ltx", "wan", "mock"])
    ap.add_argument("--port", type=int, default=7871)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--device", default="auto")
    ap.add_argument("--lipsync", action="store_true")
    ap.add_argument("--token", default=os.environ.get("MOTION_TOKEN", ""))
    a = ap.parse_args()
    STATE["model"] = a.model
    STATE["token"] = a.token
    os.makedirs(WORK, exist_ok=True)
    threading.Thread(target=load, args=(a.model, a.device, a.lipsync), daemon=True).start()
    threading.Thread(target=worker, daemon=True).start()
    log("AI motion server on http://%s:%d  (model: %s%s)" % (a.host, a.port, a.model, ", token required" if a.token else ""))
    ThreadingHTTPServer((a.host, a.port), H).serve_forever()


if __name__ == "__main__":
    main()
