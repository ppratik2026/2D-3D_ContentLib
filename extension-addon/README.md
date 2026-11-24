# Add-ons for the "Video Generation" extension (v4.3)

Two add-ons, each in its own box in the Video tab:

- **🎞 AI motion** (`aimotion.js` + the `local-motion-server/` folder): every scene picture becomes a **real moving clip**
  (image-to-video): people walk, turn, gesture, vehicles drive, rain falls. With lip-sync on, the speaker's lips follow
  the voice. Free: it runs on your own NVIDIA GPU or on the free GPU of Kaggle / Colab.
- **🧸 Cartoon 2D** (`cartoon2d.js`, `cartoon2d_hd.js`): replaces the pictures with code-drawn cartoon characters (see below).

(The earlier "🪄 Living pictures" add-on, which bent the still picture in code, was removed: it could not give real motion.)

Install: copy `aimotion.js`, `cartoon2d.js` and `cartoon2d_hd.js` into `flow-bulk-generator-v3-news/`, then
`patch -p1 -d flow-bulk-generator-v3-news < v4.3-addons.patch`, and Reload the extension. Put `local-motion-server/`
next to `local-voice-server/`.

## 🎞 AI motion

How it works:
1. Make the story, Flow pictures and voice as always.
2. Start the AI motion server:
   - **On a PC with an NVIDIA GPU**: `local-motion-server/install.bat` once, then `start_ltx.bat` (12-16 GB GPU)
     or `start_wan.bat` (24 GB GPU). Optional lip-sync: `install_lipsync.bat` once.
   - **Free, without a GPU**: open `local-motion-server/kaggle_colab.ipynb` on Kaggle (GPU T4 ×2, Internet on) or Colab
     (T4 GPU) and run all cells. The last cell prints a link and a token.
3. Video tab → **🎞 AI motion**: paste the server link (and the token for Kaggle / Colab), press **🔌 Test**,
   then **🎞 Make clips**. Gemini writes one motion prompt per scene (1 request for 40 scenes). You can edit every prompt.
4. Each picture goes to the server with its motion prompt (and the voice when the line has a speaker and lip-sync is on).
   The clip comes back and is saved as that scene's key-shot clip. **🎬 Make video** then plays the clip in place of the
   picture (24 fps; a long line is several clips, each continuing from the last frame of the one before).
   Subtitles, music, transitions and upload stay the same.

Per scene you can ▶ play the clip, 🔄 make it again, or ✕ go back to the picture. Clips are saved in the project, so
making the video again does not make them again. If the panel is closed while the server is still working, the next
**Make clips** picks up the same job.

Server API (`local-motion-server/server.py`, standard library only): `GET /health`, `POST /animate`, `GET /job?id=`,
`GET /result?id=`, optional `x-token` header. Backends: `ltx` (LTX-Video via diffusers), `wan` (Wan 2.1 I2V 480p via
diffusers) and `mock` (no GPU; a zoom clip with ffmpeg, only for testing the connection). Lip-sync: LatentSync 1.5.

Tested here: the server API, clip joining and trimming, token check, and the whole extension path (prompts → server →
clip saved → video uses it) with the `mock` backend. The real models need a GPU and could not run here. The diffusers
classes and call parameters used were checked against diffusers 0.43.

Limits: AI video can change small details (faces, hands, signs) during a clip. Lip-sync needs a visible, front-facing face;
flat comic faces are often not found, and then the clip is used without lip-sync. On a free T4 a 5 s LTX clip takes
roughly 4-8 minutes, so a long story takes hours: start it and come back later. Check each model's licence
(Wan 2.1 and LatentSync: Apache-2.0; LTX-Video: its own licence) before monetising.

---

# 🧸 Cartoon 2D add-on

This add-on turns each scene into a **moving 2D cartoon**. The characters walk, run, wave, jump, dance,
sit, think, cry and laugh, and the speaker's mouth moves with their voice (lip-sync).
Everything else stays the same: story (Gemini), voice and character voices, subtitles, music,
transitions and the YouTube upload. It runs on the Canvas, with no GPU and no Flow credits for the characters.

Samples made by the real extension: [`../examples/demo_extension_village_hd.mp4`](../examples/demo_extension_village_hd.mp4) (🏡 HD village look)
and [`../examples/demo_extension_cartoon2d.mp4`](../examples/demo_extension_cartoon2d.mp4) (simple look).

## 🏡 HD village look (Look → HD village, the default)

- **Characters** have real proportions and shading, eyes with eyelids, eyebrows, nose and moustache,
  bangles and a bindi for women, and chappals. Clothes are drawn from the visual bible words:
  kurta + lungi (checked), vest + lungi + gamchha, kurta / shirt + dhoti, saree (with border, pleats and pallu),
  lehenga / ghagra choli, salwar with dupatta, frock, shirt + pant, and suit. Pagdi, headband, glasses
  and a lathi or glass in the hand are also drawn.
- **Poses**: walk, run, namaste, wave, talk with hand moves, point, think, laugh, cry, scared, jump, dance,
  sitting on a **charpai** (`sit`) and sitting cross-legged on the floor (`sit_floor`).
