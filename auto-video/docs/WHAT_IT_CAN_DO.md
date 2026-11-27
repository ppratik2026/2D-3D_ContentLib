# What Auto Video Studio can animate (v1.6)

The story AI uses these automatically. You can also write them yourself in a pasted story.

## People

| Group | Actions |
|---|---|
| Move | enter, exit, run_exit, walk_to (a person), go_to (a place in the background), sit, stand |
| Feelings / gestures | wave, nod, laugh, point, think, shock, angry, cry, clap, look_around, hands_up, shiver, namaste, salute |
| Home & kitchen | cook (pan), chop (knife), eat (plate), serve (tray with tea), sweep (broom), aarti (thali + temple bell), pray, drink (cup), phone, type (laptop), sleep (lies down, eyes closed, snoring), dance (with dhol beat), knock (door) |
| Police / court / lab | examine (magnifying glass), torch (flashlight), read / file, write (notepad), test_tube, gavel (judge) |
| With another person | hug, fight (punches + hits), push, slap, give (gift or money), catch, handcuff |
| Falling | faint (falls down / a body lying), lie (lies down), stand (gets up) |

## Vehicles

Car (any colour), taxi, police jeep (flashing lights + siren), ambulance (siren), auto rickshaw, van, **bike, scooter, cycle** (rider + pillion, pedalling, bell / engine sounds), a **riding horse**, a **boat** (rowing) and a **passenger train** (arrives at the platform, people get in / out at the doors and sit at the windows, horn + chugging).

- drive_in, get_out, get_in, drive_away
- car_chase: scrolling road, speed lines and dialogue during the chase
- foot_chase

## Animals, crowd and baraat (v1.1)

| What | Actions |
|---|---|
| Dog | enter, exit, run, bark, sit, follow a person |
| Cow | enter, exit, graze, moo, follow |
| Horse | enter, exit, run, neigh, follow (and riding, see Vehicles) |
| Crowd in the background (up to 14 people) | dance, cheer, clap, watch, walk |
| Baraat | the groom rides a decorated mare with a safa; relatives dance in front; the crowd dances behind; confetti falls; dhol + shehnai + cheering |

## Fire, rain, games, water, climbing (v1.2)

| What | How it looks |
|---|---|
| fire / fire_out | flames, smoke and a warm glow with crackling; keeps burning until fire_out |
| explosion | flash, fireball, smoke ring, flying debris, camera shake, boom; people nearby get a shock; a fire keeps burning after |
| umbrella | a person holds an umbrella (use it with "weather": "rain" / "storm") |
| game: cricket | bowler runs up and bowls, the ball bounces, the batsman hits it into the sky, fielders clap; bat-hit sound |
| game: ball | two kids throw and catch a ball |
| game: skip | skipping rope, friends clap |
| game: kite | kite in the sky with its string, friends point |
| game: tag | pakdam-pakdai, kids run around laughing |
| swim | swimming strokes in water, the body half under water, splashes |
| climb / climb_down | up a ladder, or up to the tree / wall / roof top you mark as a "Climb to" place |
| More animals | goat (bleat), cat (meow), elephant (trunk, trumpet), birds (a flock flies across the sky with chirping) |

## Festivals, sports, sky, more animals (v1.3)

| What | How it looks |
|---|---|
| holi | coloured powder clouds around everybody, people slowly get coloured, dhol + cheering; gestures gulal (throws colour) and pichkari (water gun with a coloured stream) |
| diwali | a row of diyas along the front, blinking string lights, fireworks bursting in the sky with whistles and pops; gestures diya (holds a lamp) and sparkler (phuljhadi) |
| cracker | anaar (golden fountain with hiss) or bomb (flash and bang) on the ground |
| birthday | cake with candles in front of the birthday person, balloons, confetti, the birthday song, everyone claps, candles are blown out |
| game: football | passing with kicks, the ball rolls, goal post with net |
| game: kabaddi | raider crosses the middle line with arms out, defenders try to catch |
| fly_by | an aeroplane or helicopter flies across the sky (jet / rotor sound) |
| helicopter | lands (drive_in), people get in / out, takes off (drive_away); rotor spins in flight |
| Monkey / tiger | monkey jumps and chatters; tiger (stripes) roars and runs |
| Snow | weather "snow" — snowfall with wind |

