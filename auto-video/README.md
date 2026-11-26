# Auto Video Studio

A Windows desktop app. Pick a **category**, **length** and **style**; Gemini writes the story, characters and Hindi/Hinglish dialogue; the app makes the voices, music, sound effects and subtitles, renders the animation (2D Cartoon Stage on painted backgrounds, or 3D toon / anime / realistic) and saves a finished MP4. Stories can be 0.5–20 minutes with up to 12 characters, each with their own voice. Videos go into a **queue** and are made one after another, so a PC can work through 5–10 videos (for example overnight).

Everything except the story step (Gemini, Groq, OpenRouter, Mistral, Cerebras, a local server, or paste from the Gemini app) runs offline on the PC, without a graphics card.

## For the team (Windows)

1. Download **AutoVideoStudio-Setup.exe** (GitHub → Actions → "Build Windows installer" → artifact), or the portable ZIP. With the ZIP: unzip it anywhere and run `Auto Video Studio.exe`; it puts a shortcut on the Desktop.
2. On first start the app downloads the 3D models, the Piper + Kokoro voice engines and the Hindi voices (~400 MB, once).
3. **Settings → Story AI** → pick a provider, paste your own key → **Test**. Keys are stored encrypted on that PC only. No key? Use **Story source → Paste from Gemini app**.
4. **Backgrounds** → import empty painted scenes for the 2D Cartoon Stage (prompts: [docs/BACKGROUND_PROMPTS.md](docs/BACKGROUND_PROMPTS.md)).
5. **Characters** → import your VRoid characters ([docs/VROID_GUIDE.md](docs/VROID_GUIDE.md)) and give each one a fixed voice.
6. **New Video** → category, then either an idea (one per line for several videos) or **your own full story** ([docs/MY_STORY_GUIDE.md](docs/MY_STORY_GUIDE.md)), minutes, characters, style, look, subtitles → **Add & start**.
7. **Queue** shows progress, time left and the finish time. **Library** plays the finished videos.

Files: `Documents\AutoVideo\Videos\<date>_<category>_<title>\` → `final.mp4`, `subtitles.srt`, `story.json`, `timeline.json`.

## Screens

| Screen | What it does |
|---|---|
| New Video | Category, idea, minutes (up to 20), number of videos, number of characters (up to 12), style (2D Cartoon Stage, toon, anime, realistic), look, subtitles, story source. Shows the time estimate for this PC. |
| Queue | Videos made one after another with step-by-step progress (story → voices → sound → render → save), time left, finish time, start/pause, cancel, retry, reorder. Survives a restart. |
| Library | All finished videos: play, open folder, delete. |
| Characters | Built-in characters plus your own `.vrm` / `.glb` / `.gltf` / `.fbx` (drag and drop). 3D preview with a walk test, lip-sync check, tags (gender, age, role) that the AI uses to cast the story, and a fixed voice with ▶ Play. |
| Backgrounds | Painted backgrounds for the 2D Cartoon Stage. Set place / time / tags, drag the ground lines (front and back row), character height and seats. The AI picks a background for every scene. |
| Settings | Story AI provider / key / model with fallback order, renderer (Chrome + WebCodecs + ffmpeg, or Remotion), updates, data folder. |

## 2D Cartoon Stage, voices and effects

- **Stage:** each scene uses a background from the library. Characters (toon-shaded 3D, so they walk, sit and lip-sync) stand on the ground lines, enter and exit from the sides, and the camera cuts between wide, two-shot and speaker close-ups.
- **Voices:** 20 Hindi voices (Piper + Kokoro-82M, with pitch/speed variants): men, women, old people, kids, a deep inspector voice and a heavy villain voice. Each character keeps one voice for the whole video; characters with a fixed voice in the Characters tab always use it.
- **Action scenes (v0.7):** cartoon vehicles drawn by the app (car, taxi, police jeep with flashing lights, ambulance, auto rickshaw, van): drive in, get out, get in, drive away, car chase with a scrolling road and speed lines, foot chase, catch, handcuffs with a close-up, faint / lie down, people lying in a hospital bed. Gestures with props: magnifying glass, torch, test tube, file, notepad, judge's gavel, salute, namaste, hands up, crying.
- **Places:** mark a desk, judge bench, witness box, counter, bed, jail cell or blackboard on a background. People go there by their role (judge, inspector, patient, prisoner, teacher…) and are hidden behind the desk or box, or behind jail bars.
- **Your own story:** paste a story of any length. The AI keeps your events and dialogue, adds a narrator and "Agle din…" cards where needed, and writes `TO-DO.txt` next to the video with actions and backgrounds the app does not have yet.
- **Daily life (v0.9):** cook, chop, eat, serve tea, sweep, aarti, pray, dance, knock, type on a laptop, sleep; with another person: hug, fight, push, slap, give a gift / money. Full list: [docs/WHAT_IT_CAN_DO.md](docs/WHAT_IT_CAN_DO.md).
- **Editable subtitles (v0.9):** the video is rendered clean and the subtitles are burned on top with the bundled Hindi + English fonts (Poppins, Mukta, Hind, Kalam). Library → **Subtitles** edits text, timing, size, colours, box, position, language and karaoke with a live preview, then re-burns in a few minutes. Save a style as your default for new videos.
- **Effects:** the story AI chooses weather per scene: rain, storm (lightning flashes + thunder), fog or wind, plus camera shake on shocks. Sound: siren, engine, brakes and tyre screech, car doors, handcuff click, gavel, jail door; music by mood, ambience by place (village birds, city traffic, night crickets, jungle), rain/wind loops, thunder, heartbeat in horror/crime scenes, dog barks and owls at night.

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
