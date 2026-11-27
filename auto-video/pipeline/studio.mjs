// Prompt Studio — "Animation Story Engine": genre + duration + style → Story Bible → Scenes → Shots with image / video prompts,
// dialogue, SFX and music, for AI video tools (Flow, Veo, Kling…). Phases are generated in batches; projects are saved and resumed.
// The AI writes {{C01}} / {{L01}} / {{P01}} / {{STYLE}} / {{NEG}} placeholders; the app fills in the Story Bible wording,
// so every prompt carries exactly the same character / location description.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STATE } from './paths.mjs';
import { askJSON } from './ai.mjs';

const LIB_SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'studio');
export const STUDIO = path.join(STATE, 'studio'); const LIB = path.join(STUDIO, 'library'), PROJ = path.join(STUDIO, 'projects'), USED = path.join(STUDIO, 'used_stories.json');
const FILES = ['00_MASTER_PROMPT.txt', '01_GENRE_LIBRARY.json', '02_LOCATION_PROP_LIBRARY.json', '03_STORY_STRUCTURE.txt', '04_OUTPUT_SCHEMA.json', '05_EXAMPLE_OUTPUT_1min_Horror.json'];
for (const d of [STUDIO, LIB, PROJ]) fs.mkdirSync(d, { recursive: true });
for (const f of FILES) if (!fs.existsSync(path.join(LIB, f))) fs.copyFileSync(path.join(LIB_SRC, f), path.join(LIB, f)); // editable copies (Settings → open folder)
export const libraryFolder = () => LIB;

function lib() {
  const read = (f) => { try { return fs.readFileSync(path.join(LIB, f), 'utf8'); } catch { return fs.readFileSync(path.join(LIB_SRC, f), 'utf8'); } };
  const json = (f) => { try { return JSON.parse(read(f)); } catch { return JSON.parse(fs.readFileSync(path.join(LIB_SRC, f), 'utf8')); } };
  return { master: read(FILES[0]), genres: json(FILES[1]), places: json(FILES[2]), structure: read(FILES[3]), schema: read(FILES[4]), example: read(FILES[5]) };
}

export const STYLES = { '2D_Anime': '2D Anime', '2D_Cartoon': '2D Cartoon', '2D_Storybook': '2D Storybook', '3D_Stylized': '3D Stylized', '3D_Realistic': '3D Realistic' };
export const LANGS = ['Hindi', 'Hindi (Devanagari)', 'Hinglish', 'English', 'Gujarati', 'Marathi', 'Bengali', 'Tamil', 'Telugu', 'Punjabi'];
export const AUDIENCES = ['Family 13+', 'Kids', 'Teens', 'Adults'];
export const DURATIONS = [1, 3, 5, 10, 20, 30, 60, 90, 120];
export function options() { const L = lib(); return { genres: Object.keys(L.genres.genres), styles: STYLES, langs: LANGS, audiences: AUDIENCES, durations: DURATIONS }; }

// duration → plan (03_STORY_STRUCTURE table)
const TABLE = [[1, 1, 4, 9, 2, 2], [3, 3, 7, 27, 3, 3], [5, 3, 10, 45, 4, 4], [10, 3, 18, 90, 5, 5], [20, 4, 30, 180, 6, 7], [30, 4, 42, 270, 7, 8], [60, 5, 80, 550, 8, 11], [90, 6, 115, 825, 10, 13], [120, 7, 150, 1100, 12, 16]];
export function planFor(min) { const m = Math.max(1, Math.min(120, Number(min) || 1)); let i = TABLE.findIndex((r) => r[0] >= m); if (i < 0) i = TABLE.length - 1;
  const [d, acts, scenes, shots, chars, locs] = TABLE[i]; const k = m / d; return { duration_min: m, acts, total_scenes: Math.max(3, Math.round(scenes * Math.min(1, Math.max(0.6, k)))), total_shots_estimate: Math.max(8, Math.round(shots * k)), max_characters: chars, max_locations: locs, chapters: m >= 60 }; }

