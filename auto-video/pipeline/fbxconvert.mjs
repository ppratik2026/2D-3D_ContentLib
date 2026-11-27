// Old FBX files (FBX 6.x, e.g. "FileVersion: 6100") cannot be read by the 3D loader (it needs FBX 7+).
// They are converted once to .glb with the free FBX2glTF tool (Godot build, uses the Autodesk FBX SDK which still reads FBX 6),
// downloaded the first time it is needed.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, execFileSync } from 'child_process';
import { BIN } from './paths.mjs';

const REL = 'https://github.com/godotengine/FBX2glTF/releases/download/v0.13.1/';
const PKG = { win32: 'FBX2glTF-windows-x86_64', linux: 'FBX2glTF-linux-x86_64', darwin: 'FBX2glTF-macos-x86_64' }[process.platform];
const DIR = path.join(BIN, 'fbx2gltf');
const exe = () => path.join(DIR, PKG, PKG + (process.platform === 'win32' ? '.exe' : ''));

// FBX version number (6100, 7400…) from a binary or ASCII .fbx, or 0 if unknown
export function fbxVersion(file) {
  const fd = fs.openSync(file, 'r'); const b = Buffer.alloc(65536); const n = fs.readSync(fd, b, 0, b.length, 0); fs.closeSync(fd);
  if (b.slice(0, 18).toString('latin1') === 'Kaydara FBX Binary') return b.readUInt32LE(23);
  const m = b.slice(0, n).toString('latin1').match(/FBXVersion:\s*(\d+)/) || b.slice(0, n).toString('latin1').match(/FBX (\d)\.(\d)\.\d project file/);
  return m ? (m[2] !== undefined ? +m[1] * 1000 + +m[2] * 100 : +m[1]) : 0;
}
export const needsConvert = (file) => /\.fbx$/i.test(file) && (() => { const v = fbxVersion(file); return v > 0 && v < 7000; })();

async function ensureTool(onLog) {
  if (fs.existsSync(exe())) return exe();
  if (!PKG) throw new Error('Old FBX files can only be converted on Windows / Linux / macOS (x64).');
  fs.mkdirSync(DIR, { recursive: true }); const zip = path.join(DIR, PKG + '.zip');
  onLog('Downloading the FBX converter (one time, ~4 MB)…');
  const r = await fetch(REL + PKG + '.zip', { redirect: 'follow' }); if (!r.ok) throw new Error(`Could not download the FBX converter (${r.status})`);
  fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
  execFileSync('tar', ['-xf', zip, '-C', DIR]); fs.rmSync(zip, { force: true }); /* Windows 10+ tar opens .zip */
  if (process.platform !== 'win32') fs.chmodSync(exe(), 0o755);
  if (!fs.existsSync(exe())) throw new Error('FBX converter files missing after download');
  return exe();
}

// src.fbx → a new .glb in a temp folder (returns its path)
export async function convertFbx(src, onLog = () => {}) {
  const tool = await ensureTool(onLog); const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'avfbx-'));
  const base = path.basename(src, path.extname(src)); const out = path.join(tmp, base);
  onLog(`Converting old FBX (version ${fbxVersion(src)}) to GLB…`);
  await new Promise((ok, fail) => { const p = spawn(tool, ['--binary', '--input', src, '--output', out], { windowsHide: true }); let err = '';
    p.stdout.on('data', (d) => (err = (err + d).slice(-2000))); p.stderr.on('data', (d) => (err = (err + d).slice(-2000))); p.on('error', fail);
    p.on('close', (c) => (c === 0 && fs.existsSync(out + '.glb') ? ok() : fail(new Error('FBX conversion failed: ' + err.trim().split('\n').slice(-3).join(' ').slice(0, 300))))); });
  return out + '.glb';
}
