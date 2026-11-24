"""Lip-sync with LatentSync (ByteDance, Apache-2.0): makes the speaker's lips follow the scene's voice.
Works best on realistic / 3D-style faces that face the camera; flat comic faces may not be found (then the clip
is used without lip-sync). Installed by install_lipsync.bat (or the Kaggle / Colab notebook) into ./LatentSync"""
import os
import subprocess
import sys

DIR = os.environ.get("LATENTSYNC_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "LatentSync"))
CONFIG = os.environ.get("LATENTSYNC_CONFIG", "configs/unet/stage2.yaml")
CKPT = os.environ.get("LATENTSYNC_CKPT", "checkpoints/latentsync_unet.pt")
PY = os.environ.get("LATENTSYNC_PY", sys.executable)


def check():
    for p in (DIR, os.path.join(DIR, CKPT), os.path.join(DIR, "checkpoints", "whisper", "tiny.pt")):
        if not os.path.exists(p):
            raise RuntimeError("LatentSync not installed (missing %s)" % p)


def sync(video, audio, out):
    cmd = [PY, "-m", "scripts.inference", "--unet_config_path", CONFIG, "--inference_ckpt_path", CKPT,
           "--inference_steps", os.environ.get("LATENTSYNC_STEPS", "20"), "--guidance_scale", "1.5",
           "--video_path", os.path.abspath(video), "--audio_path", os.path.abspath(audio), "--video_out_path", os.path.abspath(out)]
    p = subprocess.run(cmd, cwd=DIR, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    if p.returncode != 0 or not os.path.exists(out):
        tail = p.stdout[-600:]
        if "face" in tail.lower():
            raise RuntimeError("no face found for lip-sync")
        raise RuntimeError(tail)