const pick = (a, r) => a[Math.floor(r() * a.length)];
const ERAS = ['Modern', '90s', '1970s', 'Colonial era', 'Ancient', 'Future'], REGIONS = ['Village', 'Small town', 'Metro city', 'Hill station', 'Desert', 'Coastal', 'Forest', 'Abroad'];
function seedFor(gs, used, L) { // a fresh variety seed that is not in the used log
  const r = Math.random; const g1 = L.genres.genres[gs[0]] || {}, g2 = L.genres.genres[gs[1]] || g1;
  for (let i = 0; i < 30; i++) { const s = { era: gs.includes('historical') || gs.includes('mythology') ? pick(['Ancient', 'Colonial era'], r) : gs.includes('sci_fi') ? pick(['Future', 'Modern'], r) : pick(ERAS.slice(0, 4), r), region: pick(REGIONS, r), protagonist_type: pick(g1.character_archetypes || ['ordinary person'], r), core_conflict: pick(g2.conflict_seeds || g1.conflict_seeds || ['a secret'], r), twist_type: pick(g2.twist_types || g1.twist_types || ['unexpected help'], r) };
    if (!used.some((u) => u.seed && u.seed.protagonist_type === s.protagonist_type && u.seed.core_conflict === s.core_conflict && u.seed.twist_type === s.twist_type)) return s; }
  return { era: 'Modern', region: pick(REGIONS, r), protagonist_type: pick(g1.character_archetypes || ['ordinary person'], r), core_conflict: pick(g2.conflict_seeds || ['a secret'], r), twist_type: pick(g2.twist_types || ['unexpected help'], r) };
}
const usedLog = () => { try { return JSON.parse(fs.readFileSync(USED, 'utf8')); } catch { return []; } };

// ---------- prompts ----------
const PLACEHOLDER_RULES = `PLACEHOLDERS (very important, saves space and keeps every prompt consistent):
- In every image_prompt write {{STYLE}} for the style preset, {{C01}} / {{C02}}… for a character's FULL consistency_tag, {{L01}}… for a location's FULL location_tag, {{P01}}… for a key prop's description, and {{ASPECT}} for the aspect ratio. Example: "{{STYLE}}, wide shot, eye level, {{C01}}, pulling a cloth off {{P01}}, {{L01}}, dusk light through a small window, desaturated blue-green palette, curious uneasy mood, {{ASPECT}}".
- negative_prompt is always "{{NEG}}". The app replaces every placeholder with the exact Story Bible text. Never write the long descriptions yourself inside shots.
- Keep the fixed order: {{STYLE}} + shot type & camera angle + characters + action/pose + {{Lxx}} + props + lighting + color palette + mood + {{ASPECT}}.`;
function system(L, p, withExample = false) {
  const gs = [p.genre_primary, p.genre_secondary].filter(Boolean); const G = Object.fromEntries(gs.map((g) => [g, L.genres.genres[g]]).filter(([, v]) => v));
  const locIds = [...new Set(gs.flatMap((g) => G[g]?.common_locations || []))]; const P = L.places;
  const locs = Object.fromEntries(Object.entries(P.locations).filter(([k]) => locIds.includes(k)));
  return `${L.master}

GENRE LIBRARY (only the chosen genres):
${JSON.stringify({ style_presets: L.genres.style_presets, genres: G, genre_mix_rules: L.genres.genre_mix_rules })}

LOCATION & PROP LIBRARY (genre locations in full; other ids also allowed: ${Object.keys(P.locations).join(', ')}):
${JSON.stringify({ _info: P._info, locations: locs, room_props: P.room_props, variation_engine: P.variation_engine })}

STORY STRUCTURE:
${L.structure}

OUTPUT SCHEMA:
${L.schema}

${PLACEHOLDER_RULES}
${withExample ? `\nEXAMPLE OUTPUT (format reference only — never copy its story; it shows the long texts written out, YOU use placeholders):\n${L.example}\n` : ''}
LANGUAGE: dialogue, voiceover, titles in "${p.language}"${/^Hindi$/.test(p.language) ? ' (Roman script Hindi like the example, e.g. "Yeh to kaafi purana hai...")' : /Devanagari/.test(p.language) ? ' (Devanagari script)' : ''}; image_prompt / video_prompt / consistency_tag / location_tag ALWAYS in English. Narration speed ~2.2–2.5 words per second (Kids 1.8), so an 8 sec shot has at most ~18–20 words. Silence: dialogue [] and voiceover null.
SAFETY: YouTube-safe, no gore, no explicit content, no real people / brands / copyrighted characters. Audience: ${p.audience}.
Reply with ONE JSON object only, no markdown.`;
}
const compactBible = (P) => ({ project: P.project, story_bible: { ...P.story_bible, characters: P.story_bible.characters.map((c) => ({ char_id: c.char_id, name: c.name, role: c.role, age: c.age, gender: c.gender, personality: c.personality, voice: c.voice, outfit_changes: c.outfit_changes })), locations: P.story_bible.locations.map((l) => ({ loc_id: l.loc_id, library_ref: l.library_ref, time_of_day_used: l.time_of_day_used, weather: l.weather })), props_master: P.story_bible.props_master.map((x) => ({ prop_id: x.prop_id, name: x.name, owner_char: x.owner_char })) } });
const SHOT_FIELDS = 'shot_id ("S03-02" = scene 3 shot 2), duration_sec (6–8, dialogue 8–10), shot_type (EWS/WS/MS/MCU/CU/ECU/OTS/POV/INSERT/AERIAL), camera_angle, camera_movement, characters [ids], action (short Hindi/English), image_prompt (with placeholders), video_prompt (only camera move + character action + environment motion, 6–8 s), dialogue [{char_id, line, emotion, delivery}], voiceover (string or null), sfx [..], music, transition_out, negative_prompt "{{NEG}}", continuity_note';

