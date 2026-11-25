// Step 2: speak every line with Piper (free, offline, CPU) using Hindi voices.
// One Piper process per voice/speed, fed with JSON lines (fast).
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { VOICES, VOICE_VARIANTS, FPS } from './config.mjs';
import { readWav, envelope } from './wav.mjs';
import { BIN, VOICES_DIR } from './paths.mjs';

export function piperBin() {
  if (process.env.PIPER_BIN && fs.existsSync(process.env.PIPER_BIN)) return process.env.PIPER_BIN;
  const exe = process.platform === 'win32' ? 'piper.exe' : 'piper';
  const p = path.join(BIN, 'piper', exe);
  return fs.existsSync(p) ? p : null;
}
export const voicePath = (v) => path.join(VOICES_DIR, v + '.onnx');

// choose a voice for every character (different characters → different voice/speed where possible)
export function castVoices(characters) {
  const used = {}; const out = {};
  for (const c of characters) {
    const pool = VOICES[c.gender].filter((v) => fs.existsSync(voicePath(v)));
    const list = pool.length ? pool : [...VOICES.male, ...VOICES.female].filter((v) => fs.existsSync(voicePath(v)));
    if (!list.length) throw new Error('No Piper voice found. Run: npm run setup');
    const k = used[c.gender] = (used[c.gender] ?? -1) + 1;
    const voice = list[k % list.length], variant = VOICE_VARIANTS[Math.floor(k / list.length) % VOICE_VARIANTS.length];
    let speed = variant.speed; if (c.age === 'old') speed *= 1.12; if (c.age === 'child') speed *= 0.92;
    out[c.id] = { voice, lengthScale: +speed.toFixed(2) };
  }
  return out;
}

function runPiper(voice, lengthScale, items) {
  return new Promise((ok, fail) => {
    const bin = piperBin(); if (!bin) return fail(new Error('Piper not installed. Run: npm run setup'));
    const p = spawn(bin, ['-m', voicePath(voice), '--json-input', '--length_scale', String(lengthScale), '--sentence_silence', '0.15', '-q'], { cwd: path.dirname(bin) });
    let err = ''; p.stderr.on('data', (d) => (err += d)); p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok() : fail(new Error('Piper failed: ' + err.slice(-400)))));
    for (const it of items) p.stdin.write(JSON.stringify({ text: it.text, output_file: it.file }) + '\n');
    p.stdin.end();
  });
}

// lines: [{id, char, hindi}] → adds {file, duration, mouth[]}
export async function speakAll(lines, voices, outDir, onLog = () => {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const groups = {};
  for (const l of lines) { const v = voices[l.char]; const k = v.voice + '|' + v.lengthScale; (groups[k] ||= []).push(l); l.file = path.join(outDir, `line_${String(l.id).padStart(4, '0')}.wav`); }
  let done = 0;
  for (const [k, items] of Object.entries(groups)) {
    const [voice, ls] = k.split('|');
    await runPiper(voice, Number(ls), items.map((l) => ({ text: l.hindi, file: path.resolve(l.file) })));
    done += items.length; onLog(`Voice: ${done}/${lines.length} lines`);
  }
  for (const l of lines) { const w = readWav(l.file); l.duration = w.duration; l.mouth = envelope(w.samples, w.rate, FPS); }
  return lines;
}
