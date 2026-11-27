// Auto Video Studio — Electron main process.
// Data lives in Documents\AutoVideo (Videos\, data\ for models/voices/characters, settings.json, queue.json).
import { app, BrowserWindow, ipcMain, protocol, net, dialog, shell, safeStorage } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { Readable } from 'stream';
import { pathToFileURL, fileURLToPath } from 'url';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.AUTOVIDEO_DATA ||= path.join(app.getPath('documents'), 'AutoVideo');
protocol.registerSchemesAsPrivileged([{ scheme: 'av', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
if (process.argv.includes('--cpu')) app.commandLine.appendSwitch('use-angle', 'swiftshader');

const { PUBLIC, OUTPUT, STATE, CHARS } = await import('../pipeline/paths.mjs');
const { CATEGORIES, STYLES, LOOKS, SUBTITLE_STYLES } = await import('../pipeline/config.mjs');
const { estimate, fmt } = await import('../pipeline/estimate.mjs');
const { makeVideo, newJobId } = await import('../pipeline/run.mjs');
const { setupStatus, runSetup } = await import('../pipeline/setup.mjs');
const lib = await import('../pipeline/library.mjs');
const bgs = await import('../pipeline/backgrounds.mjs');
const tts = await import('../pipeline/tts.mjs');
const ffmpegPath = (await import('ffmpeg-static')).default;
const { autoUpdater } = (await import('electron-updater')).default;

// ---------- auto update (installed version, from GitHub Releases) ----------
let upd = { state: 'idle', current: app.getVersion() };
const sendUpd = (patch) => { upd = { ...upd, ...patch, current: app.getVersion() }; for (const w of BrowserWindow.getAllWindows()) if (w.__ui) w.webContents.send('update', upd); };
autoUpdater.autoDownload = false; autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('checking-for-update', () => sendUpd({ state: 'checking' }));
autoUpdater.on('update-available', (i) => sendUpd({ state: 'available', version: i.version }));
autoUpdater.on('update-not-available', () => sendUpd({ state: 'latest', version: app.getVersion() }));
autoUpdater.on('download-progress', (p) => sendUpd({ state: 'downloading', percent: Math.round(p.percent) }));
autoUpdater.on('update-downloaded', (i) => sendUpd({ state: 'ready', version: i.version }));
autoUpdater.on('error', (e) => sendUpd({ state: 'error', msg: /app-update\.yml|ENOENT/.test(String(e)) ? 'Auto-update works in the installed version (AutoVideoStudio-Setup.exe), not in the ZIP version.' : String(e.message || e).slice(0, 200) }));
const ZIP_MSG = 'This is the ZIP version — auto-update only works in the installed version. Install AutoVideoStudio-Setup.exe once (from GitHub → Releases); after that updates come here.';
const isZip = () => app.isPackaged && !fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
async function checkUpdates() { if (!app.isPackaged) { sendUpd({ state: 'dev' }); return upd; } if (isZip()) { sendUpd({ state: 'error', msg: ZIP_MSG }); return upd; }
  try { await autoUpdater.checkForUpdates(); } catch (e) { sendUpd({ state: 'error', msg: /app-update\.yml|ENOENT/.test(String(e)) ? ZIP_MSG : String(e.message || e).slice(0, 200) }); } return upd; }

// ---------- settings (Gemini key encrypted with Windows DPAPI / OS keychain when available) ----------
const SETTINGS = path.join(STATE, 'settings.json');
const DEFAULTS = { model: 'gemini-2.5-flash', renderer: 'chrome', concurrency: 2, keyEnc: '', keyPlain: '' };
function readSettings() { try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) }; } catch { return { ...DEFAULTS }; } }
function writeSettings(s) { fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2)); }
function getKey() { const s = readSettings(); try { if (s.keyEnc && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(s.keyEnc, 'base64')); } catch {} return s.keyPlain || process.env.GEMINI_API_KEY || ''; }
function setKey(k) { const s = readSettings(); k = String(k || '').trim(); if (safeStorage.isEncryptionAvailable()) { s.keyEnc = k ? safeStorage.encryptString(k).toString('base64') : ''; s.keyPlain = ''; } else { s.keyPlain = k; s.keyEnc = ''; } writeSettings(s); }
const publicSettings = () => { const s = readSettings(); const k = getKey() || ['groq', 'openrouter', 'mistral', 'cerebras', 'custom'].map((n) => dec((s.ai?.providers || {})[n])).find(Boolean) || ''; return { model: s.model, renderer: s.renderer, concurrency: s.concurrency, hasSubStyle: !!s.subStyle, hasKey: !!k, keyHint: k ? k.slice(0, 4) + '…' + k.slice(-4) : '', dataDir: process.env.AUTOVIDEO_DATA }; };

// ---------- Story AI providers (one key per provider, encrypted) ----------
const ai = await import('../pipeline/ai.mjs');
const ORDER = ['gemini', 'groq', 'openrouter', 'mistral', 'cerebras', 'custom'];
const enc = (k) => (k && safeStorage.isEncryptionAvailable() ? { keyEnc: safeStorage.encryptString(k).toString('base64') } : { keyPlain: k || '' });
const dec = (c) => { try { if (c?.keyEnc && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(c.keyEnc, 'base64')); } catch {} return c?.keyPlain || ''; };
function aiConf() { const s = readSettings(); const a = s.ai || { primary: 'gemini', fallback: true, providers: {} };
  if (!a.providers.gemini && (s.keyEnc || s.keyPlain)) a.providers.gemini = { keyEnc: s.keyEnc, keyPlain: s.keyPlain, model: s.model }; // migrate old Gemini key
  return a; }
function saveAi(a) { const s = readSettings(); s.ai = a; writeSettings(s); }