// ---------- projects ----------
const pfile = (id) => path.join(PROJ, id, 'project.json');
export function list() { return fs.readdirSync(PROJ).map((id) => { try { const P = JSON.parse(fs.readFileSync(pfile(id), 'utf8')); return { id, title: P.project?.title, genre: [P.project?.genre_primary, P.project?.genre_secondary].filter(Boolean).join(' + '), duration: P.project?.duration_min, status: status(P), updated: P.updated }; } catch { return null; } }).filter(Boolean).sort((a, b) => (b.updated || '').localeCompare(a.updated || '')); }
export const get = (id) => view(JSON.parse(fs.readFileSync(pfile(id), 'utf8')));
function save(P) { P.updated = new Date().toISOString(); fs.mkdirSync(path.join(PROJ, P.id), { recursive: true }); fs.writeFileSync(pfile(P.id), JSON.stringify(P, null, 2)); writeExports(P); return view(P); }
export function remove(id) { if (!/^[A-Z0-9-]+$/.test(id)) throw new Error('bad id'); fs.rmSync(path.join(PROJ, id), { recursive: true, force: true }); }
export const folderOf = (id) => path.join(PROJ, id);
function status(P) { const sc = P.scenes || []; const done = sc.filter((s) => s.shots?.length).length; const total = P.story_bible?.plan?.total_scenes || sc.length;
  return { phase: !P.story_bible ? 0 : !sc.length ? 1 : done < sc.length ? 2 : 3, scenes: sc.length, scenesTotal: total, shotsDone: sc.reduce((a, s) => a + (s.shots?.length || 0), 0), scenesWithShots: done, nextBatch: nextBatch(P) }; }
function nextBatch(P) { const sc = P.scenes || []; const i = sc.findIndex((s) => !s.shots?.length); if (i < 0) return null; let shots = 0, j = i;
  while (j < sc.length && j - i < 10 && !sc[j].shots?.length) { const est = sc[j].shot_count || 5; if (j > i && shots + est > 45) break; shots += est; j++; } return { from: sc[i].scene_no, to: sc[j - 1].scene_no }; }

