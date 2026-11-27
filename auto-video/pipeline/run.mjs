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
import { adaptStory } from './story.mjs';
import { applySubs, linesFromTimeline, styleFrom } from './subs.mjs';
import { WIDTH, HEIGHT } from './config.mjs';
import { mixAll } from './audio.mjs';
import { estimate, fmt } from './estimate.mjs';
import { actorsFor, assignActors, listCharacters } from './library.mjs';
import { listBackgrounds, pickBackground } from './backgrounds.mjs';
import { getCast, toStoryChar, saveFromStory } from './cast.mjs';
import { seriesContext, addEpisode } from './series.mjs';
import { makeStoryBackground } from './bgmake.mjs';
import { englishReady, ensureEnglish } from './setup.mjs';

export function loadEnv() {
  const f = path.join(ROOT, '.env'); if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
}
const slug = (s) => String(s || '').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'video';
export const newJobId = (category) => new Date().toISOString().replace(/[:T]/g, '-').replace(/\..*/, '') + '_' + (category || 'video');

const chainKey = (opts) => opts.key || process.env.GEMINI_API_KEY || '';
export async function makeVideo(opts, report = () => {}, { signal } = {}) {
  loadEnv();
  const category = CATEGORIES[opts.category] ? opts.category : 'drama';
  const style = STYLES[opts.style] ? opts.style : 'toon'; const isStage = style === 'cartoon2d' || style === 'flat2d' || style === 'bean2d'; const bgTag = style === 'bean2d' ? 'bean' : style === 'flat2d' ? 'flat' : null;
  const tagOf = (x) => ((x.tags || []).includes('bean') ? 'bean' : (x.tags || []).includes('flat') ? 'flat' : null); const styleBgs = () => { const all = listBackgrounds(); const mine = all.filter((x) => tagOf(x) === bgTag); return mine.length ? mine : all; };
  const look = opts.look && opts.look !== 'auto' && LOOKS[opts.look] ? opts.look : isStage ? (category === 'horror' ? 'horror' : 'vivid') : CATEGORIES[category].look; // cartoon channels are colourful
  const subs = opts.subs && opts.subs !== 'auto' && SUBTITLE_STYLES[opts.subs] ? opts.subs : CATEGORIES[category].subs;
  const renderer = opts.renderer === 'remotion' || !opts.renderFn ? 'remotion' : 'chrome';
  const minutes = Math.max(0.5, Math.min(30, Number(opts.minutes) || 1));
  const id = opts.id || newJobId(category);
  const work = path.join(OUTPUT, '.work', id); const pubDir = path.join(JOBS, id); fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(pubDir, { recursive: true });
  const T = { start: Date.now() }; const step = (name, msg, extra = {}) => report({ id, step: name, msg, elapsed: (Date.now() - T.start) / 1000, ...extra });
  const stage = (name, done, total, label) => report({ id, step: name, stage: { name, done, total, label }, msg: label, elapsed: (Date.now() - T.start) / 1000 });
  const check = () => { if (signal?.aborted) throw new Error('Cancelled'); };
  const est = estimate({ style, minutes, renderer }); step('plan', `Estimated total ${fmt(est.total)}`, { estimate: est });
  const language = ['hindi', 'hinglish', 'english'].includes(opts.language) ? opts.language : 'hinglish'; const vlang = language === 'english' ? 'en' : 'hi';
  const series = opts.seriesId ? seriesContext(opts.seriesId) : null; const bgMode = opts.bgMode === 'new' && isStage ? 'new' : 'existing';
  const fixed = [...(series?.characters || []), ...getCast(opts.castIds || []).map(toStoryChar)].filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i);
  if (series) step('plan', `Series "${series.title}" · episode ${series.episode} · ${series.characters.length} saved characters`);
  if (vlang === 'en' && !englishReady()) { stage('story', 0, 1, 'Downloading English voices (one time, ~130 MB)'); await ensureEnglish((p) => stage('story', p.index, p.count, `English voices: ${p.label}${p.total > 1 ? ' ' + Math.round((p.got / p.total) * 100) + '%' : ''}`)); }

  // 1. story
  let story;
  if (opts.storyJson) { story = JSON.parse(JSON.stringify(opts.storyJson)); stage('story', 1, 1, 'Pasted story'); }
  else if (opts.demo) { story = JSON.parse(fs.readFileSync(path.join(ROOT, 'pipeline', opts.demoFile || 'demo-story.json'), 'utf8')); for (const sc of story.scenes) sc.beats = normalizeBeats(sc.beats, story.characters, sc); }
  else {
    let chain = opts.chain;
    if (!chain) { const key = opts.key || process.env.GEMINI_API_KEY; chain = key ? [{ provider: 'gemini', key, model: opts.model || process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite' }] : []; }
    const bgList = isStage ? styleBgs().map((b) => ({ id: b.id, name: b.name, place: b.place, time: b.time, tags: b.tags, marks: [...new Set((b.seats || []).map((m) => m.type || 'seat'))] })) : [];
    if (opts.myStory) story = await adaptStory({ text: opts.myStory, category, minutes, chain, backgrounds: bgList, language, fixed, actors: actorsFor(isStage ? 'toon' : style).map((a) => ({ id: a.id, gender: a.gender, age: a.age, tags: a.tags })), onLog: (m) => step('story', m), onProgress: (d, n, label) => stage('story', d, n, label) });
    const seriesBgs = series ? series.backgrounds.map((id) => listBackgrounds().find((b) => b.id === id)).filter(Boolean) : [];
    if (!opts.myStory) story = await writeStory({ category, minutes, idea: opts.idea || '', chain, chars: opts.chars || 'auto', language, fixed, series, bgMode, backgrounds: bgMode === 'new' ? seriesBgs.map((b) => ({ id: b.id, name: b.name, place: b.place, time: b.time, tags: b.tags })) : isStage ? [...seriesBgs, ...styleBgs().filter((b) => !seriesBgs.includes(b))].map((b) => ({ id: b.id, name: b.name, place: b.place, time: b.time, tags: b.tags, marks: [...new Set((b.seats || []).map((m) => m.type || 'seat'))] })) : [],
      actors: actorsFor(style).map((a) => ({ id: a.id, gender: a.gender, age: a.age, tags: a.tags })), onLog: (m) => step('story', m), onProgress: (d, n, label) => stage('story', d, n, label) });
  }
  check();
  story.category = category;
  const actorStyle = isStage ? 'toon' : style;
  const cast = assignActors(story.characters, actorStyle);
  let stageBgs = null;
  if (isStage && bgMode === 'new') { // new backgrounds painted by Gemini for this story (saved in the library, reused next time)
    const gk = (opts.chain || []).find((p) => p.provider === 'gemini')?.key || chainKey(opts); const painters = (opts.chain || [])[0]?.provider === 'gemini' || (!opts.chain?.length && gk) ? ['gemini', 'free'] : ['free']; /* the chosen story AI decides: Gemini paints only when Gemini is chosen */
    step('story', painters[0] === 'gemini' ? 'Backgrounds: Gemini paints them (free painter if Gemini cannot)' : 'Backgrounds: free painter (Pollinations FLUX, no key)');
    const descs = [...new Set(story.scenes.map((sc) => (/^new\s*:/i.test(sc.background || '') ? sc.background.replace(/^new\s*:\s*/i, '').trim() : '')).filter(Boolean))].slice(0, 5); const made = {};
    for (const [i, d] of descs.entries()) { check(); const sc0 = story.scenes.find((sc) => sc.background.replace(/^new\s*:\s*/i, '').trim() === d); stage('story', i, descs.length, `Painting background ${i + 1}/${descs.length}: ${d.slice(0, 50)}`);
      try { const r = await makeStoryBackground({ painters, desc: d, style, time: sc0?.time_of_day === 'night' ? 'night' : sc0?.time_of_day || 'day', key: gk, chain: opts.chain || [], onLog: (m) => step('story', m) }); made[d] = r.bg.id; step('story', `${r.reused ? 'Reused' : 'New'} background: ${r.bg.name}`); }
      catch (e) { step('story', `⚠ Could not paint "${d.slice(0, 50)}": ${e.message} — using the closest existing background`); if (/not reachable|no painter/.test(e.message)) break; } }
    for (const sc of story.scenes) { const d = (sc.background || '').replace(/^new\s*:\s*/i, '').trim(); if (made[d]) sc.background = made[d]; } story.newBackgrounds = (story.newBackgrounds || []).filter((d) => !made[d.trim()]); }
  if (isStage) { const all = [...new Map([...styleBgs(), ...listBackgrounds().filter((b) => story.scenes.some((sc) => sc.background === b.id))].map((b) => [b.id, b])).values()]; if (!all.length) throw new Error('2D Cartoon Stage needs backgrounds. Add some in the Backgrounds tab.');
    const used = new Map(); stageBgs = {};
    for (const sc of story.scenes) { const want = /^new\s*:/i.test(sc.background || '') ? sc.background.replace(/^new\s*:\s*/i, '') : ''; const b = all.find((x) => x.id === sc.background) || pickBackground(all, { place: sc.location, time: sc.time_of_day, weather: sc.weather, text: `${want} ${sc.summary}`, used });
      if (sc.weather === 'snow' && !/snow|hill|mountain|pahad|barf|himal/i.test([b.name, ...(b.tags || [])].join(' '))) (story.newBackgrounds ||= []).push('snowy mountain / hill scene with snow on the ground and roofs (for the snow scenes)');
      sc.background = b.id; used.set(b.id, (used.get(b.id) || 0) + 1); stageBgs[b.id] = b; if (!sc.time_of_day || sc.time_of_day === 'day') sc.time_of_day = b.time || sc.time_of_day; } }
  if (stageBgs) { const all = styleBgs(); for (const sc of story.scenes) for (const bt of sc.beats || []) if (bt.action === 'dream') { const b = all.find((x) => x.id === bt.background) || pickBackground(all, { place: bt.background || sc.location, text: String(bt.background || ''), used: new Map() }); if (b) { bt.background = b.id; stageBgs[b.id] = b; } } } /* the place seen inside a dream cloud */
  fs.writeFileSync(path.join(work, 'story.json'), JSON.stringify(story, null, 2));
  // what the app could not show yet → a to-do list next to the video
  const notes = [];
  if (story.unsupported?.length) { notes.push('Actions the story needs that the app cannot animate yet (the narrator tells them instead):', ...story.unsupported.map((a) => '  - ' + a), ''); step('story', `⚠ Not animated yet (narrator tells them): ${story.unsupported.join(', ')}`); }
  if (story.newBackgrounds?.length) { notes.push('Backgrounds to make (a similar one was used this time). Prompts:', ...[...new Set(story.newBackgrounds)].map((d) => `  - ${d}. ${style === 'bean2d' ? 'dark night 2D doodle cartoon background, very dark grey-blue walls, flat simple shapes with thin light grey outlines, warm glowing lamps, side view, empty floor line in the lower part, no people,' : style === 'flat2d' ? 'flat 2D vector explainer-video background, simple flat shapes, pastel colours, thin dark outlines, no gradients,' : 'Indian 2D cartoon animation background, hand-painted digital art, soft cel shading, clean outlines, warm vivid colours,'} wide shot at eye level, flat open ground in the lower third, completely empty scene, no people, no animals, no text, 16:9`), ''); step('story', `⚠ Missing backgrounds (used the closest): ${story.newBackgrounds.join('; ')}`); }
  if (notes.length) fs.writeFileSync(path.join(work, 'TO-DO.txt'), notes.join('\r\n'));
  step('story', `Story ready: "${story.title}" (${story.scenes.length} scenes, ${story.characters.length} characters)`, { title: story.title });

  // 2. voices
  const tl = buildTimeline(story, { style, look, subs, stage: !!stageBgs });
  tl.categoryLabel = CATEGORIES[category].label; if (series) tl.episodeLabel = (language === 'hindi' ? 'एपिसोड ' : 'Episode ') + series.episode; tl.cast = cast; if (stageBgs) { tl.mode = 'stage'; tl.backgrounds = stageBgs; tl.flat = style === 'flat2d' || style === 'bean2d'; tl.bean = style === 'bean2d'; }
  const soft = opts.gl === 'swiftshader' || (renderer === 'remotion' && (process.env.REMOTION_GL || (process.platform === 'linux' && !process.env.DISPLAY ? 'swiftshader' : 'angle')) === 'swiftshader');
  tl.perf = { aa: !soft, simpleMat: style === 'toon', noLamps: style !== 'realistic' };
  // fixed voices: a library character can have its own voice (first story character played by it gets it)
  const libById = Object.fromEntries(listCharacters().map((c) => [c.id, c])); const pinned = {}; const pinUsed = new Set();
  for (const ch of story.characters) { const v = libById[cast[ch.id]?.actor]?.voice; if (v && !pinUsed.has(v)) { pinned[ch.id] = v; pinUsed.add(v); } }
  if (story.characters.some((c) => c.id === 'narrator') && !pinned.narrator) pinned.narrator = 'm_psi'; // calm storyteller voice
  for (const ch of story.characters) if (ch.voice && !pinned[ch.id] && !pinUsed.has(ch.voice) && /^en_/.test(ch.voice) === (vlang === 'en')) { pinned[ch.id] = ch.voice; pinUsed.add(ch.voice); } /* saved characters keep their voice */
  if (vlang === 'en' && pinned.narrator === 'm_psi') pinned.narrator = 'en_m_michael';
  const voices = castVoices(story.characters, pinned, vlang);
  stage('voice', 0, tl.lines.length, `Voices 0/${tl.lines.length} lines`);
  await speakAll(tl.lines, voices, path.join(work, 'voice'), (m) => step('voice', m), (d, n) => stage('voice', d, n, `Voices ${d}/${n} lines`));
  finalize(tl); check();
  step('voice', `Voices ready (${tl.lines.length} lines). Video length ${fmt(tl.duration)}`, { duration: tl.duration });

  // 3. sound
  const mixFile = path.join(pubDir, 'mix.wav');
  stage('sound', 0, 1, 'Music, ambience and effects');
  mixAll(tl, CATEGORIES[category].mood, mixFile);
  stage('sound', 1, 1, 'Music, ambience, effects and dialogue mixed');

  // 4. render
  const clean = JSON.parse(JSON.stringify(tl)); for (const l of clean.lines) delete l.file;
  let subStyle = styleFrom(subs, opts.subStyle); subStyle = { ...subStyle, lang: subStyle.lang === 'dual' && language !== 'english' ? 'dual' : language, ...(language === 'hindi' && !/Mukta|Hind/.test(subStyle.font || '') ? { font: 'Mukta' } : {}) }; clean.bubbleLang = language; /* bubbles, subtitles and the voice use the chosen language */
  const subsOn = opts.subsOn === true || opts.subsOn === false ? opts.subsOn : style !== 'bean2d' && subs !== 'none'; if (!subsOn) subStyle = { ...subStyle, off: true }; /* Bean Night: the words are in speech bubbles (subtitles only if turned on) */ clean.subsPreset = subs; clean.subs = 'none'; // subtitles are burned afterwards (editable)
  fs.writeFileSync(path.join(work, 'timeline.json'), JSON.stringify(clean));
  const out = path.join(work, 'video_clean.mp4');
  const onProgress = (p, frames, secs) => { step('render', `Rendering ${(p * 100).toFixed(0)}% (${frames}/${clean.durationInFrames} frames)`, { progress: p, eta: p > 0.02 ? secs / p - secs : null, stage: { name: 'render', done: frames, total: clean.durationInFrames, label: `Frames ${frames}/${clean.durationInFrames}` } }); };
  const onSave = () => stage('save', 0, 1, 'Adding audio and saving MP4');
  let r;
  if (renderer === 'remotion') { const { renderVideo } = await import('./render.mjs'); r = await renderVideo({ tl: clean, mix: `jobs/${id}/mix.wav`, out, concurrency: opts.concurrency, onProgress }); }
  else r = await opts.renderFn({ tl: clean, mixFile, out, onProgress, onSave, signal });
  check();
  stage('save', 0, 1, 'Adding subtitles');
  await applySubs({ ffmpegPath: opts.ffmpegPath || (await import('ffmpeg-static')).default, folder: work, lines: linesFromTimeline(clean), style: subStyle, W: WIDTH, H: HEIGHT, duration: tl.duration,
    onProgress: (p) => stage('save', Math.round(p * 100), 100, `Adding subtitles ${Math.round(p * 100)}%`) });
  stage('save', 1, 1, 'Saved');
  fs.rmSync(pubDir, { recursive: true, force: true }); fs.rmSync(path.join(work, 'voice'), { recursive: true, force: true });
  // final folder: Videos/<date>_<category>_<title>/
  const final = path.join(OUTPUT, `${id}_${slug(story.title)}`); fs.renameSync(work, final);
  try { const bf = path.join(STATE, 'bench.json'); const b = fs.existsSync(bf) ? JSON.parse(fs.readFileSync(bf, 'utf8')) : {}; b[`${style}_${renderer}`] = +(r.seconds / r.frames).toFixed(3); fs.writeFileSync(bf, JSON.stringify(b, null, 2)); } catch {}
  const file = path.join(final, 'final.mp4');
  try { const castMap = saveFromStory(story, { style, voices, seriesId: opts.seriesId || null }); if (opts.seriesId) { addEpisode(opts.seriesId, { story, castMap, folder: final }); step('done', `Saved as episode ${series.episode} of "${series.title}"`); } } catch (e) { step('done', '⚠ Could not save the characters / series: ' + e.message); }
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
