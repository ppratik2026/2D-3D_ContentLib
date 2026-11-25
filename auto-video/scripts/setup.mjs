// One-time setup: downloads free 3D models, the Piper TTS program and Hindi voices.
// Run: npm run setup
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { ROOT } from '../pipeline/paths.mjs';

const ASSETS = path.join(ROOT, 'public', 'assets'), BIN = path.join(ROOT, 'bin'), VOICES = path.join(ROOT, 'voices');
for (const d of [ASSETS, BIN, VOICES]) fs.mkdirSync(d, { recursive: true });
const T = 'https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/';
const FILES = [
  [T + 'models/gltf/Soldier.glb', 'Soldier.glb'],                 // animations (walk/idle/run) + rig
  [T + 'models/gltf/Michelle.glb', 'Michelle.glb'],               // realistic female
  [T + 'models/gltf/readyplayer.me.glb', 'readyplayer.me.glb'],   // realistic male
  [T + 'textures/equirectangular/venice_sunset_1k.hdr', 'venice_sunset_1k.hdr'],
  ['https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/stable/AvatarSample_A.vrm', 'AvatarSample_A.vrm'],
  ['https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/stable/AvatarSample_B.vrm', 'AvatarSample_B.vrm'],
  ['https://raw.githubusercontent.com/madjin/vrm-samples/master/vroid/stable/AvatarSample_C.vrm', 'AvatarSample_C.vrm'],
  ['https://raw.githubusercontent.com/pixiv/three-vrm/dev/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm', 'girl.vrm'],
  ['https://raw.githubusercontent.com/vrm-c/vrm-specification/master/samples/Seed-san/vrm/Seed-san.vrm', 'Seed-san.vrm'],
];
const HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/hi/hi_IN/';
const VOICE_LIST = ['pratham', 'rohan', 'priyamvada'];
const PIPER = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/';
const PIPER_FILE = { 'win32-x64': 'piper_windows_amd64.zip', 'linux-x64': 'piper_linux_x86_64.tar.gz', 'linux-arm64': 'piper_linux_aarch64.tar.gz', 'darwin-x64': 'piper_macos_x64.tar.gz', 'darwin-arm64': 'piper_macos_aarch64.tar.gz' }[`${process.platform}-${process.arch}`];

async function get(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) { console.log('  ok  ', path.basename(file)); return; }
  process.stdout.write('  get ' + path.basename(file) + ' ... ');
  const r = await fetch(url, { redirect: 'follow' }); if (!r.ok) throw new Error(`${r.status} for ${url}`);
  const buf = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(file + '.part', buf); fs.renameSync(file + '.part', file);
  console.log((buf.length / 1e6).toFixed(1) + ' MB');
}

console.log('1/3  3D models');
for (const [u, f] of FILES) await get(u, path.join(ASSETS, f));
console.log('2/3  Piper TTS (offline voice engine)');
if (!PIPER_FILE) console.log('  !! No Piper build for this OS/CPU. Install it yourself and set PIPER_BIN in .env');
else {
  const arc = path.join(BIN, PIPER_FILE); await get(PIPER + PIPER_FILE, arc);
  const exe = path.join(BIN, 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
  if (!fs.existsSync(exe)) { execFileSync('tar', ['-xf', arc, '-C', BIN]); console.log('  unpacked', exe); }
  if (process.platform !== 'win32') fs.chmodSync(exe, 0o755);
}
console.log('3/3  Hindi voices');
for (const v of VOICE_LIST) { const n = `hi_IN-${v}-medium`; await get(`${HF}${v}/medium/${n}.onnx.json`, path.join(VOICES, n + '.onnx.json')); await get(`${HF}${v}/medium/${n}.onnx`, path.join(VOICES, n + '.onnx')); }
if (!fs.existsSync(path.join(ROOT, '.env'))) { fs.copyFileSync(path.join(ROOT, '.env.example'), path.join(ROOT, '.env')); console.log('\nCreated .env — put your Gemini key in it.'); }
console.log('\nSetup complete. Start the app with:  npm start');
