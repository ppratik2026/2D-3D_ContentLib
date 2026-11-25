// The whole pipeline: category → Gemini story → Piper voices → timeline → music/sfx mix → Remotion render → MP4.
// CLI:  node pipeline/run.mjs --category crime --minutes 2 --style toon [--look auto] [--subs auto] [--idea "..."] [--demo]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CATEGORIES, STYLES, LOOKS, SUBTITLE_STYLES } from './config.mjs';
import { ROOT, PUBLIC, OUTPUT } from './paths.mjs';
import { writeStory, normalizeBeats } from './story.mjs';
import { castVoices, speakAll } from './tts.mjs';
import { buildTimeline, finalize } from './timeline.mjs';
import { mixAll } from './audio.mjs';
import { renderVideo } from './render.mjs';
import { estimate, fmt } from './estimate.mjs';

export function loadEnv() {
  const f = path.join(ROOT, '.env'); if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
}

export async function makeVideo(opts, report = () => {}) {
  loadEnv();
  const category = CATEGORIES[opts.category] ? opts.category : 'drama';
  const style = STYLES[opts.style] ? opts.style : 'toon';
  const look = opts.look && opts.look !== 'auto' && LOOKS[opts.look] ? opts.look : CATEGORIES[category].look;
  const subs = opts.subs && opts.subs !== 'auto' && SUBTITLE_STYLES[opts.subs] ? opts.subs : CATEGORIES[category].subs;
  const minutes = Math.max(0.5, Math.min(30, Number(opts.minutes) || 1));
  const id = opts.id || new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '_' + category;
  const outDir = path.join(OUTPUT, id); const pubDir = path.join(PUBLIC, 'jobs', id); fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(pubDir, { recursive: true });
  const T = { start: Date.now() }; const step = (name, msg, extra = {}) => report({ id, step: name, msg, elapsed: (Date.now() - T.start) / 1000, ...extra });
  const est = estimate({ style, minutes }); step('plan', `Estimated total ${fmt(est.total)}`, { estimate: est });

  // 1. story
  let story;
  if (opts.demo) { story = JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline', 'demo-story.json'), 'utf8')); for (const sc of story.scenes) sc.beats = normalizeBeats(sc.beats, story.characters, sc); }
  else {
    const key = opts.key || process.env.GEMINI_API_KEY; if (!key) throw new Error('GEMINI_API_KEY missing. Put it in the .env file.');
    story = await writeStory({ category, minutes, idea: opts.idea || '', key, model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', onLog: (m) => step('story', m) });
  }
  story.category = category;
  fs.writeFileSync(path.join(outDir, 'story.json'), JSON.stringify(story, null, 2));
  step('story', `Story ready: "${story.title}" (${story.scenes.length} scenes, ${story.characters.length} characters)`);

  // 2. voices
  const tl = buildTimeline(story, { style, look, subs });
  const soft = (process.env.REMOTION_GL || (process.platform === 'linux' && !process.env.DISPLAY ? 'swiftshader' : 'angle')) === 'swiftshader';
  tl.perf = { aa: !soft, simpleMat: style === 'toon', noLamps: style !== 'realistic' };
  tl.categoryLabel = CATEGORIES[category].label;
  const voices = castVoices(story.characters);
  await speakAll(tl.lines, voices, path.join(outDir, 'voice'), (m) => step('voice', m));
  finalize(tl);
  step('voice', `Voices ready (${tl.lines.length} lines). Video length ${fmt(tl.duration)}`);

  // 3. sound
  const mixFile = path.join(pubDir, 'mix.wav');
  mixAll(tl, CATEGORIES[category].mood, mixFile);
  step('sound', 'Music, ambience, effects and dialogue mixed');

  // 4. render
  const clean = JSON.parse(JSON.stringify(tl)); for (const l of clean.lines) delete l.file;
  fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify(clean));
  const out = path.join(outDir, 'final.mp4');
  const r = await renderVideo({ tl: clean, mix: `jobs/${id}/mix.wav`, out, concurrency: opts.concurrency,
    onProgress: (p, frames, secs) => step('render', `Rendering ${(p * 100).toFixed(0)}% (${frames}/${clean.durationInFrames} frames)`, { progress: p, eta: p > 0.02 ? secs / p - secs : null }) });
  writeSubtitles(clean, path.join(outDir, 'subtitles.srt'));
  fs.rmSync(pubDir, { recursive: true, force: true });
  // remember the real speed on this PC → better estimates next time
  try { const bf = path.join(ROOT, 'bench.json'); const b = fs.existsSync(bf) ? JSON.parse(fs.readFileSync(bf, 'utf8')) : {}; b[style] = +(r.seconds / r.frames).toFixed(3); fs.writeFileSync(bf, JSON.stringify(b, null, 2)); } catch {}
  step('done', `Done in ${fmt((Date.now() - T.start) / 1000)} → ${out}`, { file: out, duration: tl.duration });
  return { id, file: out, story, duration: tl.duration };
}

function writeSubtitles(tl, file) {
  const ts = (s) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, x = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  const name = (id) => tl.story.characters.find((c) => c.id === id)?.name || id;
  fs.writeFileSync(file, tl.lines.map((l, i) => `${i + 1}\n${ts(l.start)} --> ${ts(l.end)}\n${name(l.char)}: ${l.hinglish}\n`).join('\n'));
}

// ---------- CLI ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = {}; for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const v = process.argv[i + 1]; if (!v || v.startsWith('--')) a[k.slice(2)] = true; else { a[k.slice(2)] = v; i++; } } }
  makeVideo(a, (e) => console.log(`[${fmt(e.elapsed)}] ${e.step}: ${e.msg}`)).catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
}
