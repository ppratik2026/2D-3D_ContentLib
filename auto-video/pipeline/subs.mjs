// Subtitles as a separate, editable layer: the video is rendered clean, then subtitles.ass (styled with the
// bundled fonts) is burned in with ffmpeg/libass. Editing text or style later only re-burns (minutes, not a re-render).
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

export const FONTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app', 'fonts');
export const FONTS = { // name shown → libass family + bold flag (all have Latin + Devanagari)
  Poppins: { family: 'Poppins', bold: 1, file: 'Poppins-Bold.ttf' },
  Mukta: { family: 'Mukta', bold: 1, file: 'Mukta-Bold.ttf' },
  Hind: { family: 'Hind SemiBold', bold: 0, file: 'Hind-SemiBold.ttf' },
  Kalam: { family: 'Kalam', bold: 1, file: 'Kalam-Bold.ttf' },
};
// size = % of video height
const BASE = { font: 'Poppins', size: 5.2, color: '#ffffff', nameColor: '#ffd166', outline: '#000000', outlineW: 3, box: true, boxColor: '#000000', boxOpacity: 0.6,
  position: 'bottom', margin: 6, showName: true, lang: 'hinglish', karaoke: false, karaokeColor: '#ffd400', italic: false, secondColor: '#cfe8ff', upper: false };
export const PRESETS = {
  classic: { ...BASE },
  youtube: { ...BASE, font: 'Poppins', size: 6.4, box: false, outlineW: 5, nameColor: '#ffd400' },
  karaoke: { ...BASE, karaoke: true, nameColor: '#7fd3ff' },
  cinematic: { ...BASE, font: 'Hind', size: 4.4, box: false, outlineW: 1.5, showName: false, italic: true, color: '#f3efe6' },
  dual: { ...BASE, lang: 'dual', size: 4.8 },
  hindi: { ...BASE, font: 'Mukta', lang: 'hindi', size: 5.6 },
  kids: { ...BASE, font: 'Kalam', size: 6.2, box: false, outlineW: 5, color: '#fff7c2', nameColor: '#ff8fc7' },
  none: { ...BASE, off: true },
};
export function styleFrom(subs, custom) { return { ...(PRESETS[subs] || PRESETS.classic), ...(custom || {}) }; }

const hex2ass = (hex, alpha = 0) => { const h = String(hex || '#ffffff').replace('#', '').padEnd(6, 'f'); const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, '0'); return `&H${a}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase(); };
const tc = (s) => { s = Math.max(0, s); const cs = Math.round(s * 100); const h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, x = Math.floor(cs / 100) % 60, c = cs % 100; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}.${String(c).padStart(2, '0')}`; };
const clean = (t) => String(t || '').replace(/[{}\\]/g, '').replace(/\s*\n\s*/g, ' ').trim();

