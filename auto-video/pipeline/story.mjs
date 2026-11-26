// Step 1: Gemini writes the story (outline first, then every scene's beats) as strict JSON.
// Uses Gemini's OpenAI-compatible endpoint with the key as a Bearer token.
import { CATEGORIES, LOCATIONS, ACTIONS, TIMES_OF_DAY, VEHICLES, MARKS } from './config.mjs';

import { askJSON, parseJSON } from './ai.mjs';

const SYSTEM = `You are a screenwriter for short animated 3D videos for an Indian audience.
Dialogue is spoken by Hindi text-to-speech, so every line has three versions:
- "hindi": natural spoken Hindi in Devanagari script (English words written in Devanagari, e.g. "कॉफ़ी", "प्लीज़").
- "hinglish": the same line in Roman Hinglish (e.g. "Do cappuccino, please.").
- "english": an English translation.
Keep each line short (max ~14 words). Characters are Indian unless the user says otherwise.
Return ONLY valid JSON, no markdown.`;

export async function writeStory({ category, minutes, idea = '', chain = [], actors = [], backgrounds = [], chars = 'auto', onLog = () => {}, onProgress = () => {} }) {
  // 1) whole story in ONE request (saves free quota: 1 request per video)
  onProgress(0, 1, 'Writing the whole story (1 request)');
  try {
    const { value, used } = await askJSON(chain, { user: buildPastePrompt({ category, minutes, idea, actors, backgrounds, chars }), onLog, validate: (j) => storyFromObject(j, minutes) });
    onLog(`Story written by ${used.provider} · ${used.model}`); onProgress(1, 1, 'Story ready');
    return { ...value, category, minutes };
  } catch (e) { if (!e.cut) throw e; onLog('Story too long for one reply — writing it scene by scene…'); }
  // 2) fallback for very long videos: outline, then each scene
  const gemini = async (messages, o) => (await askJSON(chain, { system: messages.find((m) => m.role === 'system')?.content, user: messages.filter((m) => m.role !== 'system').map((m) => m.content).join('\n\n'), onLog: o.onLog })).value;
  const key = null, models = null;
  const cat = CATEGORIES[category] || CATEGORIES.drama;
  const totalSec = Math.round(minutes * 60);
  const nScenes = Math.max(2, Math.min(18, Math.round(minutes * 1.6)));
  const locs = Object.entries(LOCATIONS).map(([k, v]) => `"${k}": ${v}`).join('\n');
  const actorList = actors.map((a) => `"${a.id}": ${a.gender}, ${a.age}${a.tags?.length ? ', ' + a.tags.join('/') : ''}`).join('\n');
  onLog(`Gemini: outline (${nScenes} scenes, ~${totalSec}s)`); onProgress(0, nScenes + 1, 'Writing outline');
  const outline = await gemini([
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Write the outline of ${cat.hint}. Category: ${cat.label}. Total length about ${totalSec} seconds.
${idea ? `User idea / title: ${idea}` : 'Invent an original title and idea.'}
Use 2 to 5 characters. Use about ${nScenes} scenes.
${actorList ? `Each character is played by one of these 3D actors (pick the best match by gender/age/role, use different actors where possible, write its id in "model"):\n${actorList}\n` : ''} Each scene happens in ONE of these locations (use the key):
${locs}
JSON shape:
{"title":"Hinglish title","title_hindi":"हिंदी शीर्षक","logline":"one line","moral":"optional last line message or empty",
 "characters":[{"id":"short_lowercase_id","name":"Indian name","gender":"male|female","age":"child|young|adult|old","role":"e.g. detective","top_color":"#hex","bottom_color":"#hex","hair_color":"#hex","personality":"few words","model":"actor id"}],
 "scenes":[{"location":"one key from the list","time_of_day":"${TIMES_OF_DAY.join('|')}","present":["character ids"],"summary":"what happens","seconds":number}]}
The scene seconds must add up to about ${totalSec}.` }], { key, models, onLog });
  normalizeOutline(outline, totalSec); let doneScenes = 0; onProgress(1, outline.scenes.length + 1, 'Outline ready');
  // Step 2: beats for each scene
  const out = { ...outline, category, minutes, scenes: [] };
  const charList = outline.characters.map((c) => `${c.id} (${c.name}, ${c.gender}, ${c.age}, ${c.role})`).join('; ');
  const jobs = outline.scenes.map((sc, i) => async () => {
    onLog(`Gemini: scene ${i + 1}/${outline.scenes.length} dialogue`);
    const lines = Math.max(3, Math.round(sc.seconds / 4.2));
    const prev = outline.scenes.slice(0, i).map((s, k) => `${k + 1}. ${s.summary}`).join('\n');
    const res = await gemini([
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Story "${outline.title}" (${cat.label}). ${outline.logline}
Characters: ${charList}
Previous scenes:\n${prev || '(this is the first scene)'}
Now write scene ${i + 1}: location "${sc.location}" at ${sc.time_of_day}. Present: ${sc.present.join(', ')}. Summary: ${sc.summary}
Write about ${lines} dialogue lines (scene length about ${sc.seconds} seconds), with simple actions between them.
Allowed actions (use exactly these words): ${ACTIONS.join(', ')}.
- "enter"/"exit"/"run_exit": a character comes into / leaves the place. Characters already present at the start do not need "enter".
- "sit"/"stand": sit down on a chair/sofa/bench or stand up. "walk_to" needs "target": another character id.
JSON shape: {"beats":[{"type":"action","char":"id","action":"one allowed action","target":"optional id"},
 {"type":"line","char":"id","emotion":"neutral|happy|sad|angry|surprised|scared","hindi":"देवनागरी","hinglish":"Roman Hinglish","english":"English"}]}` }], { key, models, onLog });
    const scene = { ...sc, beats: normalizeBeats(res.beats || [], outline.characters, sc) };
    out.scenes[i] = scene; doneScenes++; onProgress(1 + doneScenes, outline.scenes.length + 1, `Scene ${doneScenes}/${outline.scenes.length} dialogue`);
  });
  await runPool(jobs, 1); // one at a time: free keys allow only a few requests per minute
  return out;
}

