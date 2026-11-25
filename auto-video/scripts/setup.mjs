// npm run setup — downloads free 3D models, Piper TTS and Hindi voices (once).
import fs from 'fs';
import path from 'path';
import { runSetup } from '../pipeline/setup.mjs';
import { ROOT } from '../pipeline/paths.mjs';

let last = '';
const st = await runSetup(({ index, count, label, got, total }) => {
  const line = `[${index}/${count}] ${label} ${total > 1 ? Math.round((got / total) * 100) + '%' : ''}`;
  if (line !== last) { process.stdout.write('\r' + line.padEnd(70)); last = line; }
});
console.log(st.done ? '\nSetup complete.' : '\nStill missing: ' + st.missing.join(', '));
if (!fs.existsSync(path.join(ROOT, '.env')) && fs.existsSync(path.join(ROOT, '.env.example'))) { fs.copyFileSync(path.join(ROOT, '.env.example'), path.join(ROOT, '.env')); console.log('Created .env — put your Gemini key in it.'); }
