// YouTube Shorts / Reels from a finished video: 9:16 (1080×1920), 15–60 s, crop to the centre (or a chosen side)
// or the whole picture on a blurred background, big subtitles in the lower third and an optional title on top.
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { FONTS_DIR } from './subs.mjs';

const tc = (s) => { s = Math.max(0, s); const cs = Math.round(s * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
const clean = (t) => String(t || '').replace(/[{}\\]/g, '').replace(/\s*\n\s*/g, ' ').trim();
const escF = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
const hex = (h) => { const x = String(h || '#ffffff').replace('#', '').padEnd(6, 'f'); return `&H00${x.slice(4, 6)}${x.slice(2, 4)}${x.slice(0, 2)}`.toUpperCase(); };

function loadSubs(folder) { try { return JSON.parse(fs.readFileSync(path.join(folder, 'subtitles.json'), 'utf8')); } catch { return { style: {}, lines: [] }; } }

// the most "alive" parts of the video: many lines, questions / shouts, strong emotions
export function suggest(folder, len = 45) {
  const { lines } = loadSubs(folder); if (!lines.length) return [];
  const hot = (l) => 1 + (/[!?]/.test(l.hinglish || l.english || '') ? 0.6 : 0) + (/angry|surprised|scared|shock|happy/.test(l.emotion || '') ? 0.8 : 0);
  const out = [];
  for (const [i, l] of lines.entries()) { const a = Math.max(0, l.start - 0.4), b = a + len; let sc = 0; for (const m of lines.slice(i)) { if (m.start >= b) break; sc += hot(m); } out.push({ start: +a.toFixed(1), score: sc, text: clean(l.hinglish || l.english || l.hindi).slice(0, 80) }); }
  out.sort((x, y) => y.score - x.score); const picked = []; for (const c of out) { if (picked.every((p) => Math.abs(p.start - c.start) > len)) picked.push(c); if (picked.length >= 5) break; }
  return picked.sort((x, y) => x.start - y.start);
}

function assFor({ lines, lang, start, dur, title, font }) {
  const F = font || (lang === 'hindi' ? 'Mukta' : 'Poppins'); const W = 1080, H = 1920;
  const head = ['[Script Info]', 'ScriptType: v4.00+', `PlayResX: ${W}`, `PlayResY: ${H}`, 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '', '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Sub,${F},78,${hex('#ffffff')},${hex('#ffffff')},&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,6,2,2,70,70,470,1`,
    `Style: Name,${F},56,${hex('#ffd166')},${hex('#ffd166')},&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,5,2,2,70,70,600,1`,
    `Style: Title,${F},84,${hex('#ffd400')},${hex('#ffd400')},&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,7,3,8,60,60,170,1`,
    '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'];
  const ev = []; if (title) ev.push(`Dialogue: 0,${tc(0)},${tc(dur)},Title,,0,0,0,,${clean(title)}`);
  for (const l of lines) { const a = l.start - start, b = l.end - start; if (b <= 0 || a >= dur) continue; const txt = clean(lang === 'hindi' ? l.hindi : lang === 'english' ? l.english : l.hinglish);
    ev.push(`Dialogue: 0,${tc(a)},${tc(Math.min(dur, b))},Sub,,0,0,0,,${txt}`); if (l.char !== 'narrator' && l.name) ev.push(`Dialogue: 0,${tc(a)},${tc(Math.min(dur, b))},Name,,0,0,0,,${clean(l.name)}`); }
  return [...head, ...ev].join('\n');
}

// → path of the new short
export async function makeShort({ ffmpegPath, folder, start = 0, dur = 45, mode = 'crop', focus = 0.5, subs = true, title = '', onProgress = () => {} }) {
  const src = fs.existsSync(path.join(folder, 'video_clean.mp4')) && subs ? path.join(folder, 'video_clean.mp4') : path.join(folder, 'final.mp4');
  const dir = path.join(folder, 'shorts'); fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `short_${String(Math.round(start)).padStart(5, '0')}s_${Math.round(dur)}s.mp4`);
  const S = loadSubs(folder); const ass = path.join(dir, 'short.ass');
  fs.writeFileSync(ass, assFor({ lines: subs ? S.lines : [], lang: S.style?.lang || 'hinglish', start, dur, title, font: S.style?.font }));
  const f = Math.max(0, Math.min(1, focus));
  const vf = mode === 'fit'
    ? `[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2,eq=brightness=-0.08[bg];[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2-120,ass='${escF(ass)}':fontsdir='${escF(FONTS_DIR)}'[v]`
    : `[0:v]crop=ih*9/16:ih:(iw-ih*9/16)*${f.toFixed(3)}:0,scale=1080:1920,ass='${escF(ass)}':fontsdir='${escF(FONTS_DIR)}'[v]`;
  await new Promise((ok, fail) => { const p = spawn(ffmpegPath, ['-y', '-ss', String(start), '-t', String(dur), '-i', src, '-filter_complex', vf, '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], { cwd: dir });
    let err = ''; p.stderr.on('data', (d) => { const s = String(d); err = (err + s).slice(-2000); const m = s.match(/time=(\d+):(\d+):(\d+\.\d+)/); if (m) onProgress(Math.min(1, (+m[1] * 3600 + +m[2] * 60 + +m[3]) / dur)); });
    p.on('error', fail); p.on('close', (c) => (c === 0 ? ok() : fail(new Error('Making the short failed: ' + err.slice(-400))))); });
  return out;
}
export const listShorts = (folder) => { const d = path.join(folder, 'shorts'); return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.mp4')).sort() : []; };
