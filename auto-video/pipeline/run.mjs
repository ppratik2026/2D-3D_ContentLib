// The whole pipeline: category → Gemini story → Piper voices → timeline → music/sfx mix → render → MP4.
// Renderers: "chrome" (desktop app: WebGL + WebCodecs + ffmpeg, passed in as opts.renderFn) or "remotion".
// CLI:  node pipeline/run.mjs --category crime --minutes 2 --style toon [--look auto] [--subs auto] [--idea "..."] [--demo]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CATEGORIES, STYLES, LOOKS, SUBTITLE_STYLES } from './config.mjs';
import { ROOT, JOBS, OUTPUT, STATE } from './paths.mjs';
import { writeStory, normalizeBeats } from './story.mjs';
import { castVoices, speakAll } from './tts.mjs';
import { buildTimeline, finalize } from './timeline.mjs';
import { mixAll } from './audio.mjs';
import { estimate, fmt } from './estimate.mjs';
import { actorsFor, assignActors } from './library.mjs';

export function loadEnv() {
  const f = path.join(ROOT, '.env'); if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
}
const slug = (s) => String(s || '').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'video';
export const newJobId = (category) => new Date().toISOString().replace(/[:T]/g, '-').replace(/\..*/, '') + '_' + (category || 'video');

export async function makeVideo(opts, report = () => {}, { signal } = {}) {
  loadEnv();
  const category = CATEGORIES[opts.category] ? opts.category : 'drama';
  const style = STYLES[opts.style] ? opts.style : 'toon';
  const look = opts.look && opts.look !== 'auto' && LOOKS[opts.look] ? opts.look : CATEGORIES[category].look;
  const subs = opts.subs && opts.subs !== 'auto' && SUBTITLE_STYLES[opts.subs] ? opts.subs : CATEGORIES[category].subs;
  const renderer = opts.renderer === 'remotion' || !opts.renderFn ? 'remotion' : 'chrome';
  const minutes = Math.max(0.5, Math.min(30, Number(opts.minutes) || 1));
  const id = opts.id || newJobId(category);
  const work = path.join(OUTPUT, '.work', id); const pubDir = path.join(JOBS, id); fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(pubDir, { recursive: true });
  const T = { start: Date.now() }; const step = (name, msg, extra = {}) => report({ id, step: name, msg, elapsed: (Date.now() - T.start) / 1000, ...extra });
  const check = () => { if (signal?.aborted) throw new Error('Cancelled'); };
  const est = estimate({ style, minutes, renderer }); step('plan', `Estimated total ${fmt(est.total)}`, { estimate: est });

  // 1. story
  let story;
  if (opts.demo) { story = JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline', 'demo-story.json'), 'utf8')); for (const sc of story.scenes) sc.beats = normalizeBeats(sc.beats, story.characters, sc); }
  else {
    const key = opts.key || process.env.GEMINI_API_KEY; if (!key) throw new Error('Gemini API key missing. Add it in Settings.');
    story = await writeStory({ category, minutes, idea: opts.idea || '', key, model: opts.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      actors: actorsFor(style).map((a) => ({ id: a.id, gender: a.gender, age: a.age, tags: a.tags })), onLog: (m) => step('story', m) });
  }
  check();
  story.category = category;
  const cast = assignActors(story.characters, style);
  fs.writeFileSync(path.join(work, 'story.json'), JSON.stringify(story, null, 2));
  step('story', `Story ready: "${story.title}" (${story.scenes.length} scenes, ${story.characters.length} characters)`, { title: story.title });

  // 2. voices
  const tl = buildTimeline(story, { style, look, subs });
  tl.categoryLabel = CATEGORIES[category].label; tl.cast = cast;
  const soft = opts.gl === 'swiftshader' || (renderer === 'remotion' && (process.env.REMOTION_GL || (process.platform === 'linux' && !process.env.DISPLAY ? 'swiftshader' : 'angle')) === 'swiftshader');
  tl.perf = { aa: !soft, simpleMat: style === 'toon', noLamps: style !== 'realistic' };
  const voices = castVoices(story.characters);
  await speakAll(tl.lines, voices, path.join(work, 'voice'), (m) => step('voice', m));
  finalize(tl); check();
  step('voice', `Voices ready (${tl.lines.length} lines). Video length ${fmt(tl.duration)}`, { duration: tl.duration });

  // 3. sound
  const mixFile = path.join(pubDir, 'mix.wav');
  mixAll(tl, CATEGORIES[category].mood, mixFile);
  step('sound', 'Music, ambience, effects and dialogue mixed');

  // 4. render
  const clean = JSON.parse(JSON.stringify(tl)); for (const l of clean.lines) delete l.file;
  fs.writeFileSync(path.join(work, 'timeline.json'), JSON.stringify(clean));
  const out = path.join(work, 'final.mp4');
  const onProgress = (p, frames, secs) => step('render', `Rendering ${(p * 100).toFixed(0)}% (${frames}/${clean.durationInFrames} frames)`, { progress: p, eta: p > 0.02 ? secs / p - secs : null });
  let r;
  if (renderer === 'remotion') { const { renderVideo } = await import('./render.mjs'); r = await renderVideo({ tl: clean, mix: `jobs/${id}/mix.wav`, out, concurrency: opts.concurrency, onProgress }); }
  else r = await opts.renderFn({ tl: clean, mixFile, out, onProgress, signal });
  check();
  writeSubtitles(clean, path.join(work, 'subtitles.srt'));
  fs.rmSync(pubDir, { recursive: true, force: true }); fs.rmSync(path.join(work, 'voice'), { recursive: true, force: true });
  // final folder: Videos/<date>_<category>_<title>/
  const final = path.join(OUTPUT, `${id}_${slug(story.title)}`); fs.renameSync(work, final);
  try { const bf = path.join(STATE, 'bench.json'); const b = fs.existsSync(bf) ? JSON.parse(fs.readFileSync(bf, 'utf8')) : {}; b[`${style}_${renderer}`] = +(r.seconds / r.frames).toFixed(3); fs.writeFileSync(bf, JSON.stringify(b, null, 2)); } catch {}
  const file = path.join(final, 'final.mp4');
  step('done', `Done in ${fmt((Date.now() - T.start) / 1000)}`, { file, folder: final, duration: tl.duration, title: story.title });
  return { id, file, folder: final, story, duration: tl.duration };
}

function writeSubtitles(tl, file) {
  const ts = (s) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, x = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  const name = (id) => tl.story.characters.find((c) => c.id === id)?.name || id;
  fs.writeFileSync(file, tl.lines.map((l, i) => `${i + 1}\n${ts(l.start)} --> ${ts(l.end)}\n${name(l.char)}: ${l.hinglish}\n`).join('\n'));
}

// ---------- CLI (uses Remotion) ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const v = process.argv[i + 1]; if (!v || v.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = v; i++; } } }
  a.renderer = 'remotion';
  makeVideo(a, (e) => console.log(`[${fmt(e.elapsed)}] ${e.step}: ${e.msg}`)).catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
}
