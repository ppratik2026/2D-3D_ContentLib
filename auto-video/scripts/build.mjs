// Bundles the browser-side code (3D engine + Chrome renderer + character preview) with esbuild.
import { build } from 'esbuild';
import fs from 'fs';
const entries = { 'app/build/render.js': 'app/render/entry.js' };
if (fs.existsSync('app/ui/preview-entry.js')) entries['app/build/preview.js'] = 'app/ui/preview-entry.js';
for (const [out, inp] of Object.entries(entries)) {
  await build({ entryPoints: [inp], outfile: out, bundle: true, format: 'iife', platform: 'browser', target: 'chrome120', minify: true, sourcemap: false, logLevel: 'warning', loader: { '.js': 'jsx' } });
  console.log('built', out, (fs.statSync(out).size / 1e6).toFixed(2) + ' MB');
}
