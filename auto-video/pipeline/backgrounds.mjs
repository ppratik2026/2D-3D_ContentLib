// Background library for the 2D Cartoon Stage: your own painted / AI images (Gemini, Flow…), tagged once, reused in every video.
// Each background knows where feet stand (near row / far row), how tall a character is, and optional seats.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PUBLIC } from './paths.mjs';

export const BG_DIR = path.join(PUBLIC, 'backgrounds');
fs.mkdirSync(BG_DIR, { recursive: true });
export const PLACES = {
  village_street: 'village lane / chaupal / outside huts', village_house_out: 'outside a village house (courtyard, charpai)', house_inside: 'inside a simple house / kitchen',
  rich_house: 'haveli / rich house / living room', field: 'farm field / khet', forest: 'forest / jungle', river: 'river / pond / ghat', temple: 'temple / mandir',
  market: 'market / bazaar / shop', city_street: 'city road / street', school: 'school / classroom', hospital: 'hospital', police: 'police station',
  office: 'office', cafe: 'tea stall / cafe / dhaba', haunted: 'old haunted house / ruins', graveyard: 'cremation ground / graveyard', road_night: 'lonely road at night',
  railway: 'railway station / train', palace: 'palace / court (king story)',
  jail: 'jail / lock-up', court: 'court room', lab: 'laboratory / forensic lab', bank: 'bank', restaurant: 'restaurant / dhaba inside', hotel: 'hotel room', shop: 'shop inside',
  highway: 'highway / long road (chases)', lane: 'narrow lane / galli (foot chases)', bus_stand: 'bus stand', college: 'college / hostel', other: 'other',
};
const meta = (id) => path.join(BG_DIR, id, 'background.json');
// starter backgrounds shipped with the app (flat explainer set): copied once; deleting one later keeps it deleted
export function seedStarter() { const src = path.join(path.dirname(fileURLToPath(import.meta.url)), 'starter', 'backgrounds'); /* fileURLToPath: works with spaces in the install folder */ const done = path.join(BG_DIR, '.starter.json');
  try { const seen = fs.existsSync(done) ? JSON.parse(fs.readFileSync(done, 'utf8')) : []; let changed = false;
    for (const id of fs.existsSync(src) ? fs.readdirSync(src) : []) { if (seen.includes(id)) continue; if (!fs.existsSync(path.join(BG_DIR, id))) fs.cpSync(path.join(src, id), path.join(BG_DIR, id), { recursive: true }); seen.push(id); changed = true; }
    if (changed) fs.writeFileSync(done, JSON.stringify(seen)); } catch (e) { console.warn('starter backgrounds:', e.message); } }
seedStarter();
export function listBackgrounds() {
  if (!fs.readdirSync(BG_DIR).some((d) => d.startsWith('bg_'))) seedStarter(); // nothing yet: copy the ready-made set
  const out = [];
  for (const id of fs.readdirSync(BG_DIR)) { try { out.push(JSON.parse(fs.readFileSync(meta(id), 'utf8'))); } catch {} }
  return out.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}
export function importBackground(src, m = {}) {
  const ext = path.extname(src).toLowerCase(); if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) throw new Error('Only .jpg, .png or .webp images');
  const base = path.basename(src, ext).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24) || 'bg';
  let id = 'bg_' + base, k = 1; while (fs.existsSync(path.join(BG_DIR, id))) id = `bg_${base}_${++k}`;
  fs.mkdirSync(path.join(BG_DIR, id), { recursive: true }); const file = 'image' + ext; fs.copyFileSync(src, path.join(BG_DIR, id, file));
  const guess = (re) => re.test(base);
  const b = { id, name: m.name || path.basename(src, ext), file: `backgrounds/${id}/${file}`,
    place: m.place || (guess(/police|thana/) ? 'police' : guess(/village|gaon|gav/) ? 'village_street' : guess(/field|khet/) ? 'field' : guess(/forest|jungle/) ? 'forest' : guess(/market|bazar/) ? 'market' : guess(/school|class/) ? 'school' : guess(/temple|mandir/) ? 'temple' : guess(/house|ghar|room|kitchen/) ? 'house_inside' : 'other'),
    time: m.time || (guess(/night|raat/) ? 'night' : guess(/evening|shaam/) ? 'evening' : 'day'), indoor: !!m.indoor, tags: m.tags || [],
    groundNear: 0.93, groundFar: 0.74, heightNear: 0.62, seats: [] };
  fs.writeFileSync(meta(id), JSON.stringify(b, null, 2)); return b;
}
export function updateBackground(id, patch) { const f = meta(id); const b = { ...JSON.parse(fs.readFileSync(f, 'utf8')), ...patch, id }; fs.writeFileSync(f, JSON.stringify(b, null, 2)); return b; }
export function deleteBackground(id) { if (!/^bg_/.test(id)) throw new Error('bad id'); fs.rmSync(path.join(BG_DIR, id), { recursive: true, force: true }); }
// best background for a scene when the AI's choice is missing
export function pickBackground(list, want = {}) {
  let best = null, bs = -1e9;
  for (const b of list) { let s = 0; if (b.id === want.background) s += 100; if (b.place === want.place) s += 30; if (b.time === want.time) s += 10; if (want.text) for (const t of [...(b.tags || []), b.name]) if (String(want.text).toLowerCase().includes(String(t).toLowerCase())) s += 3; if (want.weather === 'snow') s += /snow|hill|mountain|pahad|barf|himal/i.test([b.name, ...(b.tags || [])].join(' ')) ? 40 : -20; s -= (want.used?.get(b.id) || 0) * 2; if (s > bs) { bs = s; best = b; } }
  return best;
}