// ---------- placeholders → full text ----------
function expand(P, s, sceneNo) { if (typeof s !== 'string') return s; const B = P.story_bible; const map = { STYLE: B.visual_style_guide?.style_prompt || '', NEG: B.visual_style_guide?.negative_prompt || '', ASPECT: P.project.aspect_ratio };
  for (const c of B.characters) { let tag = c.consistency_tag; const oc = (c.outfit_changes || []).filter((o) => o.from_scene <= (sceneNo || 0) && o.outfit && !/^same\b/i.test(o.outfit)).pop(); if (oc) tag = `${tag} (now wearing ${oc.outfit})`; map[c.char_id] = tag; }
  for (const l of B.locations) map[l.loc_id] = l.location_tag; for (const x of B.props_master || []) map[x.prop_id] = x.description;
  return s.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (m, k) => map[k] ?? map[k.toUpperCase()] ?? m); }
function view(P) { // full prompts filled in + times
  const V = JSON.parse(JSON.stringify(P)); let t = 0;
  for (const sc of V.scenes || []) { const st = t; for (const sh of sc.shots || []) { sh.start = t; t += Number(sh.duration_sec) || 7; for (const f of ['image_prompt', 'video_prompt', 'negative_prompt']) sh[f] = expand(P, sh[f], sc.scene_no); } if (sc.shots?.length) { sc.start_time = mmss(st); sc.end_time = mmss(t); } }
  if (V.extras?.thumbnail_prompts) V.extras.thumbnail_prompts = V.extras.thumbnail_prompts.map((x) => expand(P, x));
  V.status = status(P); V.total_sec = t; return V; }
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;

// ---------- generation ----------
const check = (fn) => (x) => { fn(x); return x; };
async function ask(chain, P, user, onLog, validate, withExample = false) { return (await askJSON(chain, { system: system(lib(), P.project, withExample), user, temperature: 0.95, onLog, validate })).value; }

