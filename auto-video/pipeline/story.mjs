// Step 1: Gemini writes the story (outline first, then every scene's beats) as strict JSON.
// Uses Gemini's OpenAI-compatible endpoint with the key as a Bearer token.
import { CATEGORIES, LOCATIONS, ACTIONS, TIMES_OF_DAY } from './config.mjs';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

// Fallback models when the chosen one is busy (503/429) or not available (404).
const FALLBACK = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
const WAITS = [5, 10, 20, 40]; // seconds between retries on the same model
const sleep = (s) => new Promise((ok) => setTimeout(ok, s * 1000));
async function gemini(messages, { model, key, temperature = 0.9, onLog = () => {} }) {
  const models = [model, ...FALLBACK.filter((m) => m !== model)];
  let last;
  for (const [mi, m] of models.entries()) {
    for (let i = 0; i <= WAITS.length; i++) {
      try {
        const r = await fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: m, messages, temperature, response_format: { type: 'json_object' } }) });
        const txt = await r.text();
        if (!r.ok) { const e = new Error(`Gemini HTTP ${r.status}: ${txt.slice(0, 200)}`); e.status = r.status; throw e; }
        const content = JSON.parse(txt).choices?.[0]?.message?.content || '';
        return parseJSON(content);
      } catch (e) {
        last = e;
        if ([400, 401, 403].includes(e.status)) throw friendly(e);
        if (e.status === 404) break;                       // model not available → next model
        if (i < WAITS.length && !(e.status === 429 && i >= 1)) { onLog(`Gemini busy (${e.status || 'network'}) on ${m}, retrying in ${WAITS[i]}s…`); await sleep(WAITS[i]); }
        else break;
      }
    }
    if (mi < models.length - 1) onLog(`Switching to ${models[mi + 1]}…`);
  }
  throw friendly(last);
}
function friendly(e) {
  const s = e?.status;
  const msg = s === 503 ? 'Gemini is overloaded right now (503). All models were tried several times. Press Retry in a few minutes.'
    : s === 429 ? 'Gemini quota/rate limit reached for this key (429). Wait a while, or use another key.'
    : s === 401 || s === 403 || /API key/i.test(e?.message || '') ? 'Gemini rejected the API key. Check it in Settings → Test.'
    : s === 400 ? 'Gemini rejected the request (400): ' + (e.message || '').slice(0, 160)
    : 'Gemini request failed: ' + (e?.message || e);
  const out = new Error(msg); out.status = s; return out;
}
function parseJSON(s) {
  s = s.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(s); } catch { const a = s.indexOf('{'), b = s.lastIndexOf('}'); return JSON.parse(s.slice(a, b + 1)); }
}

const SYSTEM = `You are a screenwriter for short animated 3D videos for an Indian audience.
Dialogue is spoken by Hindi text-to-speech, so every line has three versions:
- "hindi": natural spoken Hindi in Devanagari script (English words written in Devanagari, e.g. "कॉफ़ी", "प्लीज़").
- "hinglish": the same line in Roman Hinglish (e.g. "Do cappuccino, please.").
- "english": an English translation.
Keep each line short (max ~14 words). Characters are Indian unless the user says otherwise.
Return ONLY valid JSON, no markdown.`;

export async function writeStory({ category, minutes, idea = '', language = 'hinglish', key, model = 'gemini-2.5-flash', actors = [], onLog = () => {} }) {
  const cat = CATEGORIES[category] || CATEGORIES.drama;
  const totalSec = Math.round(minutes * 60);
  const nScenes = Math.max(2, Math.min(18, Math.round(minutes * 1.6)));
  const locs = Object.entries(LOCATIONS).map(([k, v]) => `"${k}": ${v}`).join('\n');
  const actorList = actors.map((a) => `"${a.id}": ${a.gender}, ${a.age}${a.tags?.length ? ', ' + a.tags.join('/') : ''}`).join('\n');
  onLog(`Gemini: outline (${nScenes} scenes, ~${totalSec}s)`);
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
The scene seconds must add up to about ${totalSec}.` }], { key, model, onLog });
  normalizeOutline(outline, totalSec);
  // Step 2: beats for each scene (3 in parallel)
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
 {"type":"line","char":"id","emotion":"neutral|happy|sad|angry|surprised|scared","hindi":"देवनागरी","hinglish":"Roman Hinglish","english":"English"}]}` }], { key, model, onLog });
    const scene = { ...sc, beats: normalizeBeats(res.beats || [], outline.characters, sc) };
    out.scenes[i] = scene;
  });
  await runPool(jobs, 3);
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