## Old FBX characters (v1.9.1)

3D loader reads FBX 7 and newer. Old FBX files (FBX 6.x, the error "FBX version not supported, FileVersion: 6100") are converted to GLB automatically when you import them; for one imported earlier, open it in the Characters tab and click **Convert to the new format**. The free FBX2glTF converter (~4 MB) downloads the first time.

## Timeline editor (v1.12)

With *Open the timeline editor before rendering* (New Video, on by default) the job stops after the voices: Queue → **Ready to edit → Open editor**. (2D stage styles: Flat 2D, Bean Night, 2D Cartoon Stage.)
- **Preview:** the real video picture, live. Play / pause, ±2 s, scrub, *Play this scene*, *Play line*, *Play it* (a walk). Untick *Wide view* to see the real camera angles while playing.
- **Tracks:** Scenes, Camera, Dialogue, Walks — click a block to edit it; the red line is the playhead.
- **Scene panel** (the scene at the playhead): change the background, zoom / move it (left-right, up-down); for every person: place (auto / standing / any seat, bed, desk… of the background), facing left / right, hidden, height and width. **Drag people** in the preview (Wide view) to where they stand when the scene starts. **Add walk ➜** then click in the preview: that person walks there from the playhead time (edit the start, length, run, or delete it later); several people can each have their walks.
- **Camera:** click a camera block → angle (wide, two-shot, speaker, over the shoulder, close-up, reaction close-up…), on whom and the listener → *Use this angle*, or *Change only from the playhead*. Your changes show in purple; *Remove my change* goes back.
- **Dialogue:** click a line → edit Hinglish / Hindi / English text and emotion → *Save text & make new voices* (timing is rebuilt); mute a line or change its volume.
- **Sound:** voices, music and effects levels (0 = mute), music style, or your own music file (mp3 / wav, loops) → *Update sound*.
- **Render video ▶** makes the final MP4 with all changes (subtitles can still be edited later in the Library).

## Plan board, your own genres, character height, subtitle drag (v1.11)

- **Plan board:** with *Show me the plan before the video is made* (New Video, on by default) the job stops after the script, in the Queue as **Waiting for you → Review plan**. The window lists every character (main ⭐, name, role, *played by* a saved character = its look and voice, height slider, scenes and lines), every scene with its background picture (pick any library background or *Paint a new one*), and every prop, vehicle and animal (swap e.g. car → bike, coffee → laddu, cup → phone). Renaming a character changes the name in the dialogue too (Roman text). **Make the video ▶** continues with voices and render.
- **Your own genres:** ＋ Add genre (e.g. Korean Drama, Turkish Drama): name, what kind of stories, music mood. They work like the built-in genres (story AI, topics, series); × deletes one.
- **Character height:** Characters tab → 3D characters → *Height in videos*; saved story characters → *Height*; and per video in the Plan board.
- **Subtitles:** in the subtitle editor drag the subtitle up / down on the video; colours, size, outline and box as before.

## New Video: single video or series, topics, language, backgrounds, characters (v1.9)