async function runPool(jobs, n) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { const j = i++; await jobs[j](); } })); }

const HEX = /^#?[0-9a-f]{6}$/i;
function normalizeOutline(o, totalSec) {
  if (!Array.isArray(o.characters) || !o.characters.length) throw new Error('Gemini returned no characters');
  o.title = String(o.title || 'Untitled');
  const ids = new Set();
  o.characters = o.characters.slice(0, 12).map((c, i) => {
    let id = String(c.id || c.name || 'c' + i).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16) || 'c' + i; while (ids.has(id)) id += i; ids.add(id);
    const col = (v, d) => (HEX.test(String(v || '')) ? '#' + String(v).replace('#', '') : d);
    return { id, name: String(c.name || id), gender: c.gender === 'female' ? 'female' : 'male', age: ['child', 'young', 'adult', 'old'].includes(c.age) ? c.age : 'adult',
      role: String(c.role || ''), model: String(c.model || ''), top_color: col(c.top_color, ['#2f5d8a', '#b23a48', '#3f7d4e', '#7a4fa0', '#c98a2b'][i % 5]), bottom_color: col(c.bottom_color, '#2b2b30'), hair_color: col(c.hair_color, '#1c1612'), personality: String(c.personality || '') };
  });
  const idList = o.characters.map((c) => c.id);
  o.scenes = (o.scenes || []).filter(Boolean).map((s) => ({
    location: LOCATIONS[s.location] ? s.location : 'street', time_of_day: TIMES_OF_DAY.includes(s.time_of_day) ? s.time_of_day : 'day',
    background: s.background ? String(s.background) : '', weather: ['rain', 'storm', 'fog', 'wind'].includes(s.weather) ? s.weather : 'none',
    present: (Array.isArray(s.present) ? s.present : []).map((x) => matchId(x, o.characters)).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6),
    summary: String(s.summary || ''), seconds: Math.max(12, Number(s.seconds) || 30) }));
  if (!o.scenes.length) throw new Error('Gemini returned no scenes');
  for (const s of o.scenes) if (!s.present.length) s.present = idList.slice(0, 2);
  const sum = o.scenes.reduce((a, s) => a + s.seconds, 0); for (const s of o.scenes) s.seconds = Math.round(s.seconds * totalSec / sum);
}
function matchId(x, chars) { const v = String(x || '').toLowerCase(); const c = chars.find((c) => c.id === v || c.name.toLowerCase() === v || v.includes(c.id)); return c && c.id; }
export function normalizeBeats(beats, chars, sc) {
  const out = []; const unsupported = [];
  for (const b of beats) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'card') { const text = String(b.text || b.hinglish || b.english || '').trim(); if (text) out.push({ type: 'card', text: text.slice(0, 80) }); continue; }
    if (b.type === 'narration' || /^narrat|^sutradhar|^सूत्रधार/i.test(String(b.char || ''))) {
      const hindi = String(b.hindi || b.hinglish || '').trim(), hinglish = String(b.hinglish || b.hindi || '').trim(); if (hindi) out.push({ type: 'line', char: 'narrator', emotion: 'neutral', hindi, hinglish, english: String(b.english || hinglish) });
      continue; }
    if (['fire', 'fire_out', 'explosion'].includes(b.action) && !matchId(b.char, chars)) { out.push({ type: 'action', char: null, action: b.action, target: matchId(b.target, chars) || null, where: b.where, size: b.size, small: b.small }); continue; }
    if (b.action === 'animal' || b.action === 'crowd') { // no character needed
      out.push({ type: 'action', char: null, action: b.action, animal: ['dog', 'cow', 'horse', 'goat', 'cat', 'elephant', 'birds'].includes(b.animal) ? b.animal : 'dog', act: String(b.act || 'enter'), target: matchId(b.target, chars) || null, mood: ['dance', 'cheer', 'clap', 'watch', 'walk', 'none'].includes(b.mood) ? b.mood : 'watch', count: Number(b.count) || 8 }); continue; }
    const char = matchId(b.char, chars);
    if (b.type !== 'line' && !b.hindi && !b.hinglish && b.action && !ACTIONS.includes(b.action)) { unsupported.push(String(b.action).toLowerCase().slice(0, 30)); continue; }
    if (!char) continue;
    if (b.type === 'line' || b.hindi || b.hinglish) {
      const hindi = String(b.hindi || b.hinglish || '').trim(), hinglish = String(b.hinglish || b.hindi || '').trim();
      if (!hindi) continue;
      out.push({ type: 'line', char, emotion: String(b.emotion || 'neutral'), hindi, hinglish, english: String(b.english || hinglish) });
    } else if (ACTIONS.includes(b.action)) {
      const a = { type: 'action', char, action: b.action, target: matchId(b.target, chars) || null };
      if (b.vehicle) a.vehicle = VEHICLES.includes(b.vehicle) ? b.vehicle : 'car';
      if (b.chaser_vehicle) a.chaser_vehicle = VEHICLES.includes(b.chaser_vehicle) ? b.chaser_vehicle : 'police_jeep';
      if (HEX.test(String(b.color || ''))) a.color = '#' + String(b.color).replace('#', '');
      if (b.place && MARKS[b.place]) a.place = b.place;
      if (b.item) a.item = String(b.item).toLowerCase() === 'money' ? 'money' : 'give';
      if (b.game) a.game = String(b.game); if (b.where) a.where = String(b.where); if (b.size) a.size = Number(b.size); if (b.small) a.small = true;
      if (Number(b.seconds)) a.seconds = Math.max(4, Math.min(20, Number(b.seconds)));
      for (const f of ['with', 'chasers']) if (Array.isArray(b[f])) a[f] = b[f].map((x) => matchId(x, chars)).filter((x) => x && x !== char);
      if (['get_in', 'get_out', 'drive_in', 'drive_away', 'car_chase'].includes(a.action) && !a.vehicle) a.vehicle = a.action === 'car_chase' ? 'car' : 'police_jeep';
      if (a.action === 'car_chase' && !a.chasers?.length && a.target) a.chasers = [a.target];
      if (a.action === 'foot_chase' && !a.chasers?.length && a.target) a.chasers = [a.target];
      out.push(a);
    }
  }
  if (!sc.present.length) sc.present = [...new Set(out.map((b) => b.char).filter((c) => c && c !== 'narrator'))].slice(0, 6);
  // anyone who speaks must be in the scene
  sc.unsupported = [...new Set(unsupported)];
  const arrives = (id) => out.some((x) => x.type === 'action' && ((x.action === 'enter' && x.char === id) || (['drive_in', 'car_chase'].includes(x.action) && (x.char === id || x.with?.includes(id) || x.chasers?.includes(id))) || (x.action === 'foot_chase' && (x.char === id || x.chasers?.includes(id)))));
  for (const b of out) if (b.char && b.char !== 'narrator' && !sc.present.includes(b.char) && sc.present.length < 6 && !arrives(b.char)) sc.present.push(b.char);
  return out;
}

