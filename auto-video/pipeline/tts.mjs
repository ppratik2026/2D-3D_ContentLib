// Step 2: speak every line. Voice library = Piper Hindi (3) + Kokoro Hindi (4) + pitch/speed variants (~20 voices).
// Every story character gets a different voice that fits gender/age; a character from the library can have a fixed voice.
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { FPS } from './config.mjs';
import { readWav, writeWav, envelope } from './wav.mjs';
import { BIN, VOICES_DIR } from './paths.mjs';
import { loadKokoro, phonemesViaPiper, synthKokoro } from './kokoro.mjs';

export function piperBin() {
  if (process.env.PIPER_BIN && fs.existsSync(process.env.PIPER_BIN)) return process.env.PIPER_BIN;
  const p = path.join(BIN, 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
  return fs.existsSync(p) ? p : null;
}
export const voicePath = (v) => path.join(VOICES_DIR, v + '.onnx');
export const KOKORO_DIR = path.join(VOICES_DIR, 'kokoro');
const hasPiper = (v) => fs.existsSync(voicePath(v));
const hasKokoro = () => fs.existsSync(path.join(KOKORO_DIR, 'model_quantized.onnx'));

// engine, base voice, pitch factor (1 = natural), speed (1 = natural; >1 faster)
export const VOICE_LIB = [
  { id: 'm_pratham', label: 'Pratham — man (clear)', gender: 'male', age: 'adult', engine: 'piper', base: 'hi_IN-pratham-medium', pitch: 1, speed: 1 },
  { id: 'm_rohan', label: 'Rohan — young man', gender: 'male', age: 'young', engine: 'piper', base: 'hi_IN-rohan-medium', pitch: 1, speed: 1 },
  { id: 'm_omega', label: 'Omega — man (warm)', gender: 'male', age: 'adult', engine: 'kokoro', base: 'hm_omega', pitch: 1, speed: 1 },
  { id: 'm_psi', label: 'Psi — man (calm)', gender: 'male', age: 'adult', engine: 'kokoro', base: 'hm_psi', pitch: 1, speed: 1 },
  { id: 'm_deep', label: 'Deep voice — inspector / boss', gender: 'male', age: 'adult', engine: 'piper', base: 'hi_IN-pratham-medium', pitch: 0.86, speed: 0.95 },
  { id: 'm_deep2', label: 'Heavy voice — villain', gender: 'male', age: 'adult', engine: 'kokoro', base: 'hm_omega', pitch: 0.82, speed: 0.92 },
  { id: 'm_old', label: 'Old man — dada / baba', gender: 'male', age: 'old', engine: 'kokoro', base: 'hm_psi', pitch: 0.9, speed: 0.86 },
  { id: 'm_old2', label: 'Old man 2', gender: 'male', age: 'old', engine: 'piper', base: 'hi_IN-rohan-medium', pitch: 0.88, speed: 0.88 },
  { id: 'm_young', label: 'Young boy / college', gender: 'male', age: 'young', engine: 'kokoro', base: 'hm_psi', pitch: 1.1, speed: 1.05 },
  { id: 'm_kid', label: 'Little boy', gender: 'male', age: 'child', engine: 'piper', base: 'hi_IN-rohan-medium', pitch: 1.38, speed: 1.02 },
  { id: 'm_kid2', label: 'Little boy 2', gender: 'male', age: 'child', engine: 'kokoro', base: 'hm_omega', pitch: 1.42, speed: 1.0 },
  { id: 'f_priya', label: 'Priyamvada — woman (clear)', gender: 'female', age: 'adult', engine: 'piper', base: 'hi_IN-priyamvada-medium', pitch: 1, speed: 1 },
  { id: 'f_alpha', label: 'Alpha — woman (soft)', gender: 'female', age: 'adult', engine: 'kokoro', base: 'hf_alpha', pitch: 1, speed: 1 },
  { id: 'f_beta', label: 'Beta — young woman', gender: 'female', age: 'young', engine: 'kokoro', base: 'hf_beta', pitch: 1, speed: 1 },
  { id: 'f_young', label: 'Young girl / college', gender: 'female', age: 'young', engine: 'piper', base: 'hi_IN-priyamvada-medium', pitch: 1.08, speed: 1.04 },
  { id: 'f_strong', label: 'Strong woman — officer / mother', gender: 'female', age: 'adult', engine: 'kokoro', base: 'hf_alpha', pitch: 0.92, speed: 0.97 },
  { id: 'f_old', label: 'Old woman — dadi / nani', gender: 'female', age: 'old', engine: 'kokoro', base: 'hf_beta', pitch: 0.88, speed: 0.86 },
  { id: 'f_old2', label: 'Old woman 2', gender: 'female', age: 'old', engine: 'piper', base: 'hi_IN-priyamvada-medium', pitch: 0.9, speed: 0.88 },
  { id: 'f_kid', label: 'Little girl', gender: 'female', age: 'child', engine: 'kokoro', base: 'hf_beta', pitch: 1.3, speed: 1.0 },
  { id: 'f_kid2', label: 'Little girl 2', gender: 'female', age: 'child', engine: 'piper', base: 'hi_IN-priyamvada-medium', pitch: 1.28, speed: 1.02 },
];
// English voices (downloaded the first time an English video is made: Settings or the first English job)
export const VOICE_LIB_EN = [
  { id: 'en_m_ryan', label: 'Ryan — man (English)', gender: 'male', age: 'adult', engine: 'piper', base: 'en_US-ryan-medium', pitch: 1, speed: 1 },
  { id: 'en_m_michael', label: 'Michael — man, warm (English)', gender: 'male', age: 'adult', engine: 'kokoro', base: 'am_michael', pitch: 1, speed: 1 },
  { id: 'en_m_fenrir', label: 'Fenrir — young man (English)', gender: 'male', age: 'young', engine: 'kokoro', base: 'am_fenrir', pitch: 1.04, speed: 1.03 },
  { id: 'en_m_deep', label: 'Deep voice — boss / villain (English)', gender: 'male', age: 'adult', engine: 'piper', base: 'en_US-ryan-medium', pitch: 0.86, speed: 0.95 },
  { id: 'en_m_old', label: 'George — old man (English)', gender: 'male', age: 'old', engine: 'kokoro', base: 'bm_george', pitch: 0.92, speed: 0.9 },
  { id: 'en_m_kid', label: 'Little boy (English)', gender: 'male', age: 'child', engine: 'kokoro', base: 'am_fenrir', pitch: 1.38, speed: 1.0 },
  { id: 'en_f_amy', label: 'Amy — woman (English)', gender: 'female', age: 'adult', engine: 'piper', base: 'en_US-amy-medium', pitch: 1, speed: 1 },
  { id: 'en_f_heart', label: 'Heart — young woman (English)', gender: 'female', age: 'young', engine: 'kokoro', base: 'af_heart', pitch: 1, speed: 1 },
  { id: 'en_f_bella', label: 'Bella — woman, bright (English)', gender: 'female', age: 'adult', engine: 'kokoro', base: 'af_bella', pitch: 1, speed: 1 },
  { id: 'en_f_emma', label: 'Emma — woman, calm (English)', gender: 'female', age: 'adult', engine: 'kokoro', base: 'bf_emma', pitch: 1, speed: 0.98 },
  { id: 'en_f_old', label: 'Old woman (English)', gender: 'female', age: 'old', engine: 'kokoro', base: 'bf_emma', pitch: 0.88, speed: 0.87 },
  { id: 'en_f_kid', label: 'Little girl (English)', gender: 'female', age: 'child', engine: 'kokoro', base: 'af_heart', pitch: 1.3, speed: 1.0 },
].map((v) => ({ ...v, lang: 'en' }));
const hasKv = (v) => fs.existsSync(path.join(KOKORO_DIR, v + '.bin'));
export const EN_PHON = 'en_US-ryan-medium'; // eSpeak English phonemes for Kokoro come from this Piper voice
export const availableVoices = (lang = 'hi') => (lang === 'en' ? VOICE_LIB_EN.filter((v) => (v.engine === 'piper' ? hasPiper(v.base) : hasKokoro() && hasKv(v.base) && hasPiper(EN_PHON)))
  : VOICE_LIB.filter((v) => (v.engine === 'piper' ? hasPiper(v.base) : hasKokoro() && hasPiper('hi_IN-pratham-medium'))));
export const allVoices = () => [...availableVoices('hi'), ...availableVoices('en')];

// characters → voice preset ids (pinned voice wins; otherwise best gender/age match not used yet)
export function castVoices(characters, pinned = {}, lang = 'hi') {
  const pool = availableVoices(lang); if (!pool.length) throw new Error(lang === 'en' ? 'No English voice found. Settings → Download English voices.' : 'No voice found. Open Settings → Re-check models / voices.');
  const used = new Map(); const out = {};
  for (const c of characters) { const v = pool.find((x) => x.id === pinned[c.id]); if (v) { out[c.id] = v.id; used.set(v.id, (used.get(v.id) || 0) + 1); } }
  for (const c of characters) {
    if (out[c.id]) continue;
    const age = c.age === 'young' ? 'young' : c.age; let best = null, bs = -1e9;
    for (const v of pool) { let s = (v.gender === c.gender ? 50 : -50) + (v.age === age ? 20 : (v.age === 'child') !== (age === 'child') ? -30 : (v.age === 'old') !== (age === 'old') ? -12 : 0) - (used.get(v.id) || 0) * 25 + (v.pitch === 1 ? 2 : 0); if (s > bs) { bs = s; best = v; } }
    out[c.id] = best.id; used.set(best.id, (used.get(best.id) || 0) + 1);
  }
  return out;
}

function runPiper(voice, items) {
  return new Promise((ok, fail) => {
    const bin = piperBin(); if (!bin) return fail(new Error('Piper not installed. Settings → Re-check models / voices.'));
    const p = spawn(bin, ['-m', voicePath(voice), '--json-input', '--sentence_silence', '0.15', '-q'], { cwd: path.dirname(bin) });
    let err = ''; p.stderr.on('data', (d) => (err = (err + d).slice(-2000))); p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok() : fail(new Error('Piper failed: ' + err.slice(-400)))));
    for (const it of items) p.stdin.write(JSON.stringify({ text: it.text, output_file: it.file }) + '\n');
    p.stdin.end();
  });
}
// pitch / speed with ffmpeg (keeps it natural: asetrate+atempo), output 24 kHz mono
let ffmpegPath = null;
async function ff(args) { ffmpegPath ||= (await import('ffmpeg-static')).default; return new Promise((ok, fail) => { const p = spawn(ffmpegPath, ['-v', 'error', '-y', ...args]); let e = ''; p.stderr.on('data', (d) => (e += d)); p.on('error', fail); p.on('close', (c) => (c === 0 ? ok() : fail(new Error('ffmpeg: ' + e)))); }); }
function tempoChain(t) { const out = []; while (t > 2) { out.push('atempo=2'); t /= 2; } while (t < 0.5) { out.push('atempo=0.5'); t /= 0.5; } out.push(`atempo=${t.toFixed(4)}`); return out; }
async function shape(file, pitch, speed) {
  if (Math.abs(pitch - 1) < 0.01 && Math.abs(speed - 1) < 0.01) return;
  const w = readWav(file); const sr = w.rate; const tmp = file.replace(/\.wav$/, '.x.wav');
  const chain = [`asetrate=${Math.round(sr * pitch)}`, `aresample=${sr}`, ...tempoChain(speed / pitch)].join(',');
  await ff(['-i', file, '-af', chain, '-ac', '1', tmp]); fs.renameSync(tmp, file);
}

