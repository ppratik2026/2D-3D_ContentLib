# Making a video from your own story

## Steps

1. **New Video → 2. Story → "My full story (I wrote it)".**
2. Paste your story, or click **Load .txt file**.
   - Hindi, Hinglish or English all work, at any length.
   - The app shows the word count and about how many minutes of video it makes.
3. Pick the **category** (for the music and mood) and the **style** (2D Cartoon Stage recommended).
4. Pick the **Story source**:
   - **An AI with a key** (Gemini, Groq, OpenRouter…): the app reads the story in parts, so even a 20-minute story works.
   - **Paste from Gemini app**: click **Copy prompt** (your story is inside the prompt), paste it in gemini.google.com, then paste the answer back into the app.
5. **Add & start.**

## What the AI does with your story

- Keeps **every event and every dialogue, in your order**. It does not invent a new ending.
- Finds all characters. Each gets a 3D actor (by gender / age / role tags) and a fixed voice.
- Splits the story into scenes and picks a background for each from your library.
- Adds actions and camera shots: walking, sitting, vehicles, chases, arrests, court, jail, hospital, lab…
- Uses a **narrator** (calm voice, yellow italic subtitle) only for things nobody can act, like "us raat bahut sannaata tha".
- Adds **cards** like "Agle din…" for jumps in time or place.

## How to write a story that comes out well

- Write who says what. For example: `Inspector Arjun: "Raka, gaadi roko!"` Short lines work best.
- Name the places, for example: police station, court, highway, hospital, village street at night.
- Say the time and weather: raat, subah, baarish, toofan, kohra.
- Give characters a role the first time they appear: "Raka, ek chor…", "Judge saahab…", "Dr. Neha, forensic expert…". The app uses the role to choose the actor and the place (the judge goes to the bench, the patient to the bed, the thief to the jail cell).

## The TO-DO list (how the app grows with your stories)

After every video, check `TO-DO.txt` in the video's folder (`Documents\AutoVideo\Videos\…`). It lists two things:

1. **Actions the story needed that the app cannot animate yet**, for example `climb`, `fight`, `swim`, `fire`. In this video the narrator told them instead.
2. **Backgrounds that are missing.** The closest one was used this time. Each comes with a ready image prompt: make the image and import it in the Backgrounds tab.

Collect these lists and send them for the next update. Each new action (fight, bike chase, swimming, fire, rain dance…) gets added to the app. After that, every story that needs it is animated automatically, and the update arrives through **Settings → Check for updates**.