export async function create(input, chain, onLog = () => {}) {
  const L = lib(); const used = usedLog(); const gs = [input.genre, input.genre2].filter((g, i) => g && (i === 0 || g !== input.genre));
  const plan = planFor(input.duration); const seed = seedFor(gs, used, L); const style = STYLES[input.style] ? input.style : '3D_Stylized';
  const n = String(fs.readdirSync(PROJ).filter((d) => d.startsWith(gs[0].slice(0, 3).toUpperCase())).length + 1).padStart(2, '0');
  const id = `${gs[0].slice(0, 3).toUpperCase()}-${new Date().toISOString().slice(0, 10)}-${n}`;
  const project = { project_id: id, title: '', genre_primary: gs[0], genre_secondary: gs[1] || null, duration_min: plan.duration_min, style_preset: style, aspect_ratio: input.aspect === '9:16' ? '9:16' : '16:9', language: input.language || 'Hindi', audience: input.audience || 'Family 13+', variety_seed: seed };
  const P = { id, input, project, plan, tone: [], batches: [], checkpoints: [] };
  const all = plan.duration_min <= 3;
  onLog(all ? 'Writing the full story (bible, scenes and shots)…' : 'Phase 1: writing the Story Bible…');
  const user = `USER INPUT:
GENRE: ${gs.join(' + ')} | DURATION: ${plan.duration_min} min | STYLE: ${style} | LANGUAGE: ${project.language} | ASPECT: ${project.aspect_ratio} | AUDIENCE: ${project.audience}
TOPIC: ${input.topic?.trim() || '(empty — choose your own)'}
VARIETY SEED (use it; you may adjust the region/era if the topic needs): ${JSON.stringify(seed)}
PLAN: about ${plan.acts} acts, ${plan.total_scenes} scenes, ${plan.total_shots_estimate} shots, up to ${plan.max_characters} main characters, ${plan.max_locations} locations${plan.chapters ? ', split into chapters of 10–15 min with their own mini-climax' : ''}.
USED STORIES LOG (do NOT make anything similar): ${used.slice(-40).map((u) => `${u.title} — ${u.logline}`).join(' | ') || 'none'}

${all ? `Do ALL THREE PHASES now. Return {"project": {...with title "Hindi / English"...}, "story_bible": {...}, "scenes": [ every scene WITH "shots" (fields: ${SHOT_FIELDS}) ], "extras": {youtube_titles (5), thumbnail_prompts (3, with placeholders), description, tags, chapters}}.`
  : `Do PHASE 1 only. Return {"project": {...with title "Hindi / English" and variety_seed...}, "story_bible": {logline, synopsis, theme, characters (consistency_tag FULL and detailed), locations (location_tag FULL), props_master, visual_style_guide (style_prompt copied from style_presets["${style}"], color_palette, lighting_rule, negative_prompt), act_outline (with time_range and scenes ranges), plan {total_scenes, total_shots_estimate, batches}}, "extras": {youtube_titles (5), thumbnail_prompts (3, with placeholders), description, tags}}.`}`;
  const r = await ask(chain, P, user, onLog, check((x) => { if (!x.story_bible?.characters?.length || !x.story_bible?.locations?.length) throw new Error('story bible incomplete'); if (all && !x.scenes?.some((s) => s.shots?.length)) throw new Error('no shots'); }), all);
  P.project = { ...project, ...r.project, project_id: id, duration_min: plan.duration_min, style_preset: style, aspect_ratio: project.aspect_ratio, language: project.language, audience: project.audience };
  P.story_bible = r.story_bible; P.story_bible.visual_style_guide ||= {}; P.story_bible.visual_style_guide.style_prompt ||= L.genres.style_presets[style]; P.story_bible.visual_style_guide.negative_prompt ||= 'text, watermark, logo, extra fingers, deformed face, blurry, low quality, gore';
  P.story_bible.props_master ||= []; P.extras = r.extras || {};
  if (all) { P.scenes = (r.scenes || []).map((s, i) => ({ ...s, scene_no: i + 1 })); P.batches.push({ from: 1, to: P.scenes.length, at: new Date().toISOString() }); }
  fs.writeFileSync(USED, JSON.stringify([...used, { id, title: P.project.title, logline: P.story_bible.logline, genre: gs.join('+'), seed: P.project.variety_seed || seed, at: new Date().toISOString() }].slice(-300), null, 1));
  return save(P);
}

export async function scenes(id, chain, onLog = () => {}) { // Phase 2 (in chunks of 40 scenes)
  const P = JSON.parse(fs.readFileSync(pfile(id), 'utf8')); const total = P.story_bible.plan?.total_scenes || P.plan.total_scenes; P.scenes ||= [];
  while (P.scenes.length < total) { const a = P.scenes.length + 1, b = Math.min(total, a + 39); onLog(`Phase 2: scene breakdown ${a}–${b} of ${total}…`);
    const user = `STORY (Phase 1 done): ${JSON.stringify(compactBible(P))}
${P.scenes.length ? `SCENES ALREADY PLANNED (continue after them): ${JSON.stringify(P.scenes.map((s) => ({ scene_no: s.scene_no, act: s.act, title: s.title, loc_id: s.loc_id, summary: s.summary })))}` : ''}
${P.tone.length ? `TONE NOTES: ${P.tone.join('; ')}` : ''}
Do PHASE 2 for scenes ${a} to ${b} (of ${total}; whole video ${P.project.duration_min} min). Return {"scenes": [{scene_no, act, title, loc_id, sub_area, time_of_day, weather, characters_present, props_in_scene, mood, goal_of_scene, summary (2–3 lines), start_time, end_time, music_cue, shot_count (3–8)}]} WITHOUT shots. Follow the act outline and the act time split; every scene changes something.`;
    const r = await ask(chain, P, user, onLog, check((x) => { if (!x.scenes?.length) throw new Error('no scenes'); }));
    for (const s of r.scenes) { if (P.scenes.length >= total) break; P.scenes.push({ ...s, scene_no: P.scenes.length + 1 }); } save(P); }
  return save(P);
}

