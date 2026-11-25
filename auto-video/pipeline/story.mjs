// Step 1: Gemini writes the story (outline first, then every scene's beats) as strict JSON.
// Uses Gemini's OpenAI-compatible endpoint with the key as a Bearer token.
import { CATEGORIES, LOCATIONS, ACTIONS, TIMES_OF_DAY } from './config.mjs';

import { askJSON, parseJSON } from './ai.mjs';

const SYSTEM = `You are a screenwriter for short animated 3D videos for an Indian audience.
Dialogue is spoken by Hindi text-to-speech, so every line has three versions:
- "hindi": natural spoken Hindi in Devanagari script (English words written in Devanagari, e.g. "कॉफ़ी", "प्लीज़").
- "hinglish": the same line in Roman Hinglish (e.g. "Do cappuccino, please.").
- "english": an English translation.
Keep each line short (max ~14 words). Characters are Indian unless the user says otherwise.
Return ONLY valid JSON, no markdown.`;

export async function writeStory({ category, minutes, idea = '', chain = [], actors = [], onLog = () => {}, onProgress = () => {} }) {
  // 1) whole story in ONE request (saves free quota: 1 request per video)
  onProgress(0, 1, 'Writing the whole story (1 request)');
  try {
    const { value, used } = await askJSON(chain, { user: buildPastePrompt({ category, minutes, idea, actors }), onLog, validate: (j) => storyFromObject(j, minutes) });
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
  o.characters = o.characters.slice(0, 5).map((c, i) => {
    let id = String(c.id || c.name || 'c' + i).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16) || 'c' + i; while (ids.has(id)) id += i; ids.add(id);
    const col = (v, d) => (HEX.test(String(v || '')) ? '#' + String(v).replace('#', '') : d);
    return { id, name: String(c.name || id), gender: c.gender === 'female' ? 'female' : 'male', age: ['child', 'young', 'adult', 'old'].includes(c.age) ? c.age : 'adult',
      role: String(c.role || ''), model: String(c.model || ''), top_color: col(c.top_color, ['#2f5d8a', '#b23a48', '#3f7d4e', '#7a4fa0', '#c98a2b'][i % 5]), bottom_color: col(c.bottom_color, '#2b2b30'), hair_color: col(c.hair_color, '#1c1612'), personality: String(c.personality || '') };
  });
  const idList = o.characters.map((c) => c.id);
  o.scenes = (o.scenes || []).filter(Boolean).map((s) => ({
    location: LOCATIONS[s.location] ? s.location : 'street', time_of_day: TIMES_OF_DAY.includes(s.time_of_day) ? s.time_of_day : 'day',
    present: (Array.isArray(s.present) ? s.present : []).map((x) => matchId(x, o.characters)).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4),
    summary: String(s.summary || ''), seconds: Math.max(12, Number(s.seconds) || 30) }));
  if (!o.scenes.length) throw new Error('Gemini returned no scenes');
  for (const s of o.scenes) if (!s.present.length) s.present = idList.slice(0, 2);
  const sum = o.scenes.reduce((a, s) => a + s.seconds, 0); for (const s of o.scenes) s.seconds = Math.round(s.seconds * totalSec / sum);
}
function matchId(x, chars) { const v = String(x || '').toLowerCase(); const c = chars.find((c) => c.id === v || c.name.toLowerCase() === v || v.includes(c.id)); return c && c.id; }
export function normalizeBeats(beats, chars, sc) {
  const out = [];
  for (const b of beats) {
    const char = matchId(b.char, chars); if (!char) continue;
    if (b.type === 'line' || b.hindi || b.hinglish) {
      const hindi = String(b.hindi || b.hinglish || '').trim(), hinglish = String(b.hinglish || b.hindi || '').trim();
      if (!hindi) continue;
      out.push({ type: 'line', char, emotion: String(b.emotion || 'neutral'), hindi, hinglish, english: String(b.english || hinglish) });
    } else if (ACTIONS.includes(b.action)) out.push({ type: 'action', char, action: b.action, target: matchId(b.target, chars) || null });
  }
  if (!sc.present.length) sc.present = [...new Set(out.map((b) => b.char))].slice(0, 4);
  // anyone who speaks must be in the scene
  for (const b of out) if (!sc.present.includes(b.char) && sc.present.length < 4 && !out.some((x) => x.type === 'action' && x.action === 'enter' && x.char === b.char)) sc.present.push(b.char);
  return out;
}

// ---------- "Paste from Gemini app" mode: one prompt → whole story JSON (works with the Gemini app subscription, no API) ----------
export function buildPastePrompt({ category, minutes, idea = '', actors = [] }) {
  const cat = CATEGORIES[category] || CATEGORIES.drama; const totalSec = Math.round(minutes * 60);
  const nScenes = Math.max(2, Math.min(18, Math.round(minutes * 1.6))); const lines = Math.max(6, Math.round(totalSec / 4.2));
  const locs = Object.entries(LOCATIONS).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  const actorList = actors.map((a) => `- ${a.id}: ${a.gender}, ${a.age}${a.tags?.length ? ', ' + a.tags.join('/') : ''}`).join('\n');
  return `${SYSTEM}

Write ${cat.hint}. Category: ${cat.label}. Total length about ${totalSec} seconds (${minutes} min): about ${nScenes} scenes and about ${lines} dialogue lines in total.
${idea ? `Idea / title: ${idea}` : 'Invent an original title and idea.'}
Use 2 to 5 characters.${actorList ? ` Each character is played by one of these 3D actors (write its id in "model"):\n${actorList}` : ''}
Every scene uses one of these locations (write the key):
${locs}
Between dialogue lines add simple actions, only these words: ${ACTIONS.join(', ')}.
("enter"/"exit"/"run_exit" = comes in / leaves; "sit"/"stand"; "walk_to" needs "target" = another character id.)

Reply with ONLY this JSON (no other text):
{"title":"Hinglish title","title_hindi":"हिंदी शीर्षक","logline":"one line","moral":"last message or empty",
 "characters":[{"id":"short_id","name":"Indian name","gender":"male|female","age":"child|young|adult|old","role":"role","top_color":"#hex","bottom_color":"#hex","hair_color":"#hex","personality":"few words","model":"actor id"}],
 "scenes":[{"location":"key","time_of_day":"${TIMES_OF_DAY.join('|')}","present":["character ids at the start"],"summary":"what happens","seconds":30,
   "beats":[{"type":"action","char":"id","action":"enter"},
            {"type":"line","char":"id","emotion":"neutral|happy|sad|angry|surprised|scared","hindi":"देवनागरी","hinglish":"Roman Hinglish","english":"English"}]}]}`;
}
export function storyFromObject(j, minutes = 1) {
  const src = JSON.parse(JSON.stringify(j)); normalizeOutline(j, Math.round(minutes * 60));
  j.scenes = j.scenes.map((sc, i) => ({ ...sc, beats: normalizeBeats(src.scenes?.[i]?.beats || [], j.characters, sc) }));
  if (!j.scenes.some((sc) => sc.beats.some((b) => b.type === 'line'))) throw new Error('The story has no dialogue lines.');
  return j;
}
export function parsePastedStory(text, minutes = 1) {
  let j; try { j = parseJSON(String(text || '')); } catch { throw new Error('Could not read the pasted text as JSON. Copy the AI\'s whole answer (the part between { and }).'); }
  return storyFromObject(j, minutes);
}