- **Format:** *Single video* or *Series (episodes)*. A series is saved in `Documents\AutoVideo\series\<name>\` with every episode's story, its characters (names, looks, voices) and the backgrounds it used. Pick the series again and press *Add* to make the next episode: the AI gets the story so far and the last episode's ending, keeps every character the same, and new characters are added to the series. "Episodes to make now" queues several episodes one after another.
- **Which AI is used:** the story AI chosen in Settings (or in Story source) is used first for stories, topics and backgrounds. With Groq chosen: real topics come from Google News headlines that Groq turns into topics, and new backgrounds are painted by the free painter (Pollinations FLUX, no key); Gemini picture models and Google Search are used only when Gemini is the chosen story AI.
- **Find topics:** Story → *Find topics*. *Real recent stories* = Gemini searches Google for 15–20 recent real incidents of the genre (India first, with place, date and source); the story keeps the facts and changes private people's names. *AI creates new ideas* = 15–20 invented ideas. Click one topic (series) or several (one video each).
- **Language:** Hindi (Devanagari on screen), Hinglish (Roman on screen) or English (English voices, English dialogue, bubbles, notes, cards and subtitles). English voices (2 Piper + 6 Kokoro, ~130 MB) download once with the first English video.
- **Backgrounds:** *Existing* = your library backgrounds of the chosen style (same theme), picked for the genre and each scene. *New* = Gemini paints a background for every place in the story in the same art theme, measures the floor line and seats itself, and saves it in the Backgrounds library (reused next time and in the series). Gemini picture models need billing turned on for the key in Google AI Studio; without it the closest existing background is used and the job log says so.
- **Characters:** every character of every video is saved (Characters tab → *Story characters*, with its colours and voice). In New Video → Characters, click saved characters to use them again with the same name, look and voice; the AI adds any others the story needs.
- **Main character and story cast:** pick the hero (a saved character, or let the AI create one for the genre), how many main characters (1–4) and how many characters in total (1–10 or a range). With *Show me the characters first* on, the AI first plans the story and its characters; a window lists them (name, role, gender/age, main tick, *played by* a saved character), you can rename, swap, remove or add people, and then the script is written with exactly those characters (so every line uses the right names). New characters are saved to the library after the video.
- **Subtitles:** On / Off switch (plus the style). Bean Night always shows speech bubbles; burned subtitles only when switched On.

## Bean Night style (v1.8)

Pick **Style → Bean Night (dark doodle, bean characters)** for the dark "late-night doodle" look: head and body are one soft bean, thick round arms and legs, dot eyes, thick flat brows, tired eye-bags, beanies / caps / hair, and dark backgrounds with thin light lines and warm lamp glows.

- **Speech bubbles:** every line appears in a dark rounded bubble with white handwritten text above the speaker (long lines change bubble part by part). The narrator's lines show at the bottom. Subtitles are not burned on this style (the bubbles carry the words); `subtitles.srt` is still saved.
- **Inner voice:** a character whose role says *inner voice*, *shadow* or *anxiety* is a black figure in a pulsing red glow with red eyes; its lines are glowing red words.
- **Battery meter:** `{"type":"action","action":"battery","char":"arjun","value":12}` shows the energy above that person (0–15 red, 100 yellow, others white); the next battery beat animates from the old value to the new one.
- **Big words:** `{"type":"action","action":"big_text","text":"GO!"}` ("3:00 AM", "GO!", "LATE!") pop in the middle with a whoosh.
- **Worry attack:** `{"action":"thoughts","char":"arjun","items":["kal exam hai","kuch nahi padha"],"seconds":5}`: the room goes dark, red sticky notes pop around the person one by one, heartbeat sound.
- **Dream / imagination:** `{"action":"dream","char":"arjun","background":"stadium","with":["riya"],"seconds":6}`: thought dots rise from the head and a red-glowing cloud shows that place (tinted red) with the people as glowing silhouettes, with a soft hum.
- **Dog on a leash:** `{"type":"action","action":"animal","animal":"dog","act":"leash","target":"chhotu"}`: a flat doodle dog walks a little ahead of the owner, the owner's hand holds the red leash.
- **People walking behind:** crowd `"mood":"walk"` now walks both ways, people further back are dimmer. Crowd `"mood":"queue"` makes a line of people waiting at the cafe counter.
- **Phone at night:** gesture `scroll_phone` (both hands, head down, lit screen).
- **Sleep goes to the bed:** `sleep` walks to the bed in the background and lies down on it.
- 7 starter backgrounds: classroom, cafe (counter + table for two), corridor with lockers, night street with shops, bedroom, park at night, stadium.

### Cafe tables (all flat styles)

Two people at a cafe table sit facing each other with their cups standing on the table and hands resting next to them; a `sip` picks the cup up to the mouth and puts it back. The barista / waiter stands behind the counter. Works in Flat 2D Explainer (cafe inside) and Bean Night (cafe). On your own backgrounds, give a seat marker `tableY` (the table top line) and `"cup": true`.

## Flat 2D Explainer style (v1.6)

Pick **Style → Flat 2D Explainer** for YouTube-explainer cartoons: big round heads, dot eyes that blink, a mouth that talks, stick arms and legs, and flat vector backgrounds.

- **No character files needed.** The app draws everybody in code, and the clothes come from the role:

| Role | Clothes |
|---|---|
| Police | khaki uniform, cap, badge and belt |
| Judge | black robe, white bands and glasses |
| Lawyer | black coat and bands |
| Doctor | white coat |
| Waiter | white shirt, vest and bow tie |
| Thief | striped T-shirt, cap and eye mask |

  Women get long hair and a bindi, and old people get grey hair.
- **Hands really reach things.** The arms bend at the elbow, so a hand can hold a cup at the mouth, another person's hand, somebody's arm or a pocket.
- **Works with every category** (romance, drama, comedy, crime, horror, thriller, kids, motivational, mystery). Style and category are chosen separately in New Video.
- **Walking and running:** each foot stays planted on the ground while the body passes over it, then lifts and swings forward. The knees bend, the body bobs, and runners lean forward and pump their arms. The steps always match how far the person really moves, so nobody slides.
- **Backgrounds:** put the tag `flat` on your flat backgrounds and this style uses only them. Fifteen come ready made:

| Category | Ready-made backgrounds |
|---|---|
| Cafe / romance | cafe outside (with a door), cafe inside (counter and a table with two chairs), park (bench) |
| Family / drama | home living room (sofa and door) |
| Kids | village (huts, well, charpai), school classroom (blackboard and benches) |
| Crime / mystery | market street, city road, police station (desk and lock-up), court |
| Horror | haunted house at night |
| Work | office (desk) |
| Hospital | hospital room (bed) |
| Travel | train coach (see-through windows that show the moving view), railway platform |

| New action | What you see |
|---|---|
| hold_hands | two people walk hand in hand (write it before the leader's enter / walk / exit); let_go ends it |
| escort | police (or anybody) holds a person by the arm and takes them along |
| pickpocket | the thief sneaks behind the victim; a close-up shows the hand taking the wallet |
| beat | the crowd surrounds a person and punches, kicks and slaps them while the person cowers; hit sounds and angry shouting |
| give with "item": "coffee" | the cup stays in the hand, with steam coming off it |
| sip | the person lifts the cup to the mouth, closes their eyes while sipping, then lowers it |
| put_down | the person puts the cup away |
| door place + exit | the person walks into the door, seen from behind |

In the over-the-shoulder shots of this style, the listener is drawn from behind (back of the head and shoulders). In this style, close-ups, over-the-shoulder and reaction shots are zooms into the real scene, so chairs, tables and people stay where they are. The backgrounds are 4K, so zooms stay sharp.

- **Legs follow the real speed.** A person who moves gets steps, a person who stands still stands. Steps are short, cartoon style, and the standing leg stays straight (no crouching).
- **Walking in detail:**
  - the heel touches first and the toes push off;
  - the far-side arm and leg are a little darker, so you can see which leg is in front;
  - the head bobs and the shoulders swing;
  - in side view the face shows a small nose and turns towards the walking direction.
- **At a table:** people sitting at a table face each other and look at whoever speaks.
- **Crowd:** the crowd is drawn as the same flat people. They dance, cheer, clap, point, watch or walk past.
- **Vehicles, animals and props** are drawn in flat colours with dark outlines.

## Cinematic camera (v1.5)

- **Over-the-shoulder shots:** the listener's shoulder and head are in the foreground (seen from behind) and the speaker faces the camera, with the background softly blurred.
- **Close-ups** of the speaker's face, and **reaction shots** of the listener during long lines.
- **Court:**
  - when anybody else speaks, the camera is behind the judge;
  - when the judge speaks, the camera is behind the police / lawyer, and the judge sits behind the bench.
- **Shot order in a scene:** the first line is an establishing two-shot, then over-the-shoulder → close-up → over-the-shoulder → side two-shot …
- **Walking:** steps match the distance travelled (no sliding feet), and walkers are seen in profile.
- **Birthday:** people walk to their places. The camera goes wide → close-up of the birthday person → blowing the candles → cake close-up while cutting → two-shot while feeding.

## Festivals, travel and under water (v1.5)

| What | How it looks |
|---|---|
| garba | dancers circle with dandiya sticks, garba beat, lights, the crowd dances |
| rakhi | the sister walks to the brother, does aarti and ties the rakhi (close-up of the wrist; it stays on), feeds a laddu, and he gives a gift |
| eid | crescent moon and star, hanging lanterns; gesture salaam; hugs |
| christmas | decorated tree with blinking lights and gifts, Santa caps on everybody, jingle bells |
| moving_view | inside a train / plane / bus / car: the view outside the marked **Window** moves (fields, trees and poles / clouds / buildings), people rock gently, train or plane sound |
| underwater | weather "underwater": blue light, light rays, bubbles, fish, sea grass, bubbling sound; swimming without a water line |

## Camera and staging (v1.4)

- **Chase camera angles:**
  - side view;
  - **drone view from above** (road with trees, roofs and the siren light);
  - **chase cam** on a perspective road, with the car coming towards the camera and the police behind;
  - **wheel close-up**;
  - driver close-ups.

  The drone and chase-cam roads are drawn by the app, so no extra background is needed.
- **People keep their distance:** nobody stands inside somebody else any more, except when they touch on purpose (hug, fight, catch, give).
- **Football:** a real kick (back-swing, then strike). The ball leaves the foot and rolls to the other player. The last shot goes into the goal net and everybody celebrates.
- **Birthday:** a table with the cake in the middle. The birthday person stands behind it facing the camera, and the others stand on both sides. The order is song + clapping → blowing the candles (smoke) → cutting the cake with a knife → feeding a piece.
- **Kite:** a real patang (two colours, sticks, tail with bows), high in the sky, a sagging string, and a charkhi in the other hand.
- **Snow scenes:** the app picks a snowy / hill background. If you have none, TO-DO.txt asks for one.

## Places you mark on a background

Seat, behind desk (sits), judge bench, witness box, behind counter (stands: kitchen, lab, shop, bank), bed (lies), jail cell (bars), blackboard, climb to (tree / wall / roof top), window (the moving view outside a train / plane / bus).

The person is hidden behind the desk, bench, box or counter. People go to the right place by their role:

- judge → judge bench
- inspector / doctor / officer → desk
- patient → bed
- thief / prisoner → cell
- accused → witness box
- teacher → board
- cook / scientist / shopkeeper → counter

## Weather, effects and sound

- Weather: rain, storm (lightning + thunder), fog, wind; camera shake on shocks and fights.
- Ambience by place: village, city, night crickets, jungle, office, cafe.
- Sound effects:

| Group | Sounds |
|---|---|
| Vehicles | siren, engine, brakes, tyre screech, car doors |
| Police / court / jail | handcuffs, gavel, jail door |
| Kitchen and home | cooking sizzle, chopping, sweeping, temple bell, door knock, typing, snoring |
| Fights | punches, slap, falls |

## Story tools

- Narrator (calm voice, yellow subtitles) and "Agle din…" cards.
- **Your own full story** mode.
- **`TO-DO.txt`** in every video folder lists anything the story wanted that is not in this list yet, plus missing backgrounds with ready prompts.

## Subtitles (v0.9)

The video is rendered clean, then the subtitles are added on top. That means you can change them later without rendering again.

- **Presets:** Classic (box), YouTube bold, Karaoke (word by word), Cinematic, Hinglish + English, Hindi (Devanagari), Kids (handwritten), none.
- **Fonts** (Hindi + English): Poppins, Mukta, Hind, Kalam.
- **Library → Subtitles** (on any video):
  - Edit each line's text and start / end time.
  - Change size, colours, box, outline, position (bottom / middle / top), language, names on/off, karaoke, italic and CAPITALS.
  - Live preview while you change things.
  - **Save & burn subtitles** (a few minutes, no re-render).
  - **Use as my default style** → New Video → Subtitles → "My style".
- `subtitles.srt` is always saved too, for YouTube's own captions.

## Not yet (send your TO-DO lists)

Multi-angle backgrounds for talk scenes (front / reverse painted views of the same place), Ganesh Chaturthi, Durga Puja, Onam, Pongal. Send your TO-DO lists for more.

## Prompt Studio (v1.7)

**v1.10:** Prompt Studio has the New Video tools too: *Find topics* (real news or AI ideas; click one to fill the topic), main character (hero), number of main characters and of all characters, saved characters, *Start a series* and **▶ Next episode** on any story (same characters with the exact same consistency tags, same places, continues after the last ending). Story AI can be **Paste from Gemini app (no API)**: every step shows a window with *Copy prompt*; paste Gemini's answer back and the app continues. Stories in both tabs are now written like a real film / web-series screenplay: every scene has a goal, conflict and turn, conversations are real back-and-forth (6–14 short lines with reactions, interruptions and silences, shot / reverse-shot in Studio), each character has an own voice, and the story has a hook, rising stakes, a twist and a payoff.

A new tab that writes a complete, original story as prompts for AI video tools (Flow, Veo, Kling…). It follows the "Animation Story Engine" rules and libraries.

**Input:**
- Genre (or a mix of two)
- Duration (1–120 min)
- Style (2D Anime / 2D Cartoon / 2D Storybook / 3D Stylized / 3D Realistic)
- Language
- Aspect (16:9 / 9:16)
- Audience
- Topic (optional)

**Phases:**
1. **Story Bible:**
   - title and logline;
   - synopsis and theme;
   - characters, each with a full consistency tag;
   - locations, each with a full location tag;
   - key props;
   - colour and lighting guide;
   - act outline;
   - scene and shot plan.
2. **Scenes:** location, time, weather, characters, props, mood, goal and summary for every scene.
3. **Shots:** batches of up to 10 scenes. Each shot has:
   - shot type, angle and camera move;
   - action;
   - image prompt and video prompt;
   - dialogue (with emotion and delivery) or voiceover;
   - SFX, music and transition;
   - a continuity note.

   Each batch also gets a continuity checkpoint.

Videos of 1–3 minutes get all three phases at once.

**Consistency:** the AI writes `{{C01}}` / `{{L01}}` / `{{P01}}` / `{{STYLE}}` placeholders, and the app fills in the exact Story Bible text. Every image prompt therefore carries the same character and location wording.

**Variety:** every story gets a new variety seed (era, region, protagonist, conflict, twist). A **used-stories log** stops repeats.

**Buttons:**

| Button | What it does |
|---|---|
| NEXT | Writes the next batch of shots |
| REDO scene (+ optional note) | Rewrites one scene's shots |
| More scary / More emotional / Faster pace | Changes the tone of the next batches |
| Thumbnail | Writes 3 thumbnail prompts, 5 titles, a description and tags |
| Only prompts | Lists every image and video prompt |
| Voiceover script | Gives all dialogue and narration with timings |
| Character sheet | Gives reference-sheet prompts for every character and location |
| Open folder | Opens the project folder |
| Delete | Deletes the project |

**Saved files:** every project is saved in `Documents\AutoVideo\studio\projects\<id>\`:
- `project.json`
- `full_with_prompts.json`
- `ONLY_PROMPTS.txt`
- `VOICEOVER_SCRIPT.txt`
- `CHARACTER_SHEET.txt`
- `THUMBNAILS_TITLES.txt`

You can close the app and continue with NEXT later.

**Libraries:** the genre, location / prop, structure and schema libraries are in `Documents\AutoVideo\studio\library`. Click **Edit libraries** to open that folder and add genres, locations or props.

**Make the video in this app:**
1. In a Prompt Studio story, choose the video style (Flat 2D Explainer, 2D Cartoon Stage…) and the subtitles.
2. Click **Make video ▶**.

The story is written out like a screenplay: every scene with its place and time, every action, every dialogue line and the narration. It goes to New Video in "My full story" mode. The video maker keeps the events and the dialogue, picks backgrounds, actions and camera, adds voices, music and subtitles, and renders the MP4. You can follow it in the Queue tab.