async function shotsFor(P, from, to, chain, onLog, extra = '') {
  const sel = P.scenes.filter((s) => s.scene_no >= from && s.scene_no <= to); const before = P.scenes.filter((s) => s.scene_no < from);
  const lastShots = before.flatMap((s) => (s.shots || []).map((x) => ({ scene: s.scene_no, action: x.action, continuity_note: x.continuity_note }))).slice(-12);
  const user = `STORY BIBLE: ${JSON.stringify(compactBible(P))}
${before.length ? `STORY SO FAR (scene summaries): ${JSON.stringify(before.map((s) => `${s.scene_no}. ${s.title}: ${s.summary}`))}\nLAST SHOTS: ${JSON.stringify(lastShots)}\nLAST CONTINUITY CHECKPOINT: ${JSON.stringify(P.checkpoints.at(-1) || null)}` : 'This is the first batch.'}
${P.tone.length ? `TONE NOTES (apply): ${P.tone.join('; ')}` : ''}${extra ? `\n${extra}` : ''}
Do PHASE 3 for scenes ${from}–${to}: ${JSON.stringify(sel.map(({ shots, ...s }) => s))}
Return {"continuity_checkpoint": {after_scene: ${from - 1}, characters_state [{char_id, location, outfit, holding, condition}], open_mysteries, time_in_story}, "scenes": [{scene_no, shots: [${SHOT_FIELDS}]}]}. Each scene starts with an establishing (wide) shot; one main action per shot; about shot_count shots per scene.`;
  return ask(chain, P, user, onLog, check((x) => { if (!x.scenes?.length || !x.scenes.every((s) => s.shots?.length)) throw new Error('shots missing'); }));
}
export async function next(id, chain, onLog = () => {}) { // Phase 3 batch (NEXT)
  let P = JSON.parse(fs.readFileSync(pfile(id), 'utf8')); if (!P.scenes?.length) { await scenes(id, chain, onLog); P = JSON.parse(fs.readFileSync(pfile(id), 'utf8')); }
  const nb = nextBatch(P); if (!nb) return view(P); onLog(`Phase 3: shots for scenes ${nb.from}–${nb.to}…`);
  let r; try { r = await shotsFor(P, nb.from, nb.to, chain, onLog); }
  catch (e) { if (!e.cut || nb.to === nb.from) throw e; const mid = Math.floor((nb.from + nb.to) / 2); onLog(`Reply too long — doing scenes ${nb.from}–${mid} first…`); r = await shotsFor(P, nb.from, mid, chain, onLog); }
  for (const s of r.scenes) { const t = P.scenes.find((x) => x.scene_no === Number(s.scene_no)); if (t) t.shots = s.shots.map((sh, i) => ({ ...sh, shot_id: `S${String(t.scene_no).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}` })); }
  if (r.continuity_checkpoint) P.checkpoints.push(r.continuity_checkpoint);
  const done = r.scenes.map((s) => Number(s.scene_no)); P.batches.push({ from: Math.min(...done), to: Math.max(...done), at: new Date().toISOString() });
  return save(P);
}
export async function redo(id, sceneNo, note, chain, onLog = () => {}) { // REDO SCENE n
  const P = JSON.parse(fs.readFileSync(pfile(id), 'utf8')); const s = P.scenes?.find((x) => x.scene_no === Number(sceneNo)); if (!s) throw new Error('No scene ' + sceneNo);
  onLog(`Rewriting scene ${sceneNo}…`); const old = s.shots; delete s.shots;
  try { const r = await shotsFor(P, s.scene_no, s.scene_no, chain, onLog, `REDO: write scene ${sceneNo} again in a clearly DIFFERENT way (new staging, angles, actions${note ? '; user note: ' + note : ''}). Keep the story facts and continuity.`);
    const ns = r.scenes.find((x) => Number(x.scene_no) === s.scene_no) || r.scenes[0]; s.shots = ns.shots.map((sh, i) => ({ ...sh, shot_id: `S${String(s.scene_no).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}` })); }
  catch (e) { s.shots = old; throw e; }
  return save(P);
}
export function tone(id, t) { const P = JSON.parse(fs.readFileSync(pfile(id), 'utf8')); const T = { scary: 'MORE SCARY: longer silences, stronger scares, darker lighting', emotional: 'MORE EMOTIONAL: more close-ups on faces, softer music, heartfelt lines', fast: 'FASTER PACE: shorter shots (5–6 s), quicker cuts, less talk' }[t] || String(t).slice(0, 200);
  P.tone = [...P.tone.filter((x) => x !== T), T]; return save(P); }
