"""Builds kaggle_colab.ipynb with the server files written inside it (nothing else to upload)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
def md(s): return {"cell_type": "markdown", "metadata": {}, "source": s}
def code(s): return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [], "source": s}
files = ["server.py", "lipsync.py", "backends/__init__.py", "backends/common.py", "backends/mock.py", "backends/ltx.py", "backends/wan.py"]
cells = [md("""# 🎞 AI motion server on a free GPU (Kaggle / Colab)
Makes your scene pictures move for real (image-to-video) for the **Video Generation** extension.

1. **Kaggle**: Settings → Accelerator → **GPU T4 ×2**, and **Internet: On**. **Colab**: Runtime → Change runtime type → **T4 GPU**.
2. Run every cell from top to bottom.
3. The last cell prints a **link** and a **token**: paste both in the extension (Video tab → 🎞 AI motion).
4. Keep this tab open while the clips are made."""),
 code("!nvidia-smi --query-gpu=name,memory.total --format=csv || echo 'NO GPU: turn the GPU on in the settings first'"),
 code("# Settings\nMODEL = 'ltx'        # 'ltx' (fast, fits a T4) or 'wan' (better, needs 24 GB+)\nLIPSYNC = False      # True = also install LatentSync lip-sync (+10 min install, needs front-facing faces)\nPORT = 7871")]
cells.append(code("import os\nos.makedirs('motion/backends', exist_ok=True)\n%cd motion"))
for f in files:
    cells.append(code("%%writefile " + f + "\n" + open(os.path.join(HERE, f)).read()))
cells += [
 code("!pip -q install 'diffusers>=0.33' transformers accelerate sentencepiece ftfy imageio imageio-ffmpeg\n!wget -q -O cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 && chmod +x cloudflared"),
 code("""# Optional lip-sync (LatentSync) in its own environment so its versions do not clash
if LIPSYNC:
    !git clone -q https://github.com/bytedance/LatentSync.git
    !python -m venv LatentSync/venv && LatentSync/venv/bin/pip -q install -r LatentSync/requirements.txt huggingface_hub
    !cd LatentSync && venv/bin/huggingface-cli download ByteDance/LatentSync-1.5 --local-dir checkpoints --exclude "*.git*" "README.md"
    os.environ['LATENTSYNC_PY'] = os.path.abspath('LatentSync/venv/bin/python')"""),
 code("""# Start the server + a public link
import subprocess, secrets, time, re, os
TOKEN = secrets.token_urlsafe(12)
args = ['python', 'server.py', '--model', MODEL, '--port', str(PORT), '--token', TOKEN] + (['--lipsync'] if LIPSYNC else [])
srv = subprocess.Popen(args, stdout=open('server.log', 'w'), stderr=subprocess.STDOUT)
tun = subprocess.Popen(['./cloudflared', 'tunnel', '--url', f'http://127.0.0.1:{PORT}', '--no-autoupdate'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
url = None
for line in tun.stdout:
    m = re.search(r'https://[a-z0-9-]+\\.trycloudflare\\.com', line)
    if m: url = m.group(0); break
print('=' * 60)
print('Server link :', url)
print('Token       :', TOKEN)
print('=' * 60)
print('Paste both in the extension: Video tab -> 🎞 AI motion. The model loads now (first time: download, several minutes).')"""),
 code("""# Watch the server (run again any time to see the latest lines)
!tail -n 25 server.log"""),
 md("Keep this tab open while the extension makes the clips. If the session stops, run the cells again: you get a new link and token."),
]
nb = {"cells": cells, "metadata": {"accelerator": "GPU", "colab": {"provenance": []}, "kernelspec": {"display_name": "Python 3", "name": "python3"}, "language_info": {"name": "python"}}, "nbformat": 4, "nbformat_minor": 0}
json.dump(nb, open(os.path.join(HERE, "kaggle_colab.ipynb"), "w"), indent=1, ensure_ascii=False)
print("wrote kaggle_colab.ipynb with", len(cells), "cells")
