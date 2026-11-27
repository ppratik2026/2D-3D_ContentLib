// Series: one saved folder per series (Documents\AutoVideo\series\<id>\series.json) with its settings, the same
// characters (looks + voices) and every episode's story, so the next episode continues with the same people.
import fs from 'fs';
import path from 'path';
import { STATE } from './paths.mjs';
import { getCast, toStoryChar } from './cast.mjs';

export const SERIES_DIR = path.join(STATE, 'series'); fs.mkdirSync(SERIES_DIR, { recursive: true });
const file = (id) => path.join(SERIES_DIR, id, 'series.json');
const slug = (s) => String(s || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'series';

export function listSeries() {
  const out = []; for (const id of fs.readdirSync(SERIES_DIR)) { try { const s = JSON.parse(fs.readFileSync(file(id), 'utf8')); out.push({ id: s.id, title: s.title, category: s.category, style: s.style, language: s.language, episodes: s.episodes.length, characters: s.cast.length, updated: s.updated }); } catch {} }
  return out.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
}
export function getSeries(id) { return JSON.parse(fs.readFileSync(file(id), 'utf8')); }
function save(s) { s.updated = new Date().toISOString(); fs.mkdirSync(path.dirname(file(s.id)), { recursive: true }); fs.writeFileSync(file(s.id), JSON.stringify(s, null, 2)); return s; }
export function createSeries({ title, category, style, language, bgMode, subsOn, topic = null, logline = '' }) {
  let id = slug(title), k = 1; while (fs.existsSync(path.join(SERIES_DIR, id))) id = `${slug(title)}_${++k}`;
  return save({ id, title: String(title || 'My series'), category, style, language, bgMode, subsOn, topic, logline, cast: [], backgrounds: [], episodes: [], created: new Date().toISOString() });
}
export function updateSeries(id, patch) { const s = getSeries(id); for (const k of ['title', 'category', 'style', 'language', 'bgMode', 'subsOn', 'logline']) if (k in patch) s[k] = patch[k]; return save(s); }
export function deleteSeries(id) { if (!/^[a-z0-9_]+$/.test(id)) throw new Error('bad id'); fs.rmSync(path.join(SERIES_DIR, id), { recursive: true, force: true }); }

// what the story writer needs to continue the series
export function seriesContext(id) {
  const s = getSeries(id); const n = s.episodes.length + 1;
  return { id: s.id, title: s.title, episode: n, logline: s.logline, characters: getCast(s.cast).map(toStoryChar), backgrounds: s.backgrounds,
    previous: s.episodes.slice(-8).map((e) => `Episode ${e.n} "${e.title}": ${e.summary}`), lastEnding: s.episodes.at(-1)?.ending || '' };
}
// after an episode is made: keep its story, add new characters and backgrounds
export function addEpisode(id, { story, castMap = {}, folder = '' }) {
  const s = getSeries(id); const n = s.episodes.length + 1; const dir = path.join(SERIES_DIR, id, `episode_${String(n).padStart(2, '0')}`); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'story.json'), JSON.stringify(story, null, 2));
  for (const cid of Object.values(castMap)) if (!s.cast.includes(cid)) s.cast.push(cid);
  for (const sc of story.scenes || []) if (sc.background && !s.backgrounds.includes(sc.background)) s.backgrounds.push(sc.background);
  if (!s.logline && story.logline) s.logline = story.logline;
  const summary = (story.scenes || []).map((sc) => sc.summary).filter(Boolean).join(' ').slice(0, 900);
  s.episodes.push({ n, title: story.title, summary: story.episode_summary || summary, ending: story.next_hook || (story.scenes || []).at(-1)?.summary || '', folder, made: new Date().toISOString() });
  return save(s);
}