// ---------- "Paste from Gemini app" mode: one prompt → whole story JSON (works with the Gemini app subscription, no API) ----------

function actionHelp(stage) { return `Between dialogue lines add actions (only these words): ${ACTIONS.join(', ')}.
- "enter"/"exit"/"run_exit" = comes in / leaves; "sit"/"stand"; "walk_to" needs "target" = another character id.
- Gestures: wave, nod, laugh, point, think, shock, drink, phone, look_around, hands_up, salute, namaste, cry, angry, clap, examine (magnifying glass), test_tube (lab), torch (flashlight at night), read/file (reads a file), write (notes), gavel (judge).
- Daily life (optional "seconds"): cook (pan at the stove), chop (vegetables), eat, serve (tray with tea), sweep (broom), aarti (temple thali), pray, dance, knock (door), shiver (cold / fear), type (laptop), sleep (lies down asleep; "stand" wakes up). Kitchen/shop/lab: use {"action":"go_to","place":"counter"} first.
- With another person ("target" = their id): hug, fight, push, slap, give (optional "item":"gift|money").
- Two-wheelers and horse riding use the vehicle actions with "vehicle":"bike|scooter|cycle|horse" (drive_in / get_in / get_out / drive_away; a thief can run away on a bike in a car_chase).
- Animals: {"type":"action","action":"animal","animal":"dog|cow|horse","act":"enter|exit|run|bark|moo|neigh|graze|sit|follow","target":"char id for follow"}.
- Crowd in the background: {"type":"action","action":"crowd","mood":"dance|cheer|clap|watch|walk|none","count":8}.
- Fire and blasts: {"type":"action","action":"fire","where":"left|center|right","size":1} (keeps burning, crackling) / {"type":"action","action":"fire_out"} / {"type":"action","char":"id","action":"explosion","where":"right"} (flash, fireball, smoke, debris, everybody near is shocked).
- Rain: use "weather":"rain" or "storm" for the scene and the gesture {"action":"umbrella","seconds":8} for people holding umbrellas.
- Games: {"type":"action","char":"batsman / kid id","action":"game","game":"cricket|ball|skip|kite|tag","with":["bowler / other kids"],"seconds":10} (cricket = bowling, shot, ball flying, fielders clap; ball = throw and catch; skip = skipping rope; kite = kite flying; tag = pakdam-pakdai, running around). Lines can be spoken during the game.
- Water: vehicle "boat" (rowing, on a river / lake background), {"action":"swim","char":"id","seconds":6} (needs water in the background).
- Train: vehicle "train" with drive_in (arrives at the platform and stops), get_in / get_out, drive_away.
- Climb: {"action":"climb","char":"id"} goes up a ladder, or to the "climb" place (tree / wall top) marked in the background; {"action":"climb_down"}.
- More animals: goat (bleat), cat (meow), elephant (trumpet), birds ({"action":"animal","animal":"birds","act":"fly"} — a flock crosses the sky).
- Wedding procession: {"type":"action","action":"baraat","char":"groom id","with":["dancing relatives"],"seconds":12} — the groom rides a decorated horse with a safa, dhol and shehnai play, the crowd dances.
${stage ? `- Places in the background (if the background has them): {"action":"go_to","char":"id","place":"${Object.keys(MARKS).join('|')}"}. People whose role fits (judge, inspector at desk, patient in bed, prisoner in cell, accused in witness box, teacher at board, scientist at lab counter) start there automatically.
- "faint" = falls down (or a dead body lying), "lie" = lies down; "stand" gets up again.
- Vehicles (${VEHICLES.join(', ')}): {"action":"drive_in","char":"driver id","vehicle":"police_jeep","with":["passenger ids"]} (arrives and stops), {"action":"get_out","char":"id","vehicle":"police_jeep"}, {"action":"get_in","char":"id","vehicle":"police_jeep"}, {"action":"drive_away","char":"driver id","vehicle":"police_jeep"}.
- Chases: {"action":"car_chase","char":"thief id","vehicle":"car","color":"#hex","chaser_vehicle":"police_jeep","chasers":["inspector id"],"seconds":8} — the next lines are shouted during the chase; then {"action":"get_out"} + {"action":"foot_chase","char":"thief id","chasers":["ids"],"seconds":6}, then {"action":"catch","char":"police id","target":"thief id"} and {"action":"handcuff","char":"police id","target":"thief id"}. Put a chase in its own scene on a road / lane background.` : ''}
- Narrator: {"type":"narration","hindi":"…","hinglish":"…","english":"…"} for time jumps, feelings, and anything that cannot be acted (no character on screen speaks it). Use it sparingly.
- Title card for a jump in time or place: {"type":"card","text":"Agle din — Court"}.
- If something happens that is not in the action list (fight, climb, swim, dance, fire, explosion…), still write it as an action with your own short English word (e.g. {"type":"action","char":"id","action":"fight"}) AND add a narration line that tells it. The app lists these so they can be added later.${stage ? `
- If no background fits a scene, write "background":"new: short English description of the place" (the app uses the closest one and tells the user which image to make).` : ''}`; }
export function buildPastePrompt({ category, minutes, idea = '', actors = [], backgrounds = [], chars = 'auto' }) {
  const cat = CATEGORIES[category] || CATEGORIES.drama; const totalSec = Math.round(minutes * 60);
  const nScenes = Math.max(2, Math.min(30, Math.round(minutes * 1.6))); const lines = Math.max(6, Math.round(totalSec / 4.2));
  const stage = backgrounds.length > 0;
  const places = stage ? backgrounds.map((b) => `- ${b.id}: ${b.name}${b.place ? ' (' + b.place.replace(/_/g, ' ') + ')' : ''}, ${b.time}${b.tags?.length ? ', ' + b.tags.join('/') : ''}${b.marks?.length ? ' [has: ' + b.marks.join(', ') + ']' : ''}`).join('\n')
    : Object.entries(LOCATIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  const actorList = actors.map((a) => `- ${a.id}: ${a.gender}, ${a.age}${a.tags?.length ? ', ' + a.tags.join('/') : ''}`).join('\n');
  const nChars = chars === 'auto' ? (minutes >= 10 ? '6 to 12' : minutes >= 4 ? '4 to 8' : '2 to 5') : chars;
  const crimePlan = stage && /crime|thriller|mystery/.test(category) ? '\nCID / police episode structure: crime is found (faint/lie for a body, shock) → police arrive (drive_in) → investigation (examine, lab with test_tube, witnesses, read file) → suspect runs (car_chase and/or foot_chase) → catch + handcuff → get_in police_jeep, drive_away → jail scene (prisoner in cell) → next day court (judge, lawyers, accused in witness box, gavel) → verdict and moral.' : '';
  const genreFx = /horror|thriller|crime|mystery/.test(category) ? 'Use "weather" for mood: rain, storm (thunder and lightning), fog or wind where it fits; most scenes at night.' : 'Use "weather" only when the story needs it (rain, storm, fog, wind), otherwise "none".';
  return `${SYSTEM}

Write ${cat.hint}. Category: ${cat.label}. Total length about ${totalSec} seconds (${minutes} min): about ${nScenes} scenes and about ${lines} dialogue lines in total. Keep a strong story: hook in the first scene, rising conflict, twist, clear ending.
${idea ? `Idea / title: ${idea}` : 'Invent an original title and idea.'}
Use ${nChars} characters with clearly different ages and roles (for example dada, dadi, father, mother, son, daughter, child, villager, inspector, constable, doctor, villain).${actorList ? ` Each character is played by one of these actors (write its id in "model"; different characters may share an actor):\n${actorList}` : ''}
${stage ? 'Every scene happens in front of one of these painted backgrounds (write its id in "background"):' : 'Every scene uses one of these locations (write the key in "location"):'}
${places}
At most 6 characters in one scene. ${genreFx}${crimePlan}
${actionHelp(stage)}

Reply with ONLY this JSON (no other text):
{"title":"Hinglish title","title_hindi":"हिंदी शीर्षक","logline":"one line","moral":"last message or empty",
 "characters":[{"id":"short_id","name":"Indian name","gender":"male|female","age":"child|young|adult|old","role":"role","top_color":"#hex","bottom_color":"#hex","hair_color":"#hex","personality":"few words","model":"actor id"}],
 "scenes":[{${stage ? '"background":"background id"' : '"location":"key"'},"time_of_day":"${TIMES_OF_DAY.join('|')}","weather":"none|rain|storm|fog|wind","present":["character ids at the start"],"summary":"what happens","seconds":30,
   "beats":[{"type":"action","char":"id","action":"enter"},
            {"type":"line","char":"id","emotion":"neutral|happy|sad|angry|surprised|scared","hindi":"देवनागरी","hinglish":"Roman Hinglish","english":"English"}]}]}`;
}
export function storyFromObject(j, minutes = 1) {
  const src = JSON.parse(JSON.stringify(j)); normalizeOutline(j, Math.round(minutes * 60));
  j.scenes = j.scenes.map((sc, i) => { const beats = normalizeBeats(src.scenes?.[i]?.beats || [], j.characters, sc); return { ...sc, beats }; });
  if (!j.scenes.some((sc) => sc.beats.some((b) => b.type === 'line'))) throw new Error('The story has no dialogue lines.');
  finishStory(j); return j;
}
export const NARRATOR = { id: 'narrator', name: 'Narrator', gender: 'male', age: 'adult', role: 'narrator', hidden: true, top_color: '#333333', bottom_color: '#333333', hair_color: '#111111', personality: 'calm storyteller' };
function finishStory(j) { // narrator voice if needed + what the app could not show yet
  if (j.scenes.some((sc) => sc.beats.some((b) => b.char === 'narrator')) && !j.characters.some((c) => c.id === 'narrator')) j.characters.push({ ...NARRATOR });
  j.unsupported = [...new Set(j.scenes.flatMap((sc) => sc.unsupported || []))];
  j.newBackgrounds = j.scenes.filter((sc) => /^new\s*:/i.test(sc.background || '')).map((sc) => sc.background.replace(/^new\s*:\s*/i, '').trim()).filter((v, i, a) => v && a.indexOf(v) === i);
  return j;
}
export function parsePastedStory(text, minutes = 1) {
  let j; try { j = parseJSON(String(text || '')); } catch { throw new Error('Could not read the pasted text as JSON. Copy the AI\'s whole answer (the part between { and }).'); }
  return storyFromObject(j, minutes);
}

// ---------- "My full story": the user's own story → scenes (faithful, part by part) ----------
const SCENE_SHAPE = (stage) => `{${stage ? '"background":"background id or new: description"' : '"location":"key"'},"time_of_day":"${TIMES_OF_DAY.join('|')}","weather":"none|rain|storm|fog|wind","present":["character ids at the start"],"summary":"what happens","seconds":30,
   "beats":[{"type":"action","char":"id","action":"enter"},
            {"type":"line","char":"id","emotion":"neutral|happy|sad|angry|surprised|scared","hindi":"देवनागरी","hinglish":"Roman Hinglish","english":"English"},
            {"type":"narration","hindi":"…","hinglish":"…","english":"…"}, {"type":"card","text":"…"}]}`;
const FAITHFUL = `Follow the user's story faithfully: keep every event and every piece of dialogue, in the same order. Do not add new events, characters or a different ending, and do not skip parts.
If the story already has dialogue, use it (only make it short and natural; split long speeches into several lines). If a part is told only as narration, act it out with short dialogue and actions where natural; otherwise use narrator lines.`;
function listPlaces(backgrounds) { return backgrounds.map((b) => `- ${b.id}: ${b.name}${b.place ? ' (' + b.place.replace(/_/g, ' ') + ')' : ''}, ${b.time}${b.tags?.length ? ', ' + b.tags.join('/') : ''}${b.marks?.length ? ' [has: ' + b.marks.join(', ') + ']' : ''}`).join('\n'); }
function castFields() { return '{"id":"short_id","name":"name from the story","gender":"male|female","age":"child|young|adult|old","role":"role in the story (e.g. inspector, thief, judge, mother, patient)","top_color":"#hex","bottom_color":"#hex","hair_color":"#hex","personality":"few words","model":"actor id"}'; }
export function splitStory(text, max = 2400) {
  const paras = String(text || '').replace(/\r/g, '').split(/\n\s*\n|\n(?=\S)/).map((x) => x.trim()).filter(Boolean); const out = []; let cur = '';
  const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
  for (const p of paras) {
    if (p.length > max) { push(); let part = ''; for (const s of p.split(/(?<=[।.!?])\s+/)) { if ((part + ' ' + s).length > max && part) { out.push(part.trim()); part = ''; } part += ' ' + s; } if (part.trim()) out.push(part.trim()); continue; }
    if ((cur + '\n\n' + p).length > max) push(); cur += (cur ? '\n\n' : '') + p;
  }
  push(); return out;
}
function castPrompt({ text, category, actors }) {
  const actorList = actors.map((a) => `- ${a.id}: ${a.gender}, ${a.age}${a.tags?.length ? ', ' + a.tags.join('/') : ''}`).join('\n');
  return `${SYSTEM}

Below is a story written by the user (it may be in Hindi, Hinglish or English). Read all of it and list EVERY character who appears or speaks (not the narrator).
${actorList ? `Each character is played by one of these actors (write its id in "model"; different characters may share one):\n${actorList}\n` : ''}Category: ${(CATEGORIES[category] || CATEGORIES.drama).label}.
Reply with ONLY this JSON:
{"title":"Hinglish title (from the story)","title_hindi":"हिंदी शीर्षक","logline":"one line","moral":"the story's message or empty","characters":[${castFields()}]}

STORY:
${text}`;
}
function partPrompt({ part, index, total, cast, prev, backgrounds, stage }) {
  const chars = cast.characters.map((c) => `- ${c.id}: ${c.name}, ${c.gender}, ${c.age}, ${c.role}`).join('\n');
  return `${SYSTEM}

The user's story "${cast.title}" is being turned into an animated video, part by part. This is part ${index + 1} of ${total}.
${FAITHFUL}
Characters (use these ids only):
${chars}
${prev ? `What happened before this part: ${prev}\n` : ''}${stage ? 'Every scene happens in front of one of these painted backgrounds (write its id in "background"):' : 'Every scene uses one of these locations (write the key in "location"):'}
${stage ? listPlaces(backgrounds) : Object.entries(LOCATIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
At most 6 characters in one scene. A new place or a jump in time = a new scene.
${actionHelp(stage)}

Reply with ONLY this JSON (no other text):
{"scenes":[${SCENE_SHAPE(stage)}]}

PART ${index + 1} OF THE STORY:
${part}`;
}
// one prompt for the Gemini app (paste mode)
export function buildAdaptPrompt({ text, category, actors = [], backgrounds = [] }) {
  const stage = backgrounds.length > 0; const actorList = actors.map((a) => `- ${a.id}: ${a.gender}, ${a.age}${a.tags?.length ? ', ' + a.tags.join('/') : ''}`).join('\n');
  return `${SYSTEM}

Turn the user's story below into an animated video script. ${FAITHFUL}
Category: ${(CATEGORIES[category] || CATEGORIES.drama).label}. List every character.${actorList ? ` Each character is played by one of these actors (write its id in "model"):\n${actorList}` : ''}
${stage ? 'Every scene happens in front of one of these painted backgrounds (write its id in "background"):' : 'Every scene uses one of these locations (write the key in "location"):'}
${stage ? listPlaces(backgrounds) : Object.entries(LOCATIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
At most 6 characters in one scene. A new place or a jump in time = a new scene.
${actionHelp(stage)}

Reply with ONLY this JSON (no other text):
{"title":"Hinglish title","title_hindi":"हिंदी शीर्षक","logline":"one line","moral":"message or empty","characters":[${castFields()}],
 "scenes":[${SCENE_SHAPE(stage)}]}

STORY:
${text}`;
}
export async function adaptStory({ text, category, minutes = 10, chain = [], actors = [], backgrounds = [], onLog = () => {}, onProgress = () => {} }) {
  const stage = backgrounds.length > 0; const parts = splitStory(text); if (!parts.length) throw new Error('Your story is empty.');
  const total = parts.length + 1; onProgress(0, total, 'Reading your story: characters');
  const { value: cast, used } = await askJSON(chain, { user: castPrompt({ text, category, actors }), onLog, validate: (j) => { if (!Array.isArray(j.characters) || !j.characters.length) throw new Error('No characters found'); return j; } });
  onLog(`Characters: ${cast.characters.map((c) => c.name).join(', ')} (${used.provider} · ${used.model})`);
  const ids = new Set(cast.characters.map((c) => String(c.id))); const scenes = []; let prev = '';
  const convert = async (part, i, depth = 0) => {
    try { const { value } = await askJSON(chain, { user: partPrompt({ part, index: i, total: parts.length, cast, prev, backgrounds, stage }), onLog, validate: (j) => { if (!Array.isArray(j.scenes) || !j.scenes.length) throw new Error('No scenes in the reply'); return j; } }); return value.scenes; }
    catch (e) { if (!e.cut || depth > 1) throw e; const half = splitStory(part, Math.ceil(part.length / 2) + 20); onLog(`Part ${i + 1} too long for one reply — splitting it`); const out = []; for (const h of half) out.push(...(await convert(h, i, depth + 1))); return out; }
  };
  for (let i = 0; i < parts.length; i++) {
    onProgress(i + 1, total, `Turning part ${i + 1}/${parts.length} of your story into scenes`);
    const sc = await convert(parts[i], i); scenes.push(...sc);
    prev = (prev + ' ' + sc.map((x) => x.summary).filter(Boolean).join(' ')).slice(-700);
  }
  void ids;
  const j = storyFromObject({ ...cast, scenes }, minutes); onProgress(total, total, 'Story ready');
  return { ...j, category, minutes, fromUser: true };
}
