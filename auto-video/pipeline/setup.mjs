// First-run downloads: free 3D models, Piper TTS and Hindi voices. Used by the desktop app and by `npm run setup`.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { ASSETS, BIN, VOICES_DIR, ROOT } from './paths.mjs';
// the full ZIP ships every file in seed/ (assets, bin/piper, voices): copied on first run instead of downloaded
const SEED = path.join(ROOT, 'seed');
const seedOf = (file) => { for (const [dir, sub] of [[ASSETS, 'assets'], [VOICES_DIR, 'voices'], [BIN, 'bin']]) if (file.startsWith(dir + path.sep)) return path.join(SEED, sub, path.relative(dir, file)); return null; };
const KOKORO = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/';

const T = 'https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/';
export const MODEL_FILES = [
  [T + 'models/gltf/Soldier.glb', 'Soldier.glb'],
  [T + 'models/gltf/Michelle.glb', 'Michelle.glb'],
  [T + 'models/gltf/readyplayer.me.glb', 'readyplayer.me.glb'],
  [T + 'textures/equirectangular/venice_sunset_1k.hdr', 'venice_sunset_1k.hdr'],
  ['https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/stable/AvatarSample_A.vrm', 'AvatarSample_A.vrm'],
  ['https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/stable/AvatarSample_B.vrm', 'AvatarSample_B.vrm'],
  ['https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/stable/AvatarSample_C.vrm', 'AvatarSample_C.vrm'],
  ['https://raw.githubusercontent.com/pixiv/three-vrm/dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm', 'girl.vrm'],
  ['https://raw.githubusercontent.com/vrm-c/vrm-specification/master/samples/Seed-san/vrm/Seed-san.vrm', 'Seed-san.vrm'],
];
const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/';
export const VOICE_NAMES = ['pratham', 'rohan', 'priyamvada'];
const PIPER = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/';
const PIPER_FILE = { 'win32-x64': 'piper_windows_amd64.zip', 'linux-x64': 'piper_linux_x86_64.tar.gz', 'linux-arm64': 'piper_linux_aarch64.tar.gz', 'darwin-x64': 'piper_macos_x64.tar.gz', 'darwin-arm64': 'piper_macos_aarch64.tar.gz' }[`${process.platform}-${process.arch}`];
const piperExe = () => path.join(BIN, 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');

function plan() {
  const items = MODEL_FILES.map(([u, f]) => ({ url: u, file: path.join(ASSETS, f), label: f }));
  if (PIPER_FILE) items.push({ url: PIPER + PIPER_FILE, file: path.join(BIN, PIPER_FILE), label: 'Piper TTS', unpack: true });
  for (const v of VOICE_NAMES) { const n = `hi_IN-${v}-medium`; items.push({ url: `${HF}${v}/medium/${n}.onnx.json`, file: path.join(VOICES_DIR, n + '.onnx.json'), label: n + ' (info)' }, { url: `${HF}${v}/medium/${n}.onnx`, file: path.join(VOICES_DIR, n + '.onnx'), label: 'Hindi voice: ' + v }); }
  fs.mkdirSync(path.join(VOICES_DIR, 'kokoro'), { recursive: true });
  for (const [f, rel] of [['model_quantized.onnx', 'onnx/model_quantized.onnx'], ['tokenizer.json', 'tokenizer.json'], ...['hf_alpha', 'hf_beta', 'hm_omega', 'hm_psi'].map((v) => [v + '.bin', `voices/${v}.bin`])])
    items.push({ url: KOKORO + rel, file: path.join(VOICES_DIR, 'kokoro', f), label: f === 'model_quantized.onnx' ? 'Kokoro voice model' : 'Kokoro: ' + f });
  return items;
}
const have = (f) => fs.existsSync(f) && fs.statSync(f).size > (f.endsWith('.json') ? 100 : 1000);
export function setupStatus() { const items = plan(); const missing = items.filter((i) => !have(i.file) && !(i.unpack && fs.existsSync(piperExe()))); return { done: missing.length === 0, missing: missing.map((i) => i.label), total: items.length }; }

async function download(url, file, onBytes) {
  const r = await fetch(url, { redirect: 'follow' }); if (!r.ok) throw new Error(`${r.status} for ${url}`);
  const total = Number(r.headers.get('content-length')) || 0; const out = fs.createWriteStream(file + '.part'); let got = 0;
  for await (const chunk of r.body) { got += chunk.length; if (!out.write(chunk)) await new Promise((ok) => out.once('drain', ok)); onBytes(got, total); }
  await new Promise((ok, fail) => out.end((e) => (e ? fail(e) : ok()))); fs.renameSync(file + '.part', file);
}

// onProgress({ index, count, label, got, total })
export async function runSetup(onProgress = () => {}) {
  const items = plan();
  for (const [i, it] of items.entries()) {
    if (it.unpack && fs.existsSync(piperExe())) continue;
    if (it.unpack && fs.existsSync(path.join(SEED, 'bin', 'piper'))) { onProgress({ index: i, count: items.length, label: 'Copying ' + it.label, got: 0, total: 1 }); await fs.promises.cp(path.join(SEED, 'bin', 'piper'), path.join(BIN, 'piper'), { recursive: true }); onProgress({ index: i + 1, count: items.length, label: it.label, got: 1, total: 1 }); continue; }
    const sd = seedOf(it.file); if (!have(it.file) && sd && have(sd)) { onProgress({ index: i, count: items.length, label: 'Copying ' + it.label, got: 0, total: 1 }); fs.mkdirSync(path.dirname(it.file), { recursive: true }); await fs.promises.copyFile(sd, it.file); }
    if (!have(it.file)) await download(it.url, it.file, (got, total) => onProgress({ index: i, count: items.length, label: it.label, got, total }));
    if (it.unpack && !fs.existsSync(piperExe())) { execFileSync('tar', ['-xf', it.file, '-C', BIN]); if (process.platform !== 'win32') fs.chmodSync(piperExe(), 0o755); fs.rmSync(it.file, { force: true }); }
    onProgress({ index: i + 1, count: items.length, label: it.label, got: 1, total: 1 });
  }
  return setupStatus();
}

// English voices (only when an English video is made, or from Settings): 2 Piper voices + 6 Kokoro voices (~130 MB)
const HF_EN = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/';
export const EN_PIPER = ['ryan', 'amy'], EN_KOKORO = ['am_michael', 'am_fenrir', 'bm_george', 'af_heart', 'af_bella', 'bf_emma'];
function planEnglish() {
  const items = [];
  for (const v of EN_PIPER) { const n = `en_US-${v}-medium`; items.push({ url: `${HF_EN}${v}/medium/${n}.onnx.json`, file: path.join(VOICES_DIR, n + '.onnx.json'), label: n + ' (info)' }, { url: `${HF_EN}${v}/medium/${n}.onnx`, file: path.join(VOICES_DIR, n + '.onnx'), label: 'English voice: ' + v }); }
  for (const v of EN_KOKORO) items.push({ url: KOKORO + `voices/${v}.bin`, file: path.join(VOICES_DIR, 'kokoro', v + '.bin'), label: 'Kokoro English: ' + v });
  return items;
}
export const englishReady = () => planEnglish().every((i) => have(i.file));
export async function ensureEnglish(onProgress = () => {}) {
  const items = planEnglish(); fs.mkdirSync(path.join(VOICES_DIR, 'kokoro'), { recursive: true });
  for (const [i, it] of items.entries()) {
    const sd = seedOf(it.file); if (!have(it.file) && sd && have(sd)) await fs.promises.copyFile(sd, it.file);
    if (!have(it.file)) await download(it.url, it.file, (got, total) => onProgress({ index: i, count: items.length, label: it.label, got, total }));
    if (it.file.endsWith('.onnx.json')) { const j = JSON.parse(fs.readFileSync(it.file, 'utf8')); const m = j.phoneme_id_map || {}; const bad = Object.keys(m).filter((k) => [...k].length !== 1); if (bad.length) { for (const k of bad) delete m[k]; fs.writeFileSync(it.file, JSON.stringify(j)); } } /* newer voice files list two-letter phonemes that this Piper version refuses */
    onProgress({ index: i + 1, count: items.length, label: it.label, got: 1, total: 1 });
  }
  return englishReady();
}