// lines: [{start,end,char,name,hinglish,hindi,english}]
export function makeASS(lines, st, W = 1280, H = 720) {
  const F = FONTS[st.font] || FONTS.Poppins; const fs_ = Math.round((st.size / 100) * H * (F.scale || 1.4)); // libass size ≈ line height, glyphs look smaller
  const align = st.position === 'top' ? 8 : st.position === 'middle' ? 5 : 2; const mv = Math.round((st.margin / 100) * H);
  const border = st.box ? 3 : 1; const back = st.box ? hex2ass(st.boxColor, 1 - st.boxOpacity) : hex2ass('#000000', 0.45);
  const prim = st.karaoke ? hex2ass(st.karaokeColor) : hex2ass(st.color); const sec = hex2ass(st.color);
  const style = (name, size, italic, prim_, sec_) => `Style: ${name},${F.family},${size},${prim_},${sec_},${hex2ass(st.box ? st.boxColor : st.outline, st.box ? 1 - st.boxOpacity : 0)},${back},${F.bold ? -1 : 0},${italic ? -1 : 0},0,0,100,100,0,0,${border},${st.box ? Math.max(4, Math.round(fs_ * 0.18)) : st.outlineW},${st.box ? 0 : 1},${align},${Math.round(W * 0.07)},${Math.round(W * 0.07)},${mv},1`;
  const out = [`[Script Info]`, `ScriptType: v4.00+`, `PlayResX: ${W}`, `PlayResY: ${H}`, `WrapStyle: 0`, `ScaledBorderAndShadow: yes`, ``,
    `[V4+ Styles]`, `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding`,
    style('Default', fs_, st.italic, prim, sec), style('Narr', Math.round(fs_ * 0.92), true, hex2ass('#ffe9a8'), hex2ass('#ffe9a8')), ``,
    `[Events]`, `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`];
  if (st.off) return out.join('\n') + '\n';
  for (const l of lines) {
    const nar = l.char === 'narrator';
    let text = clean(st.lang === 'hindi' ? l.hindi || l.hinglish : st.lang === 'english' ? l.english || l.hinglish : l.hinglish || l.hindi);
    if (st.upper) text = text.toUpperCase();
    if (st.karaoke && !nar) { const words = text.split(/\s+/); const total = words.reduce((s, w) => s + w.length + 1, 0); const cs = Math.max(1, Math.round((l.end - l.start) * 100));
      text = words.map((w) => `{\\kf${Math.max(1, Math.round((cs * (w.length + 1)) / total))}}${w}`).join(' '); }
    const name = st.showName && !nar && l.name ? `{\\c${hex2ass(st.nameColor)}}${clean(l.name)}:{\\r} ` : '';
    const second = st.lang === 'dual' && l.english ? `\\N{\\fs${Math.round(fs_ * 0.72)}\\c${hex2ass(st.secondColor)}}${clean(l.english)}` : '';
    out.push(`Dialogue: 0,${tc(l.start)},${tc(l.end + 0.15)},${nar ? 'Narr' : 'Default'},,0,0,0,,${name}${text}${second}`);
  }
  return out.join('\n') + '\n';
}
export function linesFromTimeline(tl) {
  const names = Object.fromEntries((tl.story?.characters || []).map((c) => [c.id, c.name]));
  return tl.lines.map((l) => ({ id: l.id, char: l.char, name: names[l.char] || l.char, start: +l.start.toFixed(2), end: +l.end.toFixed(2), hinglish: l.hinglish, hindi: l.hindi, english: l.english }));
}
export function writeSRT(lines, file, lang = 'hinglish') {
  const ts = (s) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, x = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  fs.writeFileSync(file, lines.map((l, i) => `${i + 1}\n${ts(l.start)} --> ${ts(l.end)}\n${l.char === 'narrator' ? '' : l.name + ': '}${lang === 'hindi' ? l.hindi : lang === 'english' ? l.english : l.hinglish}\n`).join('\n'));
}
const escF = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
// burn: clean.mp4 + subtitles.ass → out.mp4 (audio copied)
export function burnSubs({ ffmpegPath, folder, clean = 'video_clean.mp4', ass = 'subtitles.ass', out = 'final.mp4', onProgress = () => {}, duration = 0 }) {
  return new Promise((ok, fail) => {
    const tmp = out + '.part.mp4';
    const args = ['-y', '-i', clean, '-vf', `ass='${ass}':fontsdir='${escF(FONTS_DIR)}'`, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', '-f', 'mp4', tmp];
    const p = spawn(ffmpegPath, args, { cwd: folder }); let err = '';
    p.stderr.on('data', (d) => { const s = String(d); err = (err + s).slice(-3000); const m = s.match(/time=(\d+):(\d+):(\d+\.\d+)/); if (m && duration) onProgress(Math.min(1, (+m[1] * 3600 + +m[2] * 60 + +m[3]) / duration)); });
    p.on('error', fail);
    p.on('close', (c) => { if (c !== 0) return fail(new Error('Burning subtitles failed: ' + err.slice(-600))); try { fs.renameSync(path.join(folder, tmp), path.join(folder, out)); ok(); } catch (e) { fail(e); } });
  });
}
// write the editable subtitle files for a finished video folder and burn them
export async function applySubs({ ffmpegPath, folder, lines, style, W, H, duration, onProgress }) {
  fs.writeFileSync(path.join(folder, 'subtitles.json'), JSON.stringify({ style, lines }, null, 2));
  fs.writeFileSync(path.join(folder, 'subtitles.ass'), makeASS(lines, style, W, H));
  writeSRT(lines, path.join(folder, 'subtitles.srt'), style.lang === 'hindi' ? 'hindi' : style.lang === 'english' ? 'english' : 'hinglish');
  if (style.off) { fs.copyFileSync(path.join(folder, 'video_clean.mp4'), path.join(folder, 'final.mp4')); return; }
  await burnSubs({ ffmpegPath, folder, duration, onProgress });
}