// lines: [{id, char, hindi}] → adds {file, duration, mouth[]}
export async function speakAll(lines, voices, outDir, onLog = () => {}, onProgress = () => {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const lib = Object.fromEntries([...VOICE_LIB, ...VOICE_LIB_EN].map((v) => [v.id, v]));
  for (const l of lines) { l.file = path.join(outDir, `line_${String(l.id).padStart(4, '0')}.wav`); fs.rmSync(l.file, { force: true }); l.voice = lib[voices[l.char]] || VOICE_LIB[0]; l.say = l.voice.lang === 'en' ? (l.english || l.hinglish || l.hindi) : l.hindi; }
  let done = 0; const tick = () => onProgress(done, lines.length);
  // Piper groups
  const piperGroups = {}; for (const l of lines) if (l.voice.engine === 'piper') (piperGroups[l.voice.base] ||= []).push(l);
  for (const [base, items] of Object.entries(piperGroups)) {
    const count = () => items.reduce((n, l) => n + (fs.existsSync(l.file) ? 1 : 0), 0); const d0 = done;
    const timer = setInterval(() => { done = d0 + count(); tick(); }, 500);
    try { await runPiper(base, items.map((l) => ({ text: l.say, file: path.resolve(l.file) }))); } finally { clearInterval(timer); }
    done = d0 + items.length; tick();
  }
  // Kokoro lines (phonemes from Piper's eSpeak, then Kokoro)
  const kl = lines.filter((l) => l.voice.engine === 'kokoro');
  if (kl.length) {
    onLog(`Kokoro voices: ${kl.length} lines`);
    const k = await loadKokoro(KOKORO_DIR);
    const ipa = []; for (const en of [false, true]) { const part = kl.map((l, i) => [l, i]).filter(([l]) => (l.voice.lang === 'en') === en); if (!part.length) continue;
      const r = await phonemesViaPiper(piperBin(), voicePath(en ? EN_PHON : 'hi_IN-pratham-medium'), part.map(([l]) => l.say)); part.forEach(([, i], k) => (ipa[i] = r[k])); }
    for (const [i, l] of kl.entries()) { const w = await synthKokoro(k, ipa[i] || '', l.voice.base, 1); const pad = new Float32Array(w.length + 3600); pad.set(w, 0); writeWav(l.file, [pad], 24000); done++; if (i % 3 === 0) tick(); }
  }
  // pitch / speed shaping per voice
  for (const l of lines) await shape(l.file, l.voice.pitch, l.voice.speed);
  onProgress(lines.length, lines.length);
  for (const l of lines) { const w = readWav(l.file); l.duration = w.duration; l.mouth = envelope(w.samples, w.rate, FPS); l.voiceId = l.voice.id; delete l.voice; delete l.say; }
  return lines;
}

// one short sample for the voice preview button
export async function sampleVoice(id, text, outFile) {
  const en = /^en_/.test(id); const l = { id: 0, char: 'x', hindi: text || 'नमस्ते! मैं इस कहानी में आपका किरदार हूँ। सुनिए मेरी आवाज़।', english: text || 'Hello! I am your character in this story. This is my voice.' }; if (en) l.hindi = l.english;
  await speakAll([l], { x: id }, path.dirname(outFile)); fs.renameSync(l.file, outFile); return outFile;
}
