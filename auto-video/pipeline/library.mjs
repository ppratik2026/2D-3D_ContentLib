// Character library: built-in free models + your own imported .vrm / .glb / .gltf / .fbx files.
// Each character has tags (gender, age, roles, look). Gemini picks actors from this list; a scorer is the fallback.
import fs from 'fs';
import path from 'path';
import { CHARS, ASSETS } from './paths.mjs';

export const BUILTIN = [
  { id: 'vroid_c', name: 'Kabir (anime boy, jacket)', file: 'assets/AvatarSample_C.vrm', type: 'vrm', gender: 'male', age: 'young', styles: ['toon', 'anime'], tags: ['student', 'casual', 'hero'] },
  { id: 'vroid_a', name: 'Anaya (anime girl, cardigan)', file: 'assets/AvatarSample_A.vrm', type: 'vrm', gender: 'female', age: 'young', styles: ['toon', 'anime'], tags: ['student', 'sweet', 'casual'] },
  { id: 'vroid_b', name: 'Riya (anime girl, stylish)', file: 'assets/AvatarSample_B.vrm', type: 'vrm', gender: 'female', age: 'young', styles: ['toon', 'anime'], tags: ['stylish', 'bold', 'friend'] },
  { id: 'vrm_girl', name: 'Pihu (girl, t-shirt)', file: 'assets/girl.vrm', type: 'vrm', gender: 'female', age: 'young', styles: ['toon', 'anime'], tags: ['simple', 'daughter', 'student'] },
  { id: 'seed', name: 'Chintu (kid)', file: 'assets/Seed-san.vrm', type: 'vrm', gender: 'male', age: 'child', styles: ['toon', 'anime'], tags: ['kid', 'son', 'student'] },
  { id: 'rpm_male', name: 'Rahul (realistic man)', file: 'assets/readyplayer.me.glb', type: 'glb', gender: 'male', age: 'adult', styles: ['realistic'], tags: ['man', 'office', 'detective'] },
  { id: 'michelle', name: 'Maya (realistic woman)', file: 'assets/Michelle.glb', type: 'glb', gender: 'female', age: 'young', styles: ['realistic'], tags: ['woman', 'casual'] },
];

const metaFile = (id) => path.join(CHARS, id, 'character.json');
export function listCharacters() {
  const custom = [];
  for (const id of fs.existsSync(CHARS) ? fs.readdirSync(CHARS) : []) { try { custom.push({ ...JSON.parse(fs.readFileSync(metaFile(id), 'utf8')), builtin: false }); } catch {} }
  const builtin = BUILTIN.filter((c) => fs.existsSync(path.join(ASSETS, path.basename(c.file)))).map((c) => ({ ...c, builtin: true }));
  return [...custom, ...builtin];
}
export function importCharacter(src, meta = {}) {
  const ext = path.extname(src).toLowerCase(); if (!['.vrm', '.glb', '.gltf', '.fbx'].includes(ext)) throw new Error('Only .vrm, .glb, .gltf or .fbx files');
  const base = path.basename(src, ext).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24) || 'char';
  let id = 'my_' + base, k = 1; while (fs.existsSync(path.join(CHARS, id))) id = `my_${base}_${++k}`;
  const dir = path.join(CHARS, id); fs.mkdirSync(dir, { recursive: true });
  // .gltf may come with .bin/textures next to it → copy the whole folder content
  if (ext === '.gltf') for (const f of fs.readdirSync(path.dirname(src))) { const p = path.join(path.dirname(src), f); if (fs.statSync(p).isFile()) fs.copyFileSync(p, path.join(dir, f)); }
  else fs.copyFileSync(src, path.join(dir, path.basename(src)));
  const c = { id, name: meta.name || path.basename(src, ext), file: `characters/${id}/${path.basename(src)}`, type: ext === '.vrm' ? 'vrm' : ext === '.fbx' ? 'fbx' : 'glb',
    gender: meta.gender || 'male', age: meta.age || 'adult', styles: meta.styles || ['toon', 'anime', 'realistic'], tags: meta.tags || [], notes: meta.notes || '' };
  fs.writeFileSync(metaFile(id), JSON.stringify(c, null, 2)); return c;
}
export function updateCharacter(id, patch) {
  const f = metaFile(id); if (!fs.existsSync(f)) throw new Error('Built-in characters cannot be edited');
  const c = { ...JSON.parse(fs.readFileSync(f, 'utf8')), ...patch, id }; fs.writeFileSync(f, JSON.stringify(c, null, 2)); return c;
}
export function deleteCharacter(id) { if (!id.startsWith('my_')) throw new Error('Built-in characters cannot be deleted'); fs.rmSync(path.join(CHARS, id), { recursive: true, force: true }); }

export const actorsFor = (style) => listCharacters().filter((c) => (c.styles || []).includes(style));
// story characters → library actors. Uses Gemini's choice ("model") when valid, else the best tag/gender/age match.
export function assignActors(characters, style) {
  const pool = actorsFor(style); if (!pool.length) throw new Error(`No 3D characters for style "${style}". Run setup or import characters.`);
  const used = new Map(); const out = {};
  for (const ch of characters) {
    let pick = pool.find((c) => c.id === ch.model);
    if (!pick) {
      const words = `${ch.role} ${ch.personality}`.toLowerCase();
      let best = -1e9;
      for (const c of pool) {
        let s = 0;
        s += c.gender === ch.gender ? 20 : -20;
        s += c.age === ch.age ? 6 : (c.age === 'child') !== (ch.age === 'child') ? -15 : 0;
        for (const t of c.tags || []) if (words.includes(String(t).toLowerCase())) s += 4;
        s -= (used.get(c.id) || 0) * 7; if (!c.builtin) s += 2;
        if (s > best) { best = s; pick = c; }
      }
    }
    used.set(pick.id, (used.get(pick.id) || 0) + 1);
    out[ch.id] = { actor: pick.id, file: pick.file, type: pick.type, name: pick.name };
  }
  return out;
}