export async function thumbnails(id, chain, onLog = () => {}) {
  const P = JSON.parse(fs.readFileSync(pfile(id), 'utf8')); onLog('Writing thumbnail prompts and titles…');
  const r = await ask(chain, P, `STORY BIBLE: ${JSON.stringify(compactBible(P))}\nTHUMBNAIL command: return {"thumbnail_prompts": [3 strong click-worthy thumbnail image prompts with placeholders, high contrast, ${P.project.aspect_ratio}], "youtube_titles": [5 new title ideas in ${P.project.language}], "description": "YouTube description", "tags": [15 tags]}`, onLog, check((x) => { if (!x.thumbnail_prompts?.length) throw new Error('no thumbnails'); }));
  P.extras = { ...(P.extras || {}), ...r }; return save(P);
}

// ---------- exports (no AI) ----------
export function exportsOf(V) {
  const B = V.story_bible; const out = {}; const pr = [], vo = [], cs = [];
  pr.push(`${V.project.title}  (${V.project.project_id})\nStyle: ${V.project.style_preset} · ${V.project.aspect_ratio} · ${V.project.duration_min} min\nNEGATIVE PROMPT (all shots): ${B?.visual_style_guide?.negative_prompt || ''}\n`);
  for (const sc of V.scenes || []) { if (!sc.shots?.length) continue; pr.push(`\n=== Scene ${sc.scene_no}: ${sc.title} (${sc.start_time}–${sc.end_time}) ===`); vo.push(`\n=== Scene ${sc.scene_no}: ${sc.title} ===`);
    for (const sh of sc.shots) { pr.push(`\n[${sh.shot_id}] ${sh.duration_sec}s · ${sh.shot_type} · ${sh.camera_movement}\nIMAGE: ${sh.image_prompt}\nVIDEO: ${sh.video_prompt}`);
      const name = (id) => B.characters.find((c) => c.char_id === id)?.name || id; const tc = `[${mmss(sh.start)}–${mmss(sh.start + (Number(sh.duration_sec) || 7))}] ${sh.shot_id}`;
      const lines = (sh.dialogue || []).map((d) => `${name(d.char_id)} (${[d.emotion, d.delivery].filter(Boolean).join(', ')}): ${d.line}`);
      if (sh.voiceover) lines.push(`NARRATOR: ${sh.voiceover}`); vo.push(`${tc}  ${lines.length ? lines.join('\n                     ') : '[silence — only ambience]'}${sh.sfx?.length ? `\n                     SFX: ${sh.sfx.join(', ')}` : ''}${sh.music ? ` · MUSIC: ${sh.music}` : ''}`); } }
  const style = B?.visual_style_guide?.style_prompt || '';
  for (const c of B?.characters || []) cs.push(`${c.char_id} ${c.name} (${c.role})\nREFERENCE SHEET: ${style}, character reference sheet, full body front view, side view and back view, neutral standing pose, plain light grey background, even studio lighting, ${c.consistency_tag}, ${V.project.aspect_ratio}\nEXPRESSIONS: ${style}, expression sheet with 6 head close-ups (happy, sad, angry, scared, surprised, thinking), plain light grey background, ${c.consistency_tag}\n`);
  for (const l of B?.locations || []) cs.push(`${l.loc_id} LOCATION REFERENCE: ${style}, establishing wide shot, empty scene, no people, ${l.location_tag}, ${(l.time_of_day_used || [])[0] || 'day'}, ${l.weather || 'clear'}, ${V.project.aspect_ratio}\n`);
  const ch = []; for (const a of B?.act_outline || []) { const s = (V.scenes || []).find((x) => String(a.scenes || '').split(/[-–]/)[0] == x.scene_no); ch.push(`${s?.start_time || (a.time_range || '').split('-')[0] || '00:00'} ${a.name}`); }
  out.prompts = pr.join('\n'); out.voiceover = vo.join('\n'); out.characters = cs.join('\n'); out.chapters = ch.join('\n');
  out.thumbnails = [...(V.extras?.thumbnail_prompts || []).map((x, i) => `THUMBNAIL ${i + 1}: ${x}`), '', 'TITLES:', ...(V.extras?.youtube_titles || []).map((x) => '- ' + x), '', 'DESCRIPTION:', V.extras?.description || '', '', 'TAGS: ' + (V.extras?.tags || []).join(', ')].join('\n');
  return out;
}
function writeExports(P) { const V = view(P); const d = path.join(PROJ, P.id); const E = exportsOf(V);
  const W = (f, s) => fs.writeFileSync(path.join(d, f), s); W('full_with_prompts.json', JSON.stringify({ project: V.project, story_bible: V.story_bible, scenes: V.scenes, continuity_checkpoints: P.checkpoints, extras: V.extras }, null, 2));
  W('ONLY_PROMPTS.txt', E.prompts); W('VOICEOVER_SCRIPT.txt', E.voiceover); W('CHARACTER_SHEET.txt', E.characters); W('THUMBNAILS_TITLES.txt', E.thumbnails); }

