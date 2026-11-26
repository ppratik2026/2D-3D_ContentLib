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