// ---------- team licence (Supabase): 1 key = 1 PC, admin can block / log out; shared data packs ----------
const team = await import('./team.mjs');
const NO_LICENSE = !app.isPackaged && process.env.AVS_NO_LICENSE === '1'; // developer runs only
let LIC = { ok: NO_LICENSE, name: NO_LICENSE ? 'Developer' : '', msg: '', offline: false, pack: 0 };
const sendAll = (ch, v) => { for (const w of BrowserWindow.getAllWindows()) if (w.__ui) w.webContents.send(ch, v); };
const teamSrv = () => { const s = readSettings(); try { return s.team?.code ? team.decodeServer(s.team.code) : null; } catch { return null; } };
const teamView = () => { const s = readSettings(); return { ok: LIC.ok, name: LIC.name, msg: LIC.msg, offline: LIC.offline, serverPack: LIC.pack, localPack: team.localPackVersion(STATE), hasServer: !!teamSrv(), code: s.team?.code || '', device: team.deviceInfo().name, admin: !!dec(s.team?.adm), adminUrl: s.team?.adminUrl || '', dev: NO_LICENSE }; };
function logout(msg) {
  const s = readSettings(); delete s.lic; writeSettings(s); LIC = { ...LIC, ok: false, name: '', msg: msg || '' };
  autoRun = false; if (running) { abort?.abort(); } broadcast(true); sendAll('team', teamView());
}
async function licCheck() {
  if (NO_LICENSE) return true; const s = readSettings(); const key = dec(s.lic); const srv = teamSrv();
  if (!key || !srv) { LIC = { ...LIC, ok: false }; sendAll('team', teamView()); return false; }
  try { const r = await team.checkLicense(srv, key, app.getVersion());
    if (r.logout_at && s.lic.loginAt && new Date(r.logout_at).getTime() > s.lic.loginAt) { logout('The admin logged this PC out. Sign in again with your key.'); return false; }
    const n = readSettings(); n.lic = { ...n.lic, lastOk: Date.now(), name: r.name }; writeSettings(n);
    LIC = { ok: true, name: r.name, msg: '', offline: false, pack: r.pack }; sendAll('team', teamView()); return true; }
  catch (e) { if (e.offline && s.lic.lastOk && Date.now() - s.lic.lastOk < team.GRACE_H * 3600e3) { LIC = { ...LIC, ok: true, name: s.lic.name || '', offline: true, msg: '' }; sendAll('team', teamView()); return true; }
    if (e.offline) { LIC = { ...LIC, ok: false, msg: `No internet for more than ${team.GRACE_H} hours. Connect to the internet to continue.` }; autoRun = false; sendAll('team', teamView()); return false; }
    logout(e.message); return false; }
}
setInterval(() => { licCheck().catch(() => {}); }, 10 * 60 * 1000);
async function teamSync(e) {
  const s = readSettings(); const srv = teamSrv(); if (!srv) throw new Error('No team server set.');
  sendAll('busy', { title: 'Updating team data (backgrounds, characters)…', i: 0, n: 0, label: 'Connecting…' });
  try { const r = await team.syncPack({ srv, licenseKey: dec(s.lic), PUBLIC, STATE, onProgress: (i, n, label) => { if (e) e.sender.send('team:progress', { i, n, label }); sendAll('busy', { title: 'Updating team data (backgrounds, characters)…', i, n, label }); } });
  sendAll('team', teamView()); return r; } finally { sendAll('busy', { done: true }); }
}
const admKey = () => { const k = dec(readSettings().team?.adm); if (!k) throw new Error('Admin key not set (Settings → Team → Admin).'); return k; };
const ADM_KEYS = path.join(STATE, 'admin-keys.json'); // full keys the admin created on this PC (encrypted), so they can be copied again
const admKeysRead = () => { try { return JSON.parse(fs.readFileSync(ADM_KEYS, 'utf8')); } catch { return {}; } };
const provKey = (name) => dec(aiConf().providers[name]);
function aiView() { const a = aiConf(); return { primary: a.primary, fallback: a.fallback !== false, providers: Object.fromEntries(ORDER.map((n) => { const c = a.providers[n] || {}; const k = dec(c);
  return [n, { ...ai.PROVIDERS[n], hasKey: !!k, keyHint: k ? k.slice(0, 4) + '…' + k.slice(-4) : '', model: c.model || '', baseUrl: c.baseUrl || '' }]; })) }; }
// story AI chain for a job: chosen provider first, then (if fallback on) every other provider that has a key
async function buildChain(choice) {
  const a = aiConf(); const first = choice && choice !== 'auto' ? choice : a.primary || 'gemini';
  const names = [first, ...(a.fallback !== false ? ORDER.filter((n) => n !== first) : [])].filter((n) => provKey(n));
  const chain = [];
  for (const n of names) { const c = a.providers[n] || {}; const p = { provider: n, key: dec(c), baseUrl: c.baseUrl };
    let ids = []; try { ids = await ai.listModels(p); } catch {}
    const ranked = ai.rankModels(n, ids); const models = [c.model && (ids.includes(c.model) || !ids.length) ? c.model : null, ranked[0], n === 'gemini' ? ranked.find((x) => /flash-lite/.test(x)) : null].filter(Boolean);
    for (const m of [...new Set(models)].slice(0, 2)) chain.push({ ...p, model: m }); }
  return chain;
}

