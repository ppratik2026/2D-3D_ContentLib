# Auto Video Studio

A Windows desktop app. Pick a **category**, **length** and **style**; Gemini writes the story, characters and Hindi/Hinglish dialogue; the app makes the voices, music, sound effects and subtitles, renders the 3D animation and saves a finished MP4. Videos go into a **queue** and are made one after another, so a PC can work through 5–10 videos (for example overnight).

Everything except the Gemini story step runs offline on the PC, without a graphics card.

## For the team (Windows)

1. Download **AutoVideoStudio-Setup.exe** (GitHub → Actions → "Build Windows installer" → artifact), or the portable ZIP. With the ZIP: unzip it anywhere and run `Auto Video Studio.exe`; it puts a shortcut on the Desktop.
2. On first start the app downloads the 3D models, Piper and three Hindi voices (~300 MB, once).
3. **Settings** → paste your own Gemini key (free: https://aistudio.google.com/apikey) → **Test**. The key is stored encrypted on that PC only.
4. **Naya Video** → category, idea (one per line for several videos), minutes, style, look, subtitles → **Daalo aur shuru karo**.
5. **Queue** shows progress, time left and the finish time. **Library** plays the finished videos.

Files: `Documents\AutoVideo\Videos\<date>_<category>_<title>\` → `final.mp4`, `subtitles.srt`, `story.json`, `timeline.json`.

## Screens

| Screen | What it does |
|---|---|
| Naya Video | Category, idea, minutes, number of videos, style (toon / anime / realistic), look (film, old film, noir, dreamy, horror, vivid), subtitles (classic, YouTube, karaoke, cinematic, Hinglish+English, Hindi). Shows the time estimate for this PC. |
| Queue | Videos made one after another: progress, time left, finish time, start/pause, cancel, retry, reorder. Survives a restart. |
| Library | All finished videos: play, open folder, delete. |
| Characters | Built-in characters plus your own `.vrm` / `.glb` / `.gltf` / `.fbx` (drag and drop). 3D preview with a walk test, lip-sync check, and tags (gender, age, role) that Gemini uses to cast the story. |
| Settings | Gemini key and model, renderer (Chrome + WebCodecs + ffmpeg, or Remotion), data folder. |

## Renderers

- **Chrome + WebCodecs + ffmpeg** (default, free). Three.js draws each frame. Canvas 2D adds the look, subtitles and title cards. WebCodecs encodes H.264 directly (no screenshots), and ffmpeg adds the AAC audio. Measured on a 4-core CPU without a GPU: **0.15 s per frame** (a 68-second video in 5 min 22 s).
- **Remotion**: same video through Remotion. About 2× slower here. A Remotion company licence is required for teams of more than 3 people (https://remotion.dev/license).

The app learns the real speed of each PC after its first video and uses it for the estimates.

## Custom characters

Any humanoid rig works: Mixamo, VRoid/VRM, MakeHuman, Unreal-style (`pelvis`, `thigh_l`, …) or Blender-style (`Arm.L`). The app finds the bones, turns A-pose into T-pose, fixes the facing and the height, and retargets walk/idle/run. Lip-sync uses VRM expressions, blendshapes (`mouthOpen`, `jawOpen`, `viseme_aa`, …) or a jaw bone. Game rigs whose feet are not attached to the legs (IK rigs) are refused with a clear message.

Free sources:
- **VRoid Studio**: make your own Indian characters and export `.vrm`.
- **MakeHuman**: CC0 output.
- **Mixamo**: download with your own Adobe login.
- **Quaternius** / **Kenney**: CC0.

## Developers

```bash
npm install
```

```bash
npm run setup
```

```bash
npm start
```

- `npm start` runs the desktop app in dev mode (data in this folder).
- `npm run demo-test` renders the built-in demo story headless.
- `npm run dist:win` builds the Windows installer (on Windows, or in CI); `node scripts/build-win.mjs --dir` builds an unpacked folder.

Layout:
- `app/`: Electron main, UI, Chrome renderer.
- `remotion/engine/`: Three.js sets, characters and director.
- `pipeline/`: Gemini story, Piper TTS, timeline, audio mix, Remotion render, character library, first-run setup.

## Licences to know

- Piper: MIT. Hindi voices: each voice has its own licence.
- three.js / three-vrm: MIT.
- VRoid sample avatars: VRoid licence.
- Mixamo-derived sample models: free to use, not for resale as assets.
- ffmpeg-static: GPL build of ffmpeg, used as a separate program.
- Remotion: see above.
