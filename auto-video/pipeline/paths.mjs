// Where things live.
// Dev mode (npm start in this folder): everything inside the project.
// Desktop app: AUTOVIDEO_DATA = Documents\AutoVideo  →  Videos\, data\ (models, voices, characters), settings + queue.
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = process.env.AUTOVIDEO_DATA ? path.resolve(process.env.AUTOVIDEO_DATA) : null;
export const STATE = DATA || ROOT;                                   // settings.json, queue.json, bench.json
export const PUBLIC = DATA ? path.join(DATA, 'data') : path.join(ROOT, 'public'); // served to the renderer
export const ASSETS = path.join(PUBLIC, 'assets');
export const CHARS = path.join(PUBLIC, 'characters');
export const JOBS = path.join(PUBLIC, 'jobs');
export const BIN = DATA ? path.join(DATA, 'data', 'bin') : path.join(ROOT, 'bin');
export const VOICES_DIR = DATA ? path.join(DATA, 'data', 'voices') : path.join(ROOT, 'voices');
export const OUTPUT = DATA ? path.join(DATA, 'Videos') : path.join(ROOT, 'output');
for (const d of [STATE, PUBLIC, ASSETS, CHARS, JOBS, BIN, VOICES_DIR, OUTPUT]) fs.mkdirSync(d, { recursive: true });
