// Step 1: Gemini writes the story (outline first, then every scene's beats) as strict JSON.
// Uses Gemini's OpenAI-compatible endpoint with the key as a Bearer token.
import { CATEGORIES, LOCATIONS, ACTIONS, TIMES_OF_DAY } from './config.mjs';

// Google's native Gemini REST API (key in the x-goog-api-key header).
const API = 'https://generativelanguage.googleapis.com/v1beta';
const SKIP = /(tts|image|audio|live|embedding|vision|aqa|native|computer|robotics|veo|imagen|learnlm|gemma|nano|banana|thinking-exp)/i;
let modelCache = null;
export async function listModels(key) {
  if (modelCache && modelCache.key === key && Date.now() - modelCache.at < 10 * 60e3) return modelCache.ids;
  const ids = []; let page = '';
  for (let k = 0; k < 5; k++) {
    const r = await fetch(`${API}/models?pageSize=200${page ? '&pageToken=' + page : ''}`, { headers: { 'x-goog-api-key': key } });
    const txt = await r.text(); if (!r.ok) throw apiError(r.status, txt);
    const j = JSON.parse(txt); for (const m of j.models || []) if ((m.supportedGenerationMethods || []).includes('generateContent')) ids.push(String(m.name).replace(/^models\//, ''));
    if (!j.nextPageToken) break; page = j.nextPageToken;
  }
  modelCache = { key, at: Date.now(), ids }; return ids;
}
const ver = (id) => { const m = id.match(/gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
export function pickModels(ids, preferred) {
  const ok = ids.filter((id) => /^gemini-/.test(id) && !SKIP.test(id));
  const score = (id) => ver(id) * 10 + (/flash-lite/.test(id) ? 2 : /flash/.test(id) ? 3 : /pro/.test(id) ? 1 : 0) - (/preview|exp/.test(id) ? 0.5 : 0) - (/-\d{3}$|-\d{2}-\d{4}/.test(id) ? 0.2 : 0);
  const list = []; if (preferred && (ids.includes(preferred) || !ids.length)) list.push(preferred);
  for (const id of ok.sort((a, b) => score(b) - score(a))) if (!list.includes(id) && list.length < 5) list.push(id);
  return list.length ? list : [preferred || 'gemini-2.5-flash'];
}
function apiError(status, txt) {
  let msg = txt, delay = 0; try { const j = JSON.parse(txt).error || {}; msg = j.message || txt; const ri = (j.details || []).find((d) => /RetryInfo/.test(d['@type'] || '')); if (ri) delay = parseFloat(ri.retryDelay) || 0; } catch {}
  const e = new Error(`HTTP ${status}: ${String(msg).slice(0, 240)}`); e.status = status; e.retryDelay = delay; return e;
}
// one call: system + user text → parsed JSON
export async function generate({ key, model, system, user, temperature = 0.9, json = true }) {
  const body = { contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) } };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const r = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
  const txt = await r.text(); if (!r.ok) throw apiError(r.status, txt);
  const j = JSON.parse(txt); const c = j.candidates?.[0];
  const text = (c?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  if (!text) { const e = new Error(`empty reply (${c?.finishReason || j.promptFeedback?.blockReason || 'no candidates'})`); e.status = 'empty'; throw e; }
  return json ? parseJSON(text) : text;
}

const WAITS = (process.env.AV_GEMINI_WAITS || '5,10,20,40').split(',').map(Number); // seconds between retries on the same model
const sleep = (s) => new Promise((ok) => setTimeout(ok, s * 1000));
const short = (e) => (e.status === 503 ? 'busy (503)' : e.status === 429 ? 'rate limit (429)' : e.status === 404 ? 'not available (404)' : e.status === 400 ? 'rejected (400)' : e.status === 500 ? 'server error (500)' : e.status === 'empty' ? e.message : e.status ? `HTTP ${e.status}` : /JSON/i.test(e.message) ? 'bad JSON reply' : 'network error');
async function gemini(messages, { models, key, temperature = 0.9, onLog = () => {} }) {
  const system = messages.find((m) => m.role === 'system')?.content, user = messages.filter((m) => m.role !== 'system').map((m) => m.content).join('\n\n');
  const tried = [];
  for (const [mi, m] of [...models].entries()) {
    let fails = 0, lastErr = null, jsonMode = true;
    for (let i = 0; i <= WAITS.length; i++) {
      try {
        const out = await generate({ key, model: m, system, user, temperature, json: jsonMode });
        const val = typeof out === 'string' ? parseJSON(out) : out;
        if (mi > 0) { models.splice(models.indexOf(m), 1); models.unshift(m); onLog(`Using ${m} for the rest of this story`); }
        return val;
      } catch (e) {
        lastErr = e; fails++;
        if (e.status === 401 || e.status === 403 || (e.status === 400 && /API key/i.test(e.message))) throw friendly(e);
        if (e.status === 429 && /quota|billing/i.test(e.message) && !/per minute|perminute/i.test(e.message)) { e.quota = true; break; } // daily quota / billing: retrying only burns time
        if (e.status === 400 && jsonMode && /mime|json/i.test(e.message)) { jsonMode = false; i--; continue; }
        if (e.status === 404 || e.status === 400) break;
        if (i < WAITS.length) { const w = Math.min(60, Math.max(WAITS[i], e.retryDelay || 0)); onLog(`Gemini ${m}: ${short(e)}, retrying in ${Math.round(w)}s (${i + 1}/${WAITS.length})…`); await sleep(w); }
      }
    }
    tried.push(`${m}: ${short(lastErr)}${fails > 1 ? ` ×${fails}` : ''} — ${String(lastErr?.message || '').replace(/^HTTP \d+: /, '').slice(0, 120)}`);
    if (mi < models.length - 1) onLog(`Gemini ${m} failed (${short(lastErr)}), switching to ${models[mi + 1]}…`);
  }
  if (tried.length && tried.every((t) => /quota|billing/i.test(t))) { const q = new Error('Your Gemini API key has no quota left (429: quota exceeded on every model). The free quota resets daily (about 1:30 PM India time), or enable billing for this key in Google AI Studio. Right now use New Video → Story source → "Paste from Gemini app".'); q.retryable = false; q.quota = true; throw q; }
  const busy = tried.every((t) => /busy|rate limit|network|server error|HTTP 5/.test(t));
  const err = new Error((busy ? 'Gemini is busy right now. ' : 'Gemini could not write the story. ') + 'Tried: ' + tried.join(' · '));
  err.retryable = busy; throw err;
}
function friendly(e) {
  const s = e?.status;
  const msg = s === 401 || s === 403 || /API key/i.test(e?.message || '') ? 'Gemini rejected the API key. Check it in Settings → Test.' : 'Gemini request failed: ' + (e?.message || e);
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

export async function writeStory({ category, minutes, idea = '', language = 'hinglish', key, model = 'gemini-2.5-flash', actors = [], onLog = () => {}, onProgress = () => {} }) {
  let ids = []; try { ids = await listModels(key); } catch (e) { if (/API key/.test(e.message)) throw e; }
  const models = pickModels(ids, model); onLog(`Gemini models: ${models.join(', ')}`);
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
export function parsePastedStory(text, minutes = 1) {
  let j; try { j = parseJSON(String(text || '')); } catch { throw new Error('Could not read the pasted text as JSON. Copy Gemini\'s whole answer (the part between { and }).'); }
  normalizeOutline(j, Math.round(minutes * 60));
  const raw = (JSON.parse(JSON.stringify(j))); // normalizeOutline rebuilt scenes; take beats from the original order
  const srcScenes = (parseJSON(String(text)).scenes || []);
  j.scenes = j.scenes.map((sc, i) => ({ ...sc, beats: normalizeBeats(srcScenes[i]?.beats || [], j.characters, sc) }));
  if (!j.scenes.some((sc) => sc.beats.some((b) => b.type === 'line'))) throw new Error('The pasted story has no dialogue lines.');
  void raw; return j;
}
