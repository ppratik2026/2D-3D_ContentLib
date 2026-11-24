"""No GPU needed: makes a slow zoom clip with ffmpeg. Only to test the extension <-> server connection."""
import subprocess
import time

from server import ffmpeg_bin

SEGMENT_SECONDS = 5.0


def load(device):
    pass


def animate(image, prompt, negative, out, width=0, height=0, seed=0, progress=lambda p: None):
    for k in range(5):
        progress(k / 5)
        time.sleep(0.2)
    fps, n = 24, int(SEGMENT_SECONDS * 24)
    vf = ("scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,"
          "zoompan=z='1+0.0015*on':x='iw/2-(iw/zoom/2)+sin(on/9)*6':y='ih/2-(ih/zoom/2)':d=%d:s=1280x720:fps=%d" % (n, fps))
    subprocess.run([ffmpeg_bin(), "-loglevel", "error", "-y", "-loop", "1", "-i", image, "-vf", vf, "-frames:v", str(n),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", out], check=True)
    progress(1)
