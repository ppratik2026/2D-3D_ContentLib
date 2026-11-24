# 🧸 Cartoon 2D add-on for the "Video Generation" extension (v4.17)

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
| `v4.17-cartoon2d.patch` | The small changes to `video.js` (4 guarded lines) and `sidepanel.html` |

## Install (into your own extension folder)

1. Copy `cartoon2d.js` and `cartoon2d_hd.js` into `flow-bulk-generator-v3-news/`.
2. Apply the patch from the folder that contains `flow-bulk-generator-v3-news`:
   `patch -p1 -d flow-bulk-generator-v3-news < v4.17-cartoon2d.patch`
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