// ---------- queue ----------
const QFILE = path.join(STATE, 'queue.json');
let queue = []; try { queue = JSON.parse(fs.readFileSync(QFILE, 'utf8')); for (const j of queue) if (j.status === 'running') j.status = 'queued'; } catch {}
let running = null, autoRun = false, abort = null, lastSave = 0;
const SESSION = Date.now();
for (const j of queue) if (j.status === 'queued') j.session = SESSION;
const saveQueue = () => fs.writeFileSync(QFILE, JSON.stringify(queue, null, 2));
function broadcast(force) { const now = Date.now(); if (!force && now - lastSave < 700) return; lastSave = now; saveQueue(); for (const w of BrowserWindow.getAllWindows()) if (w.__ui) w.webContents.send('queue', queueView()); }
function queueView() {
  let remain = 0; for (const j of queue) { if (j.status === 'queued') remain += j.estimate?.total || 0; if (j.status === 'running') remain += j.eta ?? (j.estimate?.total || 0) * (1 - (j.progress || 0)); }
  const active = queue.filter((j) => ['queued', 'running', 'done', 'error'].includes(j.status) && (j.session === SESSION));
  const counts = { total: active.length, done: active.filter((j) => j.status === 'done').length, failed: active.filter((j) => j.status === 'error').length, waiting: queue.filter((j) => j.status === 'queued').length, current: running ? active.indexOf(running) + 1 : 0 };
  return { jobs: queue, running: !!running, autoRun, counts, remainSec: Math.round(remain), remainText: fmt(remain), finishAt: remain ? new Date(Date.now() + remain * 1000).toISOString() : null };
}
const STAGES = ['story', 'voice', 'sound', 'render', 'save'];
let wakeTimer = null;
async function pump() {
  if (running || !autoRun) return; if (!LIC.ok) { autoRun = false; broadcast(true); return; }
  const now = Date.now(); const ready = queue.find((j) => j.status === 'queued' && !(j.retryAt > now));
  if (!ready) { const waiting = queue.filter((j) => j.status === 'queued'); if (!waiting.length) { autoRun = false; broadcast(true); return; }
    clearTimeout(wakeTimer); wakeTimer = setTimeout(pump, Math.max(1000, Math.min(...waiting.map((j) => j.retryAt || now)) - now)); broadcast(true); return; }
  if (!NO_LICENSE && !(await licCheck())) return;
  const job = ready; running = job; job.status = 'running'; job.started = Date.now(); job.error = null; job.retryAt = null; job.progress = 0; job.eta = null;
  job.stages = Object.fromEntries(STAGES.map((k) => [k, { state: 'todo', done: 0, total: 0, label: '' }])); abort = new AbortController(); broadcast(true);
  const s = readSettings();
  try {
    const chain = job.opts.storyJson || job.opts.demo ? [] : await buildChain(job.opts.storyAI);
    const r = await makeVideo({ ...job.opts, id: job.id, chain, ffmpegPath, renderer: s.renderer, concurrency: s.concurrency, renderFn: s.renderer === 'remotion' ? null : chromeRender },
      (e) => { Object.assign(job, { step: e.step, msg: e.msg, elapsed: e.elapsed }); if (e.progress != null) job.progress = e.progress; if (e.eta != null) job.eta = e.eta; if (e.estimate) job.estimate = e.estimate; if (e.title) job.title = e.title; if (e.duration) job.duration = e.duration;
        if (e.stage && job.stages[e.stage.name]) { const i = STAGES.indexOf(e.stage.name); STAGES.forEach((k, j) => { if (j < i) job.stages[k].state = 'done'; });
          Object.assign(job.stages[e.stage.name], { state: e.stage.total && e.stage.done >= e.stage.total ? 'done' : 'active', done: e.stage.done, total: e.stage.total, label: e.stage.label }); }
        broadcast(); },
      { signal: abort.signal });
    STAGES.forEach((k) => (job.stages[k].state = 'done'));
    Object.assign(job, { status: 'done', folder: r.folder, file: r.file, title: r.story.title, progress: 1, finished: Date.now(), elapsed: (Date.now() - job.started) / 1000 });
  } catch (e) {
    const msg = String(e.message || e);
    if (abort.signal.aborted) Object.assign(job, { status: 'cancelled', error: 'Cancelled' });
    else if (e.retryable && (job.autoRetries || 0) < 3) { job.autoRetries = (job.autoRetries || 0) + 1; const wait = 3 * 60e3 * job.autoRetries;
      Object.assign(job, { status: 'queued', retryAt: Date.now() + wait, error: msg, msg: `Gemini busy — automatic retry ${job.autoRetries}/3 at ${new Date(Date.now() + wait).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` }); }
    else Object.assign(job, { status: 'error', error: msg });
    if (job.stages) for (const k of STAGES) if (job.stages[k].state === 'active') job.stages[k].state = job.status === 'queued' ? 'todo' : 'failed';
    console.error(e);
  }
  running = null; abort = null; broadcast(true); pump();
}

// ---------- Chrome renderer: hidden window → WebCodecs chunks → file → ffmpeg adds audio ----------
const sessions = new Map();
ipcMain.on('render:ready', (e) => sessions.get(e.sender.id)?.ready());
ipcMain.handle('render:chunk', (e, pos, data) => sessions.get(e.sender.id)?.chunk(pos, data));
ipcMain.on('render:progress', (e, f, n, secs) => sessions.get(e.sender.id)?.progress(f, n, secs));
ipcMain.on('render:done', (e, info) => sessions.get(e.sender.id)?.done(info));
ipcMain.on('render:fail', (e, msg) => sessions.get(e.sender.id)?.fail(msg));
function chromeRender({ tl, mixFile, out, onProgress, onSave = () => {}, signal, only = null }) {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({ show: false, width: 1280, height: 720, webPreferences: { preload: path.join(APP_DIR, 'app', 'render', 'preload.cjs'), backgroundThrottling: false } });
    const id = win.webContents.id; const tmp = out + '.video.mp4'; const fd = fs.openSync(tmp, 'w'); let finished = false;
    const end = (err, val) => { if (finished) return; finished = true; sessions.delete(id); try { fs.closeSync(fd); } catch {} if (!win.isDestroyed()) win.destroy(); err ? reject(err) : resolve(val); };
    signal?.addEventListener('abort', () => end(new Error('Cancelled')));
    win.webContents.on('render-process-gone', (_e, d) => end(new Error('Renderer crashed: ' + d.reason)));
    win.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) console.log('[render]', msg); });
    sessions.set(id, {
      ready: () => win.webContents.send('render:job', { tl, only }),
      chunk: (pos, data) => { const b = Buffer.from(data.buffer || data, data.byteOffset || 0, data.byteLength); fs.writeSync(fd, b, 0, b.length, pos); },
      progress: (f, n, secs) => onProgress(f / n, f, secs),
      fail: (msg) => end(new Error(msg)),
      done: async (info) => { if (only) return end(null, info); try { fs.closeSync(fd); } catch {} onSave();
        try { await ffmpeg(['-y', '-i', tmp, '-i', mixFile, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]); fs.rmSync(tmp, { force: true }); end(null, info); }
        catch (e) { end(e); } },
    });
    win.loadURL('av://app/app/render/render.html').catch((e) => end(e));
  });
}
function ffmpeg(args) { return new Promise((ok, fail) => { const p = spawn(ffmpegPath, args); let err = ''; p.stderr.on('data', (d) => (err = (err + d).slice(-2000))); p.on('error', fail); p.on('close', (c) => (c === 0 ? ok() : fail(new Error('ffmpeg failed: ' + err)))); }); }