- **Animals**: buffalo, cow, bull / ox, goat and dog are detailed. Others use the simple drawing.
- **Built-in backgrounds** are built in layers: sky → far trees / palms → middle (fields with furrows and
  grass strips, a blue house with a clay-tile roof and open door, a thatched hut, big leafy trees, or a
  mud-house wall with a thatched roof, beams, barred windows and a door) → foreground grass.
  The camera pans slowly with parallax, the clouds drift and birds fly.
  Field / farm / khet → field. Home / inside → mud house. Anything else outdoors → village courtyard.
- With **Flow background** the prompt asks Flow for the same rich, detailed village-cartoon background.

## Files

| File | What it is |
|---|---|
| `cartoon2d.js` | The add-on: cast, actions, lip-sync, simple look, settings box |
| `cartoon2d_hd.js` | 🏡 HD village look: shaded characters in village clothes, charpai, buffalo / cow / goat, layered village backgrounds, camera pan |
| `sidepanel-box.html` | The "🧸 Cartoon 2D" settings box (goes into the Video tab) |
| `v4.3-addons.patch` | The small changes to `video.js`, `look.js` and `sidepanel.html` for both add-ons |
| `aimotion.js`, `sidepanel-box-aimotion.html` | 🎞 AI motion (plus `../local-motion-server/`) |

## Install (into your own extension folder)

1. Copy `cartoon2d.js` and `cartoon2d_hd.js` into `flow-bulk-generator-v3-news/`.
2. Apply the patch from the folder that contains `flow-bulk-generator-v3-news`:
   `patch -p1 -d flow-bulk-generator-v3-news < v4.3-addons.patch`
   (or make the same 4 edits in `video.js` by hand and paste `sidepanel-box.html` above the 🎨 Motion pack box,
   then add `<script src="cartoon2d.js"></script>` and `<script src="cartoon2d_hd.js"></script>` after `kidvoice.js`).
3. Open `chrome://extensions` and click Reload on Video Generation.

Every change in `video.js` uses the same `typeof … === 'function'` guard as the other packs.
If `cartoon2d.js` is missing, or the mode is Off, the video is made exactly as before.

## How to use

Video tab → **🧸 Cartoon 2D**:

1. **Mode** → `🧸 2D cartoon animation`.
2. **Background**:
   - `🖼 Flow picture`: press **"Picture prompts → empty cartoon backgrounds"** and make the pictures again.
     Flow then draws only the place (no people) in 2D cartoon style, and the characters walk on top of it.
     Turn off *Flow reference* (character sheets) for these pictures.
     If a scene has no picture, a built-in drawing is used, so the video never stops.
   - `✏ Built-in drawing`: no Flow at all. The tool draws a park, home, classroom, village, market, forest,
     beach or city from the scene's place, with a night version.
3. **Characters from**: the default country for the cast (Indian, Korean, Japanese, Chinese, South-East Asian,
   Russian, European, American, African, Middle Eastern, Latin American, Mixed). A word in the visual bible
   ("8-year-old Korean girl", "Russian man") overrides it for that character.
4. **🎭 Cast**: change anyone's country, male/female, age (toddler → old), skin, hair style and colour,
   clothes (kurta, saree, salwar, lehenga, sherwani, dhoti, hanbok, kimono, school uniform, suit, coat,
   hoodie, frock, robe …), colours and extras (glasses, beard, moustache, bindi, earrings, scarf,
   walking stick, school bag). Animals also work (dog, cat, rabbit, lion, bear, monkey, crow, parrot …).
   Changes are saved in the project, and in a series they are locked for every episode.
   **↺ Auto** goes back to the look read from the visual bible.
5. **Actions**: by default they come from the words of each line (namaste → wave, daud → run, naach → dance,
   ro → cry, has → laugh, soch → think, baith → sit, dar → scared …), with no Gemini request.
   **✨ Plan actions with Gemini** uses 1 request per script, is saved in the project, and decides
   who enters, exits and does what.
6. **▶ Test this scene** plays a scene in the box before you make the whole video.

Who is in a scene comes from the script's `chars` (visual bible). Who talks comes from `speaker`.
Characters who were not in the previous scene walk in. The speaker faces the listener and moves their hand
while talking, and the listeners look at the speaker.

While Cartoon 2D is on, 💬 Comic mode bubbles are skipped, because they are placed on faces in Flow pictures.
Subtitles stay.

## Limits

- The characters are simple, flat cartoon drawings. They are always the same, but less detailed than a Flow picture.
- In Flow-background mode the place picture is still a new Flow picture each time, so its look can change a little.
  If the feet do not land on the ground, change **Feet at**.
- Built-in mode has no Flow picture, so the thumbnail and other picture-based extras (carousel,
  "best picture") have nothing to work with. Use Flow-background mode for those.
- Only these actions exist for now: walk, run, wave, jump, dance, sit (on a stool), think, point, cry, laugh, sleep, scared.
