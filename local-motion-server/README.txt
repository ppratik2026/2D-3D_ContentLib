Video Generation — AI motion server (v4.3)
==========================================
Makes every scene picture MOVE for real (image-to-video): people walk, turn, gesture, cars drive, rain falls —
and, with lip-sync on, the speaker's lips follow the scene's voice. Free: it runs on YOUR GPU, or on the free GPU
of Kaggle / Colab. The extension sends each picture + a motion prompt (+ the voice) and puts the clip in the video
in place of the still picture (as a "key-shot clip").

WHICH MODEL
- ltx  (start_ltx.bat):  LTX-Video. Fast. NVIDIA GPU with 12-16 GB (RTX 3060 12 GB, 4060 Ti 16 GB, Kaggle / Colab T4).
- wan  (start_wan.bat):  Wan 2.1 480p. Better motion and faces, much slower. 24 GB GPU (RTX 3090 / 4090).
- mock (start_mock.bat): no GPU, only a slow zoom — to check that the extension reaches the server.
Each clip is about 5 s; longer lines are made of several clips, each one starting from the last frame of the one before.

ON YOUR PC (NVIDIA GPU)
1. Install Python 3.11 (python.org, tick "Add python.exe to PATH").
2. Double-click install.bat (once).
3. Optional lip-sync: install git, then double-click install_lipsync.bat (once).
4. Double-click start_ltx.bat (or start_wan.bat) and keep the window open. The first start downloads the model.
5. Extension: Video tab -> 🎞 AI motion -> Server = http://127.0.0.1:7871 -> 🔌 Test -> ✨ Write motion prompts -> 🎞 Make clips.

ON KAGGLE / COLAB (FREE GPU, NO GPU AT HOME)
1. Open kaggle_colab.ipynb on kaggle.com (Create -> New notebook -> File -> Import notebook) or in Google Colab.
   Kaggle: Settings -> Accelerator -> GPU T4 x2, and Internet ON (phone verification needed once).
   Colab: Runtime -> Change runtime type -> T4 GPU.
2. Run the cells from top to bottom. The last cell prints a link (https://….trycloudflare.com) and a TOKEN.
3. Extension: 🎞 AI motion -> paste the link as Server and the token as Token -> 🔌 Test -> make clips.
4. Keep the notebook tab open while the clips are made. Free sessions stop after some hours / when idle.

SPEED (rough)
- LTX on a T4: a 5 s clip takes about 4-8 minutes. On an RTX 4090 about 1 minute.
- Wan on a 4090: a 5 s clip takes about 8-15 minutes.
- Lip-sync adds about 1-3 minutes per clip.
So a 20-scene story is a few hours on a free T4: start it, and come back later. Finished clips are saved in the
project; making the video again does not make them again.

LIMITS
- AI video can change details (a face, hands, text on signs) during the clip. Use clear pictures with one main action.
- Lip-sync needs a visible, front-facing face; flat comic faces are often not found — then the clip is used without it.
- Model licences: Wan 2.1 and LatentSync are Apache-2.0. LTX-Video has its own licence — check it before monetising.