// ---------- av:// protocol: app files, data (models, characters, jobs) and finished videos (with Range for seeking) ----------
function serve() {
  protocol.handle('av', async (req) => {
    const u = new URL(req.url); const base = { app: APP_DIR, data: PUBLIC, videos: OUTPUT }[u.hostname]; if (!base) return new Response('no', { status: 404 });
    const file = path.resolve(base, decodeURIComponent(u.pathname).replace(/^\/+/, '')); if (!file.startsWith(path.resolve(base)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response('not found', { status: 404 });
    const size = fs.statSync(file).size; const range = req.headers.get('range'); const type = file.endsWith('.mp4') ? 'video/mp4' : undefined;
    if (range) { const m = /bytes=(\d*)-(\d*)/.exec(range); const start = m[1] ? +m[1] : 0, endB = m[2] ? +m[2] : size - 1;
      return new Response(Readable.toWeb(fs.createReadStream(file, { start, end: endB })), { status: 206, headers: { 'Content-Range': `bytes ${start}-${endB}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': String(endB - start + 1), ...(type ? { 'Content-Type': type } : {}) } }); }
    if (type) return new Response(Readable.toWeb(fs.createReadStream(file)), { headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' } });
    return net.fetch(pathToFileURL(file).toString());
  });
}

// ---------- UI IPC ----------
function libraryList() {
  if (!fs.existsSync(OUTPUT)) return [];
  return fs.readdirSync(OUTPUT).filter((d) => !d.startsWith('.') && fs.existsSync(path.join(OUTPUT, d, 'final.mp4'))).map((d) => {
    let story = {}; try { story = JSON.parse(fs.readFileSync(path.join(OUTPUT, d, 'story.json'), 'utf8')); } catch {}
    const st = fs.statSync(path.join(OUTPUT, d, 'final.mp4'));
    return { dir: d, title: story.title || d, category: story.category, created: st.mtimeMs, sizeMB: +(st.size / 1e6).toFixed(1), video: `av://videos/${encodeURIComponent(d)}/final.mp4` };
  }).sort((a, b) => b.created - a.created);
}
const studio = () => import('../pipeline/studio.mjs'); const slog = (e) => (m) => { try { e.sender.send('studio:log', m); } catch {} };
const H = {
  options: () => ({ categories: CATEGORIES, styles: STYLES, looks: LOOKS, subs: SUBTITLE_STYLES }),
  estimate: (o) => { const e = estimate({ style: o.style, minutes: Number(o.minutes) || 1, renderer: readSettings().renderer }); return { ...e, totalText: fmt(e.total), partsText: Object.fromEntries(Object.entries(e.parts).map(([k, v]) => [k, fmt(v)])) }; },
  'settings:get': () => publicSettings(),
  'settings:set': (s) => { const cur = readSettings(); if (s.key !== undefined) setKey(s.key); const next = readSettings(); for (const k of ['model', 'renderer', 'concurrency']) if (s[k] !== undefined) next[k] = s[k]; writeSettings(next); void cur; return publicSettings(); },
  'ai:get': () => aiView(),
  'ai:set': (o) => { const a = aiConf(); const c = (a.providers[o.provider] ||= {});
    if (o.key !== undefined) { delete c.keyEnc; delete c.keyPlain; Object.assign(c, enc(String(o.key).trim())); }
    if (o.model !== undefined) c.model = o.model; if (o.baseUrl !== undefined) c.baseUrl = o.baseUrl;
    if (o.primary) a.primary = o.provider; if (o.fallback !== undefined) a.fallback = !!o.fallback; saveAi(a); return aiView(); },
  'ai:models': async (name) => { const c = aiConf().providers[name] || {}; const k = dec(c); if (!k) return { ok: false, msg: 'Save a key first', ids: [] };
    try { const ids = ai.rankModels(name, await ai.listModels({ provider: name, key: k, baseUrl: c.baseUrl })); return { ok: true, ids }; } catch (e) { return { ok: false, msg: e.message, ids: [] }; } },
  'ai:test': async (name) => { const c = aiConf().providers[name] || {}; const k = dec(c); if (!k) return { ok: false, msg: 'No key saved' };
    let model = c.model; if (!model) { try { model = ai.defaultModel(name, await ai.listModels({ provider: name, key: k, baseUrl: c.baseUrl })); } catch (e) { return { ok: false, msg: 'Key rejected: ' + e.message }; } }
    try { const t = await ai.chat({ provider: name, key: k, model, baseUrl: c.baseUrl }, { user: 'Reply with this JSON only: {"ok": true}', temperature: 0, maxTokens: 50 }); ai.parseJSON(t); return { ok: true, msg: `✓ ${model} works` }; }
    catch (e) { const q = e.status === 429 && /quota|billing|credit/i.test(e.message); return { ok: false, msg: `✗ ${model}: ${e.message.replace(/For more information.*$/, '').slice(0, 220)}${q ? ' → no quota left on this key today; pick another provider/model or wait for the reset.' : ''}` }; } },
  'story:prompt': async (o) => o.myStory ? (await import('../pipeline/story.mjs')).buildAdaptPrompt({ text: o.myStory, category: o.category, backgrounds: (o.style === 'cartoon2d' || o.style === 'flat2d') ? ((l) => { const m = l.filter((b) => (o.style === 'flat2d') === (b.tags || []).includes('flat')); return m.length ? m : l; })(bgs.listBackgrounds()).map((b) => ({ id: b.id, name: b.name, place: b.place, time: b.time, tags: b.tags, marks: [...new Set((b.seats || []).map((m) => m.type || 'seat'))] })) : [], actors: lib.actorsFor((o.style === 'cartoon2d' || o.style === 'flat2d') ? 'toon' : o.style || 'toon').map((a) => ({ id: a.id, gender: a.gender, age: a.age, tags: a.tags })) }) : (await import('../pipeline/story.mjs')).buildPastePrompt({ category: o.category, minutes: Number(o.minutes) || 1, idea: o.idea || '', chars: o.chars || 'auto', backgrounds: (o.style === 'cartoon2d' || o.style === 'flat2d') ? ((l) => { const m = l.filter((b) => (o.style === 'flat2d') === (b.tags || []).includes('flat')); return m.length ? m : l; })(bgs.listBackgrounds()).map((b) => ({ id: b.id, name: b.name, place: b.place, time: b.time, tags: b.tags, marks: [...new Set((b.seats || []).map((m) => m.type || 'seat'))] })) : [], actors: lib.actorsFor((o.style === 'cartoon2d' || o.style === 'flat2d') ? 'toon' : o.style || 'toon').map((a) => ({ id: a.id, gender: a.gender, age: a.age, tags: a.tags })) }),
  'story:parse': async (o) => { try { const st = (await import('../pipeline/story.mjs')).parsePastedStory(o.text, Number(o.minutes) || 1); return { ok: true, title: st.title, scenes: st.scenes.length, lines: st.scenes.reduce((n, sc) => n + sc.beats.filter((b) => b.type === 'line').length, 0), chars: st.characters.map((c) => c.name).join(', ') }; } catch (e) { return { ok: false, msg: e.message }; } },
  'setup:status': () => setupStatus(),
  'setup:run': async (_o, e) => runSetup((p) => e.sender.send('setup:progress', p)),
  'queue:get': () => queueView(),
  'queue:add': async (o) => { const n = Math.max(1, Math.min(20, Number(o.count) || 1)); const ideas = String(o.idea || '').split('\n').map((x) => x.trim()).filter(Boolean);
    let storyJson = null; if (o.pasted) { storyJson = (await import('../pipeline/story.mjs')).parsePastedStory(o.pasted, Number(o.minutes) || 1); }
    for (let i = 0; i < (storyJson || o.myStory ? 1 : n); i++) { const opts = { category: o.category, idea: storyJson ? storyJson.title : ideas[i] ?? (n > 1 ? '' : o.idea || ''), minutes: Number(o.minutes) || 1, style: o.style, look: o.look, subs: o.subs === 'mine' ? (readSettings().subStyle ? 'classic' : 'auto') : o.subs, subStyle: o.subs === 'mine' ? readSettings().subStyle || null : null, demo: !!o.demo, storyJson, storyAI: o.storyAI || 'auto', chars: o.chars || 'auto', myStory: storyJson ? '' : o.myStory || '' };
      const est = estimate({ style: opts.style, minutes: opts.minutes, renderer: readSettings().renderer });
      queue.push({ id: newJobId(o.category) + (n > 1 ? `_${i + 1}` : ''), opts, status: 'queued', progress: 0, estimate: est, created: Date.now(), msg: 'Queued', session: SESSION }); }
    if (o.start) autoRun = true; broadcast(true); pump(); return queueView(); },
  'queue:start': () => { autoRun = true; pump(); broadcast(true); return queueView(); },
  'queue:pause': () => { autoRun = false; broadcast(true); return queueView(); },
  'queue:cancel': (id) => { const j = queue.find((x) => x.id === id); if (j === running) abort?.abort(); else if (j) j.status = 'cancelled'; broadcast(true); return queueView(); },
  'queue:retry': (id) => { const j = queue.find((x) => x.id === id); if (j) Object.assign(j, { status: 'queued', progress: 0, error: null, msg: 'Queued', retryAt: null, autoRetries: 0, session: SESSION }); autoRun = true; broadcast(true); pump(); return queueView(); },
  'queue:remove': (id) => { queue = queue.filter((x) => x.id !== id || x === running); broadcast(true); return queueView(); },
  'queue:move': ({ id, dir }) => { const i = queue.findIndex((x) => x.id === id), k = i + dir; if (i >= 0 && k >= 0 && k < queue.length) [queue[i], queue[k]] = [queue[k], queue[i]]; broadcast(true); return queueView(); },
  'queue:clearDone': () => { queue = queue.filter((x) => !['done', 'cancelled'].includes(x.status)); broadcast(true); return queueView(); },
  'team:status': () => teamView(),
  'team:login': async (o) => { let srv; try { srv = team.decodeServer(o.code || readSettings().team?.code); } catch (e) { return { ok: false, msg: e.message }; }
    const key = String(o.key || '').trim().toUpperCase(); if (!key) return { ok: false, msg: 'Enter your licence key.' };
    try { const r = await team.checkLicense(srv, key, app.getVersion()); const s = readSettings(); s.team = { ...(s.team || {}), code: o.code || s.team?.code };
      s.lic = { ...enc(key), loginAt: new Date(r.now).getTime() + 1000, lastOk: Date.now(), name: r.name }; writeSettings(s); LIC = { ok: true, name: r.name, msg: '', offline: false, pack: r.pack };
      sendAll('team', teamView()); return { ok: true, view: teamView() }; } catch (e) { return { ok: false, msg: e.message }; } },
  'team:logout': () => { logout(''); return teamView(); },
  'team:check': async () => { await licCheck(); return teamView(); },
  'team:sync': async (_o, e) => { if (!LIC.ok) throw new Error('Sign in first.'); return teamSync(e); },
  'team:admin:set': (o) => { const s = readSettings(); const url = String(o.url || '').trim().replace(/\/+$/, ''); const pub = String(o.pub || '').trim();
    if (!(/^https:\/\/.+/.test(url) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) || !pub) throw new Error('Enter the project URL (https://….supabase.co) and the publishable / anon key.');
    s.team = { ...(s.team || {}), code: team.encodeServer(url, pub), adminUrl: url }; if (o.adm) s.team.adm = enc(String(o.adm).trim()); writeSettings(s); return teamView(); },
  'team:admin:clear': () => { const s = readSettings(); if (s.team) { delete s.team.adm; writeSettings(s); } return teamView(); },
  'team:admin:list': async () => { const known = admKeysRead(); return (await team.adminList(teamSrv(), admKey())).map((r) => ({ ...r, key: known[r.key_hash] ? dec(known[r.key_hash]) : null })); },
  'team:admin:create': async (o) => { const k = await team.adminCreate(teamSrv(), admKey(), o.name); const known = admKeysRead(); known[team.hashKey(k)] = enc(k); fs.writeFileSync(ADM_KEYS, JSON.stringify(known)); return k; },
  'team:admin:patch': async (o) => { const patch = o.action === 'block' ? { status: 'blocked' } : o.action === 'unblock' ? { status: 'active' } : o.action === 'reset' ? { device_id: null, device_name: null } : o.action === 'logout' ? { logout_at: new Date().toISOString() } : o.action === 'rename' ? { name: String(o.name || '').slice(0, 60) } : null;
    if (!patch) throw new Error('Unknown action'); await team.adminPatch(teamSrv(), admKey(), o.id, patch); return true; },
  'team:admin:delete': async (id) => { await team.adminDelete(teamSrv(), admKey(), id); return true; },
  'team:admin:publish': async (o, e) => team.publish({ srv: teamSrv(), admKey: admKey(), PUBLIC, note: o?.note || '', onProgress: (i, n, label) => e.sender.send('team:progress', { i, n, label }) }),
  'library:list': () => libraryList(),
  'subs:load': async (dir) => { const S = await import('../pipeline/subs.mjs'); const f = path.join(OUTPUT, path.basename(dir)); let data = null;
    try { data = JSON.parse(fs.readFileSync(path.join(f, 'subtitles.json'), 'utf8')); } catch {}
    if (!data) { const tl = JSON.parse(fs.readFileSync(path.join(f, 'timeline.json'), 'utf8')); data = { lines: S.linesFromTimeline(tl), style: S.styleFrom(tl.subsPreset || tl.subs) }; }
    const canBurn = fs.existsSync(path.join(f, 'video_clean.mp4'));
    return { ...data, canBurn, video: `av://videos/${encodeURIComponent(path.basename(dir))}/${canBurn ? 'video_clean.mp4' : 'final.mp4'}`, presets: S.PRESETS, fonts: Object.keys(S.FONTS) }; },
  'subs:save': async (o, e) => { const S = await import('../pipeline/subs.mjs'); const f = path.join(OUTPUT, path.basename(o.dir)); const { WIDTH, HEIGHT } = await import('../pipeline/config.mjs');
    if (!fs.existsSync(path.join(f, 'video_clean.mp4'))) { fs.writeFileSync(path.join(f, 'subtitles.json'), JSON.stringify({ style: o.style, lines: o.lines }, null, 2)); S.writeSRT(o.lines, path.join(f, 'subtitles.srt'), o.style.lang === 'hindi' ? 'hindi' : o.style.lang === 'english' ? 'english' : 'hinglish'); return { ok: true, burned: false }; }
    const dur = Math.max(1, ...o.lines.map((l) => l.end + 4));
    await S.applySubs({ ffmpegPath, folder: f, lines: o.lines, style: o.style, W: WIDTH, H: HEIGHT, duration: dur, onProgress: (p) => e.sender.send('subs:progress', p) }); return { ok: true, burned: true }; },
  'subs:default': (style) => { const s = readSettings(); s.subStyle = style; writeSettings(s); return true; },
  'library:open': (dir) => shell.openPath(dir ? path.join(OUTPUT, dir) : OUTPUT),
  'library:delete': (dir) => { fs.rmSync(path.join(OUTPUT, dir), { recursive: true, force: true }); return libraryList(); },
  'chars:list': () => lib.listCharacters().map((c) => ({ ...c, url: 'av://data/' + c.file.split('/').map(encodeURIComponent).join('/') })),
  'chars:import': async (meta, e) => { const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ['openFile', 'multiSelections'], filters: [{ name: '3D characters', extensions: ['vrm', 'glb', 'gltf', 'fbx'] }] });
    return r.canceled ? [] : r.filePaths.map((f) => lib.importCharacter(f, meta || {})); },
  'chars:importPaths': (paths) => paths.map((f) => lib.importCharacter(f, {})),
  'chars:update': ({ id, patch }) => lib.updateCharacter(id, patch),
  'chars:delete': (id) => lib.deleteCharacter(id),
  'chars:openFolder': () => shell.openPath(CHARS),
  'bg:list': () => ({ places: bgs.PLACES, list: bgs.listBackgrounds().map((b) => ({ ...b, url: 'av://data/' + b.file.split('/').map(encodeURIComponent).join('/') })) }),
  'bg:import': async (_o, e) => { const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ['openFile', 'multiSelections'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }] }); return r.canceled ? [] : r.filePaths.map((f) => bgs.importBackground(f)); },
  'bg:importPaths': (paths) => paths.map((f) => bgs.importBackground(f)),
  'bg:update': ({ id, patch }) => bgs.updateBackground(id, patch),
  'bg:delete': (id) => bgs.deleteBackground(id),
  'bg:openFolder': () => shell.openPath(bgs.BG_DIR),
  'voice:list': () => tts.availableVoices(),
  'voice:sample': async (id) => { const dir = path.join(PUBLIC, 'tmp'); fs.mkdirSync(dir, { recursive: true }); const f = path.join(dir, `voice_${id}.wav`); if (!fs.existsSync(f)) await tts.sampleVoice(id, null, f); return `av://data/tmp/voice_${id}.wav?${Date.now()}`; },
  'open:data': () => shell.openPath(process.env.AUTOVIDEO_DATA),
  // Prompt Studio (story bible → scenes → shots with image / video prompts)
  'studio:options': async () => (await studio()).options(),
  'studio:list': async () => (await studio()).list(),
  'studio:get': async (id) => (await studio()).get(id),
  'studio:create': async (o, e) => (await studio()).create(o, await buildChain(o.ai), slog(e)),
  'studio:scenes': async (o, e) => (await studio()).scenes(o.id, await buildChain(o.ai), slog(e)),
  'studio:next': async (o, e) => (await studio()).next(o.id, await buildChain(o.ai), slog(e)),
  'studio:redo': async (o, e) => (await studio()).redo(o.id, o.scene, o.note, await buildChain(o.ai), slog(e)),
  'studio:tone': async (o) => (await studio()).tone(o.id, o.tone),
  'studio:thumbs': async (o, e) => (await studio()).thumbnails(o.id, await buildChain(o.ai), slog(e)),
  'studio:exports': async (id) => { const S = await studio(); return S.exportsOf(S.get(id)); },
  'studio:open': async (id) => { const S = await studio(); return shell.openPath(id ? S.folderOf(id) : S.STUDIO); },
  'studio:library': async () => shell.openPath((await studio()).libraryFolder()),
  'studio:delete': async (id) => { (await studio()).remove(id); return true; },
  'update:get': () => upd,
  'update:check': () => checkUpdates(),
  'update:download': () => { autoUpdater.downloadUpdate().catch((e) => sendUpd({ state: 'error', msg: String(e.message || e) })); sendUpd({ state: 'downloading', percent: 0 }); return upd; },
  'update:install': () => { setImmediate(() => autoUpdater.quitAndInstall(false, true)); return true; },
  'queue:retryNow': (id) => { const j = queue.find((x) => x.id === id); if (j && j.status === 'queued') { j.retryAt = null; j.msg = 'Queued'; } autoRun = true; clearTimeout(wakeTimer); pump(); broadcast(true); return queueView(); },
};
const OPEN = new Set(['options', 'settings:get', 'update:get', 'update:check', 'update:download', 'update:install', 'setup:status', 'setup:run']);
for (const [ch, fn] of Object.entries(H)) ipcMain.handle(ch, (e, arg) => { if (!LIC.ok && !ch.startsWith('team:') && !OPEN.has(ch)) throw new Error('Sign in with your licence key first.'); return fn(arg, e); });

function createWindow() {
  const shots = process.argv.indexOf('--screens');
  const win = new BrowserWindow({ width: 1280, height: 860, minWidth: 980, minHeight: 640, title: 'Auto Video Studio', backgroundColor: '#0f1117', autoHideMenuBar: true,
    webPreferences: { preload: path.join(APP_DIR, 'app', 'ui', 'preload.cjs') } });
  win.__ui = true; win.loadURL('av://app/app/ui/index.html'); win.webContents.on('console-message', (_e, level, msg, line, src) => { if (level >= 2) console.log('[ui]', msg, src, line); });
  if (shots > 0) win.webContents.once('did-finish-load', async () => { // dev: screenshots of every tab
    const dir = process.argv[shots + 1]; const wait = (ms) => new Promise((ok) => setTimeout(ok, ms)); await wait(2500);
    if (process.argv.includes('--mystory-ui')) { await win.webContents.executeJavaScript(`document.querySelector('#storyMode [data-m=mine]').click(); const t=document.querySelector('#myStory'); t.value='Inspector Arjun: "Raka, gaadi roko!"\\n\\n'+'Raka laal car me highway par bhaag raha tha. '.repeat(120); t.dispatchEvent(new Event('input'));`); await wait(2000); fs.writeFileSync(path.join(dir, 'mystory_ui.png'), (await win.webContents.capturePage()).toPNG()); return app.quit(); }
    if (process.argv.includes('--subed-ui')) { await win.webContents.executeJavaScript(`document.querySelector('[data-tab=library]').click()`); await wait(2000); await win.webContents.executeJavaScript(`document.querySelector('[data-subs]').click()`); await wait(2500); await win.webContents.executeJavaScript(`(()=>{const v=document.querySelector('#seVideo'); v.currentTime=13.4; document.querySelector('#sePreset').value='youtube'; document.querySelector('#sePreset').onchange();})()`); await wait(2500); fs.writeFileSync(path.join(dir, 'subed_ui.png'), (await win.webContents.capturePage()).toPNG()); return app.quit(); }
    if (process.argv.includes('--studio-ui')) { const js = (c) => win.webContents.executeJavaScript(c); await js(`document.querySelector('[data-tab=studio]').click()`); await wait(1500);
      fs.writeFileSync(path.join(dir, 'studio_new.png'), (await win.webContents.capturePage()).toPNG()); await js(`document.querySelector('#stList .it')?.click()`); await wait(1500);
      fs.writeFileSync(path.join(dir, 'studio_bible.png'), (await win.webContents.capturePage()).toPNG()); await js(`document.querySelector('.stscene').open=true; document.querySelector('.stscene').scrollIntoView()`); await wait(800);
      fs.writeFileSync(path.join(dir, 'studio_shots.png'), (await win.webContents.capturePage()).toPNG()); await js(`document.querySelector('[data-ex=voiceover]').click()`); await wait(1200);
      fs.writeFileSync(path.join(dir, 'studio_vo.png'), (await win.webContents.capturePage()).toPNG()); app.quit(); return; }
    if (process.argv.includes('--team-ui')) { const js = (c) => win.webContents.executeJavaScript(c); const shot = async (n) => fs.writeFileSync(path.join(dir, n), (await win.webContents.capturePage()).toPNG());
      await shot('team_login.png');
      await js(`document.querySelector('#lgAdmin').click(); document.querySelector('#lgUrl').value='http://127.0.0.1:18090'; document.querySelector('#lgPub').value='anon-test'; document.querySelector('#lgAdm').value='service-test'; document.querySelector('#lgAdminSave').click();`); await wait(2500);
      await js(`document.querySelector('#adName').value='Ramesh (PC 3)'; document.querySelector('#adNew').click();`); await wait(2500); await js(`document.querySelector('#adName').value='Admin (my PC)'; document.querySelector('#adNew').click();`); await wait(2500);
      await shot('team_admin.png'); const key = await js(`[...document.querySelectorAll('.keycode')].map((x) => x.textContent).filter((x) => x.startsWith('AVS-')).pop()`);
      await js(`document.querySelector('#adClose').click(); document.querySelector('#lgKey').value=${JSON.stringify(key)}; document.querySelector('#lgGo').click();`); await wait(5000);
      await js(`document.querySelector('[data-tab=settings]').click()`); await wait(1500); await shot('team_settings.png'); return app.quit(); }
    if (process.argv.includes('--paste-ui')) { const demo = fs.readFileSync(path.join(APP_DIR, 'pipeline', 'demo-story.json'), 'utf8');
      await win.webContents.executeJavaScript(`const ss=document.querySelector('#storySrc'); ss.value='paste'; ss.onchange(); const t=document.querySelector('#pasted'); t.value = ${JSON.stringify('Sure! Here is the story:\n' + demo)}; t.dispatchEvent(new Event('input'));`);
      await wait(2500); fs.writeFileSync(path.join(dir, 'paste_ui.png'), (await win.webContents.capturePage()).toPNG()); return app.quit(); }
    if (process.argv.includes('--queue-demo')) { await H['queue:add']({ category: 'romance', minutes: 1, count: 2, style: 'toon', look: 'auto', subs: 'auto', demo: true, start: true });
      await win.webContents.executeJavaScript(`document.querySelector('[data-tab=queue]').click()`);
      for (const [i, t] of [[1, 25000], [2, 60000]]) { await wait(t); fs.writeFileSync(path.join(dir, `queue_${i}.png`), (await win.webContents.capturePage()).toPNG()); }
      abort?.abort(); return app.quit(); }
    const only = process.argv.includes('--chars-only');
    if (only) { await win.webContents.executeJavaScript(`document.querySelector('[data-tab=chars]').click()`); await wait(6000);
      for (const id of process.argv[process.argv.indexOf('--chars-only') + 1].split(',')) { await win.webContents.executeJavaScript(`document.querySelector('.ch[data-id=${id}]').click()`); await wait(14000);
        fs.writeFileSync(path.join(dir, `char_${id}.png`), (await win.webContents.capturePage()).toPNG()); } return app.quit(); }
    for (const tab of ['new', 'queue', 'library', 'chars', 'bgs', 'settings']) { console.log('TAB', tab, await win.webContents.executeJavaScript(`(() => { try { document.querySelector('[data-tab=${tab}]').click(); return document.querySelector('#tab-' + '${tab}')?.className; } catch (e) { return 'ERR ' + e.message; } })()`)); await wait(tab === 'chars' ? 15000 : 1500); if (tab === 'bgs' && process.argv.includes('--bg-pick')) { await win.webContents.executeJavaScript(`document.querySelector('.bgc[data-id=${process.argv[process.argv.indexOf('--bg-pick') + 1]}]')?.click(); document.querySelector('.mchip')?.click()`); await wait(1500); }
      fs.writeFileSync(path.join(dir, `ui_${tab}.png`), (await win.webContents.capturePage()).toPNG()); }
    app.quit(); });
}

app.whenReady().then(() => {
  serve();
  // Windows portable build: make a Desktop shortcut once
  try { const s = readSettings(); if (process.platform === 'win32' && app.isPackaged && !s.shortcutDone) { shell.writeShortcutLink(path.join(app.getPath('desktop'), 'Auto Video Studio.lnk'), { target: process.execPath, description: 'Auto Video Studio' }); s.shortcutDone = true; writeSettings(s); } } catch {}
  if (process.argv.includes('--frames')) { // dev: node … --frames timeline.json 300,900 outDir
    const i = process.argv.indexOf('--frames'); const tl = JSON.parse(fs.readFileSync(process.argv[i + 1], 'utf8')); const only = process.argv[i + 2].split(',').map(Number); const dir = process.argv[i + 3];
    return chromeRender({ tl, mixFile: null, out: path.join(dir, 'x.mp4'), onProgress: () => {}, only }).then((r) => { r.shots.forEach((d, k) => fs.writeFileSync(path.join(dir, `f_${only[k]}.jpg`), Buffer.from(d.split(',')[1], 'base64'))); app.quit(); }).catch((e) => { console.error(e); app.quit(); }); }
  if (process.argv.includes('--demo-test')) return demoTest();
  createWindow(); licCheck().then((ok) => { if (ok && LIC.pack > team.localPackVersion(STATE) && !running) teamSync().catch(() => {}); }).catch(() => {});
  if (app.isPackaged && !isZip()) setTimeout(checkUpdates, 8000);
});
app.on('window-all-closed', () => { if (!process.argv.includes('--demo-test') && !process.argv.includes('--frames')) app.quit(); });

// headless self-test: node_modules/.bin/electron . --demo-test [--style toon]
async function demoTest() {
  const style = process.argv[process.argv.indexOf('--style') + 1] || 'toon';
  const t0 = Date.now();
  try {
    const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
    const mine = arg('--my-story') ? fs.readFileSync(arg('--my-story'), 'utf8') : '';
    const r = await makeVideo({ demo: !mine, myStory: mine, chain: mine ? [{ provider: 'custom', baseUrl: arg('--ai-url'), key: 'x', model: 'fake' }] : undefined, minutes: 2, demoFile: arg('--demo-file'), category: arg('--category', 'romance'), style, ffmpegPath, renderFn: chromeRender }, (e) => console.log(`[${fmt(e.elapsed)}] ${e.step}: ${e.msg}`));
    console.log('DEMO OK', r.file, fmt((Date.now() - t0) / 1000));
  } catch (e) { console.error('DEMO FAIL', e); }
  app.quit();
}
