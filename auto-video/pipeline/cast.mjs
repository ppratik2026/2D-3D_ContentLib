// Story characters library ("cast"): every character a video used is saved here (name, look, colours, voice),
// so it can be picked again in a new video or kept the same in every episode of a series.
import fs from 'fs';
import path from 'path';
import { STATE } from './paths.mjs';

const FILE = path.join(STATE, 'cast.json');
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; } };
const write = (list) => fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 20) || 'char';
export const LOOK_FIELDS = ['name', 'gender', 'age', 'role', 'look', 'skin_color', 'hat', 'hat_color', 'top_color', 'bottom_color', 'hair_color', 'personality', 'size'];

export function listCast() { return read().sort((a, b) => (b.updated || '').localeCompare(a.updated || '')); }
export function getCast(ids = []) { const all = read(); return ids.map((id) => all.find((c) => c.id === id)).filter(Boolean); }
export function updateCast(id, patch) { const all = read(); const c = all.find((x) => x.id === id); if (!c) throw new Error('not found'); for (const k of [...LOOK_FIELDS, 'voice']) if (k in patch) c[k] = patch[k]; c.updated = new Date().toISOString(); write(all); return c; }
export function deleteCast(id) { write(read().filter((c) => c.id !== id)); }

// a saved character → a story character (keeps its story id short and stable)
export function toStoryChar(c) { const o = { id: c.storyId || slug(c.name).slice(0, 14), castId: c.id }; for (const k of LOOK_FIELDS) if (c[k] != null && c[k] !== '') o[k] = c[k]; if (c.voice) o.voice = c.voice; return o; }

// after a video: add new characters, refresh known ones (matched by castId, else by name + gender)
export function saveFromStory(story, { style, voices = {}, seriesId = null } = {}) {
  const all = read(); const now = new Date().toISOString(); const out = {};
  for (const ch of story.characters || []) {
    if (ch.hidden || ch.id === 'narrator' || /^extra/.test(ch.id)) continue;
    let c = ch.castId && all.find((x) => x.id === ch.castId);
    if (!c) c = all.find((x) => x.name.toLowerCase() === String(ch.name || '').toLowerCase() && x.gender === ch.gender && (!seriesId || (x.series || []).includes(seriesId) || !(x.series || []).length));
    if (!c) { let id = slug(ch.name), k = 1; while (all.some((x) => x.id === id)) id = `${slug(ch.name)}_${++k}`; c = { id, created: now, used: 0, styles: [], series: [] }; all.push(c); }
    for (const k of LOOK_FIELDS) if (ch[k] != null && ch[k] !== '') c[k] = ch[k];
    c.storyId = ch.id; if (voices[ch.id]) c.voice = voices[ch.id];
    if (style && !c.styles.includes(style)) c.styles.push(style); if (seriesId && !c.series.includes(seriesId)) c.series.push(seriesId);
    c.used = (c.used || 0) + 1; c.updated = now; out[ch.id] = c.id;
  }
  write(all); return out; // story id → cast id
}