// ---------- Prompt Studio story → this app's video maker ("My full story" mode) ----------
const CAT = { horror: 'horror', crime: 'crime', thriller: 'thriller', drama: 'drama', mystery: 'mystery', comedy: 'comedy', romance: 'romance', kids_moral: 'kids', action: 'thriller', sci_fi: 'mystery', fantasy: 'kids', mythology: 'drama', historical: 'drama', adventure: 'motivational' };
export function videoJob(id) { // the story written out like a screenplay: the video maker keeps the events and every dialogue line
  const V = get(id); const B = V.story_bible; const name = (cid) => B.characters.find((c) => c.char_id === cid)?.name || cid;
  const locOf = (lid) => { const l = B.locations.find((x) => x.loc_id === lid); return l ? `${String(l.library_ref || '').replace(/_/g, ' ')}${l.weather && l.weather !== 'clear' ? ', ' + l.weather : ''}` : lid; };
  const out = [`${V.project.title}`, '', `${B.synopsis || ''}`, '', 'Characters:', ...B.characters.map((c) => `- ${c.name}: ${c.gender}, ${c.age}, ${c.role}${c.personality?.length ? ', ' + c.personality.join(', ') : ''}`), ''];
  for (const sc of V.scenes || []) {
    { const lo = locOf(sc.loc_id); out.push(`Scene ${sc.scene_no} — ${sc.title} (${lo}${sc.sub_area && !lo.includes(sc.sub_area) ? ', ' + sc.sub_area : ''}, ${sc.time_of_day || 'day'})`); }
    if (!sc.shots?.length) { out.push(sc.summary || '', ''); continue; }
    for (const sh of sc.shots) { if (sh.action) out.push(`[${sh.action}]`); for (const d of sh.dialogue || []) out.push(`${name(d.char_id)}${d.emotion ? ' (' + d.emotion + ')' : ''}: "${d.line}"`); if (sh.voiceover) out.push(`Narrator: ${sh.voiceover}`); }
    out.push('');
  }
  const g = V.project.genre_primary; const done = (V.scenes || []).filter((s) => s.shots?.length).length;
  return { text: out.join('\n'), category: CAT[g] || 'drama', minutes: Math.max(1, Math.min(30, V.project.duration_min)), title: V.project.title, scenes: (V.scenes || []).length, withShots: done };
}
