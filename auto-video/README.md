# Auto Video Studio (Three.js + Remotion)

Pick a **category** (romance, comedy, crime, horror, kids, …), a **length**, a **style**. Gemini writes the story, characters and Hindi/Hinglish dialogue. The tool then makes the voices, music, sound effects and subtitles, renders the 3D animation and gives you a finished MP4.

Everything is free and runs on the CPU. No graphics card is needed. Only the story step uses the internet (Gemini).

| Step | Tool (free) |
|---|---|
| Story, characters, scene-by-scene dialogue | Gemini API (your key, free tier) |
| Hindi voices (3 voices: Pratham, Rohan, Priyamvada) | Piper TTS, offline |
| Lip-sync | Loudness of each voice line, per video frame |
| Music (one mood per category), ambience, footsteps, doors | Generated in code, no samples |
| 3D sets (café, home, office, police station, classroom, street, park, forest, alley) | Three.js, built in code |
| Characters: anime/toon (VRoid VRM) or realistic (Ready Player Me / Mixamo) | Three.js + three-vrm |
| Subtitles (classic, YouTube bold, karaoke, cinematic, Hinglish+English, Hindi) and looks (film, old film, noir, dreamy, horror, vivid) | Remotion |
| Final MP4 + `.srt` | Remotion |

## Install (once)

1. Install **Node.js 20 or newer** from https://nodejs.org
2. Open a terminal in this folder (`auto-video`) and run:

```bash
npm install
```

```bash
npm run setup
```

   `setup` downloads the 3D models (~80 MB), the Piper program (~25 MB) and three Hindi voices (~190 MB).

3. Get a free Gemini key at https://aistudio.google.com/apikey. Open the `.env` file and paste it:

```
GEMINI_API_KEY=your-key-here
```

   `.env` stays on your PC and is never uploaded (`.gitignore` excludes it).

## Make a video

```bash
npm start
```

Open http://localhost:3000. Choose the category, idea (optional), minutes, style, look and subtitles. The page shows the **estimated time** before you start. Press **Video banao**. The finished file is in `output/<job>/final.mp4`, next to `subtitles.srt`, `story.json` and `timeline.json`.

Command line instead of the web page:

```bash
npm run make -- --category crime --minutes 3 --style toon --look auto --subs karaoke --idea "Gaon me chori"
```

To test the setup without a Gemini key, run the built-in demo story:

```bash
npm run make -- --demo --style toon
```

## Speed

| Style | Measured: 4-core CPU, no GPU (software WebGL) | 10-min video, CPU only |
|---|---|---|
| Toon 3D | 0.40 s per frame (about 12× the video length) | about 2 hours |
| Realistic 3D | 0.53 s per frame (about 16×) | about 2 h 40 min |
| Anime 3D (outlines) | 0.60 s per frame (about 18×) | about 3 hours |

These numbers are for pure CPU rendering. On a normal PC the built-in graphics (Intel/AMD/Apple) draws WebGL many times faster; the tool uses it by default (`REMOTION_GL=angle`). After your first video, the page shows the real speed of your PC: every render saves it in `bench.json`.

Settings in `.env`:
- `REMOTION_GL=angle` uses your built-in graphics. This is the default on Windows and Mac.
- `REMOTION_GL=swiftshader` is pure CPU.
- `CONCURRENCY=2` renders that many frames in parallel.

## Notes / limits

- The characters are free sample models (VRoid samples, Ready Player Me, Mixamo Michelle). The tool changes their clothes and hair colours from the story, but it cannot make new faces. To get new characters, export them from VRoid Studio (free) as `.vrm`, put them in `public/assets`, and add the file names in `remotion/engine/actors.js` → `POOL`.
- Lip-sync uses mouth shapes on the VRM characters and the realistic male. The realistic female (Michelle) has no face shapes.
- Mac: the 2023 Piper build may not start on some Macs. In that case run `pip install piper-tts` and set `PIPER_BIN` (see `pipeline/tts.mjs`).
- Remotion is free for individuals and companies with up to 3 people. See https://remotion.dev/license.
