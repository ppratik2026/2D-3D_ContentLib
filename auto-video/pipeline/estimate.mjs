// Time estimate shown in the UI before you start. Uses bench.json (measured on your PC by `npm run bench`) if present.
import fs from 'fs';
import path from 'path';
import { STYLES, FPS } from './config.mjs';
import { ROOT } from './paths.mjs';

export function loadBench() { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'bench.json'), 'utf8')); } catch { return null; } }

export function estimate({ style = 'toon', minutes = 1 }) {
  const bench = loadBench(); const measured = !!(bench && bench[style]);
  const spf = measured ? bench[style] : STYLES[style]?.secPerFrame ?? 0.3; // effective seconds per frame (already includes parallel tabs)
  const sec = minutes * 60; const scenes = Math.max(2, Math.round(minutes * 1.6));
  const parts = {
    story: 8 + Math.ceil(scenes / 3) * 9,       // Gemini outline + scenes (3 at a time)
    voice: 3 + sec * 0.05,                       // Piper is ~20x faster than real time
    sound: 2 + sec * 0.04,                       // music + ambience + effects in code
    prepare: 25,                                 // bundling + loading models
    render: sec * 1.12 * FPS * spf,              // +12% for title/end cards and pauses
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v)])), total: Math.round(total), measured, secPerFrame: spf };
}
export const fmt = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}h ${m}m` : m ? `${m}m ${x}s` : `${x}s`; };
