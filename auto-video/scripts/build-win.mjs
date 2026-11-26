// Builds the Windows installer (AutoVideoStudio-Setup.exe) — works from Linux/Mac/Windows.
// 1) bundles browser code, 2) stages the app with Windows node_modules, 3) electron-builder → NSIS installer in dist/.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const STAGE = path.join(ROOT, 'dist-stage'); const OUT = path.join(ROOT, 'dist');
const run = (cmd, opts = {}) => { console.log('>', cmd); execSync(cmd, { stdio: 'inherit', ...opts }); };

run('node scripts/build.mjs', { cwd: ROOT });
fs.rmSync(STAGE, { recursive: true, force: true }); fs.mkdirSync(STAGE, { recursive: true });
for (const d of ['app', 'pipeline', 'remotion']) fs.cpSync(path.join(ROOT, d), path.join(STAGE, d), { recursive: true });
if (fs.existsSync(path.join(ROOT, 'seed'))) fs.cpSync(path.join(ROOT, 'seed'), path.join(STAGE, 'seed'), { recursive: true }); // voices, models, Piper: first run copies them, no download
fs.copyFileSync(path.join(ROOT, 'README.md'), path.join(STAGE, 'README.md'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const electronVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/electron/package.json'), 'utf8')).version;
const stagePkg = { name: pkg.name, productName: pkg.productName, version: pkg.version, description: pkg.description, author: 'Auto Video Studio', type: 'module', main: pkg.main, dependencies: pkg.dependencies };
fs.writeFileSync(path.join(STAGE, 'package.json'), JSON.stringify(stagePkg, null, 2));
// Windows binaries for every platform-specific package (Remotion compositor, esbuild, ffmpeg-static)
run('npm install --omit=dev --no-audit --no-fund --ignore-scripts --os=win32 --cpu=x64', { cwd: STAGE });
// ffmpeg.exe (install scripts are skipped, so fetch the Windows build that ffmpeg-static expects)
const ff = path.join(STAGE, 'node_modules/ffmpeg-static/ffmpeg.exe');
if (!fs.existsSync(ff)) {
  const meta = JSON.parse(fs.readFileSync(path.join(STAGE, 'node_modules/ffmpeg-static/package.json'), 'utf8'))['ffmpeg-static'];
  const url = `https://github.com/eugeneware/ffmpeg-static/releases/download/${meta['binary-release-tag']}/ffmpeg-win32-x64.gz`;
  console.log('> download', url);
  const r = await fetch(url); if (!r.ok) throw new Error('ffmpeg download failed ' + r.status);
  const { gunzipSync } = await import('zlib'); fs.writeFileSync(ff, gunzipSync(Buffer.from(await r.arrayBuffer())));
}
const cfg = {
  appId: 'studio.autovideo.app', productName: 'Auto Video Studio', electronVersion, asar: false, compression: 'normal',
  directories: { output: OUT, buildResources: path.join(ROOT, 'build-res') },
  files: ['**/*', '!**/*.map', '!**/test/**', '!**/tests/**', '!**/*.md', 'README.md'],
  win: { target: [{ target: 'nsis', arch: ['x64'] }], signAndEditExecutable: false, artifactName: 'AutoVideoStudio-Setup-${version}.${ext}' },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: true, shortcutName: 'Auto Video Studio' },
  publish: [{ provider: 'github', owner: 'ppratik2026', repo: '2D-3D_ContentLib', releaseType: 'release' }],
};
fs.writeFileSync(path.join(STAGE, 'electron-builder.json'), JSON.stringify(cfg, null, 2));
const target = process.argv.includes('--dir') ? 'dir' : 'nsis'; // --dir = unpacked folder only (no installer)
const publish = process.argv.includes('--publish') ? 'always' : 'never'; // --publish: upload installer + latest.yml to a GitHub Release (needs GH_TOKEN)
run(`npx electron-builder --win ${target} --x64 --projectDir "${STAGE}" --config electron-builder.json --publish ${publish}`, { cwd: ROOT });
console.log('\nOutput:', fs.readdirSync(OUT).map((f) => path.join(OUT, f)).join('\n'));
