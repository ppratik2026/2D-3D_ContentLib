# 2D-3D ContentLib: free cartoon video maker

Write a story in a JSON file and get a **2D** or **3D** cartoon video with background music.
It is free and open-source. It runs on a normal computer (CPU) or on a free Colab/Kaggle GPU.

| | 2D | 3D |
|---|---|---|
| Engine | Python + Pillow + FFmpeg | Blender (EEVEE, toon shading + outlines) |
| Needs GPU? | No | No, but a GPU is ~10x faster |
| Speed (4-core CPU, 720p) | ~1.5x real time: 1 hour video ≈ 40 min | ~1.5 s per frame: 1 min video ≈ 35 min |
| 1 hour video | Easy on CPU | Use free Colab/Kaggle GPU, or render in parts |

Sample output: [`examples/demo_2d.mp4`](examples/demo_2d.mp4) and [`examples/demo_3d.mp4`](examples/demo_3d.mp4), both made from [`stories/demo.json`](stories/demo.json).

## Quick start (Linux / Mac / Windows WSL)

```bash
pip install -r requirements.txt        # numpy, pillow
sudo apt install ffmpeg blender        # Blender only needed for 3D
```

```bash
python -m toonlib.render2d stories/demo.json -o out/demo_2d.mp4
```

```bash
python -m toonlib.render3d stories/demo.json -o out/demo_3d.mp4
```

Useful flags:

- `--frame 5.5 -o still.png` renders one image at 5.5 s. Use it to check a scene before rendering the full video.
- `--quality fast` (2D) draws without anti-aliasing and is about 3x faster.
- `--preview` (3D) renders at half resolution with fewer samples.
- `--no-music` turns the music off. Or set `"music": "path/to/song.mp3"` in the story.
- `--workers N` sets how many parallel processes to use.

Headless 3D needs EGL. On Ubuntu: `sudo apt install libegl1 libegl-mesa0 libgl1-mesa-dri`.

## Free GPU (Colab / Kaggle)

Open [`notebooks/free_gpu_colab.ipynb`](notebooks/free_gpu_colab.ipynb) in Google Colab
(File → Upload notebook) or Kaggle. Turn on the T4 GPU and run every cell. It installs Blender 4.0.2
and renders both videos. For long renders, cell 6 saves the output to Google Drive.

Free tier limits: Colab sessions stop after a few hours. Kaggle gives about 30 GPU hours per week,
and one session can run up to 12 hours. To render a 1-hour 3D video, split the story into several
story files (for example 10 minutes each), render one per session, and join them with ffmpeg:

```bash
printf "file 'part1.mp4'\nfile 'part2.mp4'\n" > list.txt && ffmpeg -f concat -safe 0 -i list.txt -c copy full.mp4
```

## Writing a story

```json
{
  "title": "Chotu aur Pinky",
  "fps": 24,
  "resolution": [1280, 720],
  "music": "auto",
  "characters": {
    "chotu": {"shirt": "#ff7043", "skin": "#ffd2a6", "hair": "#3b2414", "pants": "#3949ab", "height": 1.0}
  },
  "scenes": [
    {"type": "title", "duration": 2.5, "text": "Chotu aur Pinky", "subtitle": "Ek chhoti si kahani"},
    {
      "duration": 6, "background": "park", "caption": "Optional bottom caption",
      "cast": {"chotu": {"at": [-80, 610]}},
      "actions": [
        {"char": "chotu", "type": "move", "to": [500, 610], "start": 0, "end": 3},
        {"char": "chotu", "type": "say", "text": "Namaste!", "start": 3, "end": 5}
      ]
    }
  ]
}
```

**Stage coordinates:** `x` runs from 0 to 1280 (left to right). `y` is where the feet are, from about 520 (far)
to 700 (near). Start a character outside the frame (`x < 0` or `x > 1280`) to make them walk in.

**Backgrounds:** `park`, `sunset`, `night`, `beach`, `room`, `space`. Each one has a 2D and a 3D version.

**Actions** (`start` and `end` are in seconds from the start of the scene):

| type | extra fields | what it does |
|---|---|---|
| `move` | `to`, optional `from`, `style`: `walk` / `run` / `slide` | walks to a point (the legs animate) |
| `say` | `text` | speech bubble + talking mouth |
| `wave` | | waves a hand |
| `jump` | `height`, `count` | jumps |
| `dance` | `tempo` (beats/s) | dances |
| `look` | `dir` (-1 to 1) | looks left or right |
| `face` | `dir` (1 or -1) | turns to face right or left |
| `emotion` | `value`: `happy` / `sad` / `angry` / `surprised` | changes the face |
| `hide` | | removes the character from the scene |

**Per-scene options:** `fade` (seconds), `caption`, `repeat` (play the scene N times, handy for long
loops). For 3D only: `"camera": "orbit"` or `"camera": {"follow": "chotu"}`.

**Making long videos:** a 1-hour video is just a story with many scenes (roughly 300-600 short scenes).
The renderers work in chunks, so memory use stays the same whatever the length. Describe your story
in plain words to Claude and ask it to write the JSON for you.

## Layout

```
toonlib/story.py         timeline: story JSON -> character pose at any time (shared by 2D and 3D)
toonlib/render2d.py      2D renderer (Pillow), parallel chunks -> ffmpeg
toonlib/render3d.py      3D driver: runs Blender per chunk, fades, joins, adds music
toonlib/blender_scene.py runs inside Blender: builds the set, characters and toon materials
toonlib/music.py         generated royalty-free chiptune background music
stories/                 example stories
notebooks/               Colab / Kaggle free-GPU notebook
```
