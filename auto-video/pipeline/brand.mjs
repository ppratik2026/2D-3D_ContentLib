// Channel branding on finished videos: logo watermark (corner, size, opacity) + intro / outro clips (video or picture).
// Settings → Branding stores the files in Documents\AutoVideo\brand\. Applied after the subtitles (and again after a re-burn).
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { STATE } from './paths.mjs';

export const BRAND_DIR = path.join(STATE, 'brand'); fs.mkdirSync(BRAND_DIR, { recursive: true });
const CFG = path.join(BRAND_DIR, 'brand.json');
export function getBrand() { try { return JSON.parse(fs.readFileSync(CFG, 'utf8')); } catch { return { logo: null, pos: 'top-right', size: 12, opacity: 0.85, intro: null, outro: null, introSec: 3, outroSec: 4, on: true }; } }
export function setBrand(patch) { const b = { ...getBrand(), ...patch }; fs.writeFileSync(CFG, JSON.stringify(b, null, 2)); return b; }
export function importBrandFile(kind, src) { const ext = path.extname(src).toLowerCase(); const dst = path.join(BRAND_DIR, `${kind}${ext}`);
  for (const f of fs.readdirSync(BRAND_DIR)) if (f.startsWith(kind + '.')) fs.rmSync(path.join(BRAND_DIR, f), { force: true });
  fs.copyFileSync(src, dst); return setBrand({ [kind]: dst }); }
export const brandActive = (b = getBrand()) => b.on !== false && !!(b.logo || b.intro || b.outro);
const isPic = (f) => /\.(png|jpe?g|webp)$/i.test(f || '');

function run(ffmpegPath, args, onProgress, duration) { return new Promise((ok, fail) => { const p = spawn(ffmpegPath, args); let err = '';
  p.stderr.on('data', (d) => { const s = String(d); err = (err + s).slice(-3000); const m = s.match(/time=(\d+):(\d+):(\d+\.\d+)/); if (m && duration && onProgress) onProgress(Math.min(1, (+m[1] * 3600 + +m[2] * 60 + +m[3]) / duration)); });
  p.on('error', fail); p.on('close', (c) => (c === 0 ? ok() : fail(new Error('Branding failed: ' + err.slice(-500))))); }); }
const probe = (ffmpegPath, f) => new Promise((ok) => { const p = spawn(ffmpegPath, ['-hide_banner', '-i', f]); let e = ''; p.stderr.on('data', (d) => (e += d)); p.on('close', () => { const m = e.match(/Duration: (\d+):(\d+):(\d+\.\d+)/); ok({ audio: /Stream #.*Audio:/.test(e), dur: m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0 }); }); p.on('error', () => ok({ audio: false, dur: 0 })); });

// video.mp4 → the same file with logo / intro / outro
export async function applyBrand({ ffmpegPath, file, brand = getBrand(), duration = 0, onProgress = () => {} }) {
  if (!brandActive(brand)) return false;
  const W = 1280, H = 720; const args = ['-y']; const parts = []; let n = 0; const fc = [];
  const norm = (i, label) => `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p[${label}]`;
  const aNorm = (src, label) => `${src}aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[${label}]`;
  const addClip = async (f, sec, tag) => { if (!f || !fs.existsSync(f)) return;
    if (isPic(f)) { args.push('-loop', '1', '-t', String(sec), '-i', f); const vi = n++; args.push('-f', 'lavfi', '-t', String(sec), '-i', 'anullsrc=r=44100:cl=stereo'); const ai = n++; fc.push(norm(vi, `${tag}v`), aNorm(`[${ai}:a]`, `${tag}a`)); }
    else { args.push('-i', f); const vi = n++; fc.push(norm(vi, `${tag}v`)); const pr = await probe(ffmpegPath, f);
      if (pr.audio) fc.push(aNorm(`[${vi}:a]`, `${tag}a`)); else { args.push('-f', 'lavfi', '-t', String(pr.dur || sec), '-i', 'anullsrc=r=44100:cl=stereo'); const ai = n++; fc.push(aNorm(`[${ai}:a]`, `${tag}a`)); } }
    parts.push(tag); };
  await addClip(brand.intro, brand.introSec || 3, 'in');
  args.push('-i', file); const mi = n++; let mainV = `[${mi}:v]`;
  if (brand.logo && fs.existsSync(brand.logo)) { args.push('-i', brand.logo); const li = n++; const lw = Math.round((W * Math.max(3, Math.min(30, brand.size || 12))) / 100); const m = 24;
    const xy = { 'top-left': `${m}:${m}`, 'top-right': `W-w-${m}:${m}`, 'bottom-left': `${m}:H-h-${m}`, 'bottom-right': `W-w-${m}:H-h-${m}` }[brand.pos] || `W-w-${m}:${m}`;
    fc.push(`[${li}:v]scale=${lw}:-1,format=rgba,colorchannelmixer=aa=${Math.max(0.1, Math.min(1, brand.opacity ?? 0.85))}[logo]`, `${mainV}[logo]overlay=${xy}[mlogo]`); mainV = '[mlogo]'; }
  fc.push(`${mainV}scale=${W}:${H},setsar=1,fps=30,format=yuv420p[mv]`, aNorm(`[${mi}:a]`, 'ma')); parts.splice(brand.intro && fs.existsSync(brand.intro) ? 1 : 0, 0, 'm');
  await addClip(brand.outro, brand.outroSec || 4, 'out');
  fc.push(`${parts.map((p) => `[${p}v][${p}a]`).join('')}concat=n=${parts.length}:v=1:a=1[v][a]`);
  const tmp = file.replace(/\.mp4$/i, '.brand.mp4');
  args.push('-filter_complex', fc.join(';'), '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp);
  await run(ffmpegPath, args, onProgress, duration + (brand.intro ? brand.introSec || 3 : 0) + (brand.outro ? brand.outroSec || 4 : 0));
  fs.renameSync(tmp, file); return true;
}
